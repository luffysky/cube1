import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundController, SOUND_EVENTS } from '../../dist/games/spinrealm/sound.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function platform(settings = {}) {
  const state = { audio: [], contexts: [], fetches: [], time: 0 };
  const listeners = new Map();
  const document = {
    hidden: false, visibilityState: 'visible',
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    setHidden(hidden) {
      this.hidden = hidden;
      this.visibilityState = hidden ? 'hidden' : 'visible';
      listeners.get('visibilitychange')?.();
    },
  };
  class Audio {
    constructor() {
      this.paused = true; this.readyState = 0; this.currentTime = 0; this.playCalls = 0;
      this.pauseCalls = 0; this.handlers = new Map(); state.audio.push(this);
    }
    addEventListener(name, fn) { this.handlers.set(name, fn); }
    removeEventListener(name) { this.handlers.delete(name); }
    play() {
      this.playCalls += 1;
      this.paused = false;
      return settings.play?.(this) ?? Promise.resolve();
    }
    pause() { this.paused = true; this.pauseCalls += 1; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.loadCalled = true; }
  }
  class AudioContext {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0;
      this.destination = {}; this.gains = []; this.sources = []; this.mediaSources = [];
      this.resumeCalls = 0; this.suspendCalls = 0; state.contexts.push(this);
    }
    resume() {
      this.resumeCalls += 1;
      if (settings.resume) return settings.resume(this);
      this.state = 'running'; return Promise.resolve();
    }
    suspend() { this.suspendCalls += 1; this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createGain() {
      const gain = {
        gain: { value: 1, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value; } },
        connect() {}, disconnect() { this.disconnected = true; },
      };
      this.gains.push(gain); return gain;
    }
    createBufferSource() {
      const source = {
        onended: null, started: false, stopped: false,
        connect() {}, disconnect() { this.disconnected = true; },
        start() { this.started = true; },
        stop() { this.stopped = true; },
        finish() { this.onended?.(); },
      };
      this.sources.push(source); return source;
    }
    createMediaElementSource(element) {
      if (settings.mediaSourceUnsupported) throw new Error('Unavailable routing');
      assert.equal(this.mediaSources.some(source => source.element === element), false);
      const source = {
        element,
        connect(destination) { this.destination = destination; },
        disconnect() { this.disconnected = true; },
      };
      this.mediaSources.push(source);
      return source;
    }
    decodeAudioData(bytes) {
      return settings.decode?.(bytes) ?? Promise.resolve({ duration: 0.1, length: 4000 });
    }
  }
  const env = {
    Audio, AudioContext, document, AbortController,
    fetch(url, options) {
      state.fetches.push({ url, options });
      return settings.fetch?.(url, options) ?? Promise.resolve({
        ok: true, arrayBuffer: async () => new ArrayBuffer(8),
      });
    },
  };
  return { state, env, document, listeners, now: () => state.time };
}

test('construction and configuration cannot autoplay or download; no-browser use degrades quietly', async () => {
  const p = platform();
  const sound = createSoundController(p);
  sound.setScene('playing');
  sound.setVolumes({ music: 0.4, sfx: 0.8 });
  assert.equal(sound.play('rotate'), false);
  assert.equal(p.state.audio.length, 0);
  assert.equal(p.state.contexts.length, 0);
  assert.equal(p.state.fetches.length, 0);
  sound.destroy();
  assert.equal(p.listeners.size, 0);
  const unsupported = createSoundController({ env: {} });
  assert.equal(await unsupported.unlock(), false);
  assert.equal(unsupported.play('item'), false);
  unsupported.destroy();
});

test('one music element resumes its position and obeys scene and visibility without overlapping', async () => {
  const p = platform();
  const sound = createSoundController(p);
  await sound.unlock();
  await tick();
  const music = p.state.audio[0];
  assert.equal(p.state.audio.length, 1);
  assert.equal(music.loop, true);
  assert.match(music.src, /\/audio\/music-loop\.mp3$/);
  assert.equal(music.playCalls, 1);
  music.currentTime = 17;
  sound.setScene('playing');
  await sound.unlock();
  assert.equal(music.playCalls, 1);
  sound.setScene('paused');
  assert.equal(music.paused, true);
  assert.equal(music.currentTime, 17);
  assert.equal(sound.play('item'), false);
  sound.setScene('playing');
  await tick();
  assert.equal(music.playCalls, 2);
  p.document.setHidden(true);
  assert.equal(music.paused, true);
  assert.equal(sound.play('rotate'), false);
  p.document.setHidden(false);
  await tick();
  assert.equal(music.playCalls, 3);
  sound.setScene('ended');
  assert.equal(music.paused, true);
  assert.equal(sound.play('win'), true);
  p.document.setHidden(true);
  p.document.setHidden(false);
  await tick();
  assert.equal(music.playCalls, 3);
  assert.equal(sound.setScene('unknown'), false);
  sound.destroy();
});

test('music and effect volume are independent; invalid values preserve settings and mute stops active audio', async () => {
  const p = platform();
  const sound = createSoundController(p);
  await sound.unlock(); await tick();
  assert.equal(sound.play('rotate'), true);
  assert.equal(sound.getState().activeEffects, 1);
  sound.setVolumes({ music: 0.1, sfx: 0.9 });
  assert.equal(p.state.audio[0].volume, 1);
  assert.equal(p.state.contexts[0].gains[0].gain.value, 0.9);
  assert.equal(p.state.contexts[0].gains[1].gain.value, 0.1);
  sound.setVolumes({ music: NaN, sfx: Infinity, muted: 'false' });
  assert.equal(sound.getState().music, 0.1);
  assert.equal(sound.getState().sfx, 0.9);
  assert.equal(sound.getState().muted, false);
  sound.setVolumes({ music: -3, sfx: 8 });
  assert.equal(sound.getState().music, 0);
  assert.equal(sound.getState().sfx, 1);
  sound.setVolumes({ music: 0.38, muted: true });
  assert.equal(sound.getState().activeEffects, 0);
  assert.equal(p.state.audio[0].paused, true);
  assert.equal(sound.play('hold'), false);
  sound.setVolumes({ muted: false }); await tick();
  assert.equal(p.state.audio[0].paused, false);
  sound.destroy();
});

test('routed streaming music has a separate gain and keeps the context active with sound effects disabled', async () => {
  const p = platform();
  const sound = createSoundController({ ...p, music: 0.4, sfx: 0 });
  assert.equal(p.state.audio.length, 0);
  assert.equal(p.state.contexts.length, 0);
  assert.equal(p.state.fetches.length, 0);
  await sound.unlock(); await tick();
  const context = p.state.contexts[0];
  const music = p.state.audio[0];
  const [effectsGain, musicGain] = context.gains;
  assert.equal(context.state, 'running');
  assert.equal(music.paused, false);
  assert.equal(music.volume, 1);
  assert.equal(effectsGain.gain.value, 0);
  assert.equal(musicGain.gain.value, 0.4);
  assert.equal(context.mediaSources.length, 1);
  assert.equal(context.mediaSources[0].destination, musicGain);
  assert.equal(p.state.fetches.length, 0);
  sound.setVolumes({ music: 0.15 });
  assert.equal(musicGain.gain.value, 0.15);
  assert.equal(effectsGain.gain.value, 0);
  sound.setVolumes({ music: 0, sfx: 0.7 }); await tick();
  assert.equal(music.paused, true);
  assert.equal(context.state, 'running');
  assert.equal(musicGain.gain.value, 0);
  assert.equal(sound.play('rotate'), true);
  sound.setVolumes({ music: 0.3, sfx: 0 });
  await sound.unlock(); await tick();
  assert.equal(context.mediaSources.length, 1);
  assert.equal(context.state, 'running');
  assert.equal(music.paused, false);
  p.document.setHidden(true);
  assert.equal(context.state, 'suspended');
  p.document.setHidden(false); await tick();
  assert.equal(context.state, 'running');
  sound.setScene('ended');
  assert.equal(context.state, 'suspended');
  sound.destroy();
  assert.equal(context.mediaSources[0].disconnected, true);
  assert.equal(musicGain.disconnected, true);
});

test('unavailable media-source routing preserves native HTMLAudio volume fallback', async () => {
  const p = platform({ mediaSourceUnsupported: true });
  const sound = createSoundController({ ...p, music: 0.4, sfx: 0 });
  await sound.unlock(); await tick();
  assert.equal(p.state.audio[0].paused, false);
  assert.equal(p.state.audio[0].volume, 0.4);
  assert.equal(p.state.contexts[0].state, 'suspended');
  sound.setVolumes({ music: 0.2 });
  assert.equal(p.state.audio[0].volume, 0.2);
  assert.equal(p.state.contexts[0].mediaSources.length, 0);
  sound.destroy();
});

test('high-frequency moves are throttled and important cues retain the bounded voice budget', async () => {
  const p = platform();
  const sound = createSoundController({ ...p, maxVoices: 2 });
  await sound.unlock(); await tick();
  assert.equal(sound.play('move'), true);
  assert.equal(sound.play('move'), false);
  p.state.time = 46;
  assert.equal(sound.play('move'), true);
  assert.equal(sound.play('win'), true);
  assert.equal(sound.play('over'), true);
  assert.equal(sound.getState().activeEffects, 2);
  assert.equal(p.state.contexts[0].sources[0].stopped, true);
  p.state.time = 100;
  assert.equal(sound.play('move'), false);
  assert.equal(sound.play('not-an-event'), false);
  p.state.contexts[0].sources.at(-1).finish();
  assert.equal(sound.getState().activeEffects, 1);
  assert.equal(sound.play('move'), true);
  assert.equal(sound.getState().activeEffects, 2);
  sound.destroy();
});

test('slow loads never replay stale input; all ten relative effect URLs preload only after unlock', async () => {
  const loading = deferred();
  const p = platform({ fetch: () => loading.promise });
  const sound = createSoundController(p);
  await sound.unlock(); await tick();
  assert.equal(p.state.fetches.length, SOUND_EVENTS.length);
  for (const name of SOUND_EVENTS) assert.ok(p.state.fetches.some(({ url }) => url.endsWith(`/audio/${name}.wav`)));
  assert.equal(sound.play('drop'), false);
  p.document.setHidden(true);
  loading.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await tick();
  assert.equal(p.state.contexts[0].sources.length, 0);
  assert.equal(sound.getState().loadedEffects, 10);
  p.document.setHidden(false); await tick();
  assert.equal(p.state.contexts[0].sources.length, 0);
  assert.equal(sound.play('item'), true);
  sound.destroy();
});

test('a pending music request cannot undo pause or create a second music instance', async () => {
  const requests = [];
  const p = platform({ play: () => { const request = deferred(); requests.push(request); return request.promise; } });
  const sound = createSoundController(p);
  await sound.unlock();
  sound.setScene('paused');
  sound.setScene('playing');
  assert.equal(requests.length, 2);
  requests[0].reject(Object.assign(new Error('Interrupted'), { name: 'AbortError' }));
  requests[1].resolve();
  await tick();
  assert.equal(p.state.audio.length, 1);
  assert.equal(p.state.audio[0].paused, false);
  sound.setScene('paused');
  assert.equal(p.state.audio[0].paused, true);
  sound.destroy();
});

test('autoplay rejection, HTTP/decode failures, and teardown degrade without unhandled work', async () => {
  let attempts = 0;
  const p = platform({
    play(audio) {
      if (++attempts === 1) {
        audio.paused = true;
        return Promise.reject(Object.assign(new Error('Gesture needed'), { name: 'NotAllowedError' }));
      }
      return Promise.resolve();
    },
    fetch: async () => ({ ok: false }),
  });
  const sound = createSoundController(p);
  await sound.unlock(); await tick();
  assert.equal(sound.getState().loadedEffects, 0);
  assert.equal(sound.getState().failedEffects, SOUND_EVENTS.length);
  assert.equal(sound.getState().musicBlocked, true);
  assert.equal(sound.getState().musicPlaying, false);
  sound.setScene('playing'); await tick();
  assert.equal(attempts, 1);
  await sound.unlock(); await tick();
  assert.equal(attempts, 2);
  assert.equal(sound.getState().musicBlocked, false);
  assert.equal(sound.getState().musicPlaying, true);
  assert.equal(sound.play('rotate'), false);
  sound.destroy();
  sound.destroy();
  assert.equal(await sound.unlock(), false);
  assert.equal(sound.play('item'), false);
  assert.equal(p.state.fetches[0].options.signal.aborted, true);
  assert.equal(p.state.contexts[0].state, 'closed');
  assert.equal(p.state.audio[0].src, '');
  assert.equal(p.listeners.size, 0);
  const broken = platform({ decode: async () => { throw new Error('Corrupt asset'); } });
  const brokenSound = createSoundController(broken);
  await brokenSound.unlock(); await tick();
  assert.equal(brokenSound.getState().loadedEffects, 0);
  assert.equal(brokenSound.play('clear'), false);
  brokenSound.destroy();
});

test('media diagnostics distinguish not loaded, playing, paused, hidden and failed states', async () => {
  const p = platform();
  const sound = createSoundController(p);
  const initial = sound.getState();
  assert.equal(initial.musicReady, false);
  assert.equal(initial.musicPlaying, false);
  assert.equal(initial.musicBlocked, false);
  assert.equal(initial.musicFailed, false);
  assert.equal(initial.failedEffects, 0);
  await sound.unlock(); await tick();
  const music = p.state.audio[0];
  assert.equal(sound.getState().musicReady, false);
  music.readyState = 2;
  assert.equal(sound.getState().musicReady, true);
  assert.equal(sound.getState().musicPlaying, true);
  sound.setScene('paused');
  assert.equal(sound.getState().musicPlaying, false);
  assert.equal(sound.getState().musicReady, true);
  sound.setScene('playing'); await tick();
  p.document.setHidden(true);
  assert.equal(sound.getState().musicPlaying, false);
  p.document.setHidden(false); await tick();
  assert.equal(sound.getState().musicPlaying, true);
  music.handlers.get('error')();
  assert.equal(sound.getState().musicFailed, true);
  assert.equal(sound.getState().musicPlaying, false);
  assert.equal(sound.getState().musicAvailable, false);
  sound.destroy();
});
