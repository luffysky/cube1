/**
 * SPINREALM audio, with no UI or persistence dependencies.
 *
 * const sound = createSoundController();
 * startButton.addEventListener('click', () => {
 *   void sound.unlock(); // Call directly inside a real user gesture.
 *   sound.setScene('playing');
 * });
 * sound.setVolumes({ music: 0.38, sfx: 0.7, muted: false });
 * sound.play('rotate');
 *
 * Importing/constructing does not create audio objects, fetch files, or play.
 * unlock() starts loading; effects that are not ready are skipped, never queued.
 * Music stays streamed in one HTMLAudio element, routed through its own WebAudio
 * GainNode when available so the music slider also works on iOS.
 * The caller owns UI, storage, and game scene changes. Call destroy() on teardown.
 */

export const SOUND_EVENTS = Object.freeze([
  'move', 'rotate', 'hold', 'drop', 'clear',
  'spin', 'incoming', 'win', 'over', 'item',
]);

const SCENES = new Set(['ready', 'playing', 'paused', 'ended']);
const EVENTS = new Set(SOUND_EVENTS);
const COOLDOWN_MS = Object.freeze({
  move: 45, rotate: 55, hold: 90, drop: 60, clear: 100,
  spin: 160, incoming: 220, win: 1000, over: 1000, item: 160,
});
const PRIORITY = Object.freeze({
  move: 0, rotate: 1, hold: 2, drop: 2, clear: 3,
  spin: 4, incoming: 3, win: 5, over: 5, item: 4,
});
const EVENT_GAIN = Object.freeze({
  move: 0.22, rotate: 0.45, hold: 0.55, drop: 0.65, clear: 0.75,
  spin: 0.85, incoming: 0.65, win: 0.8, over: 0.75, item: 0.7,
});

const finiteVolume = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value)) : fallback;

/**
 * Optional configuration:
 *   music, sfx, muted: initial volumes; maxVoices: 1..16, default 6.
 *   musicUrl, sfxUrls: explicit URL overrides; defaults resolve beside this module.
 *   env, document, now: injectable platform dependencies for tests/embedding.
 *
 * unlock(): Promise<boolean> reports backend availability, not guaranteed audibility.
 * play(): boolean reports whether an effect actually started.
 * getState(): a read-only snapshot, useful for UI/debugging without DOM coupling.
 */
export function createSoundController(options = {}) {
  const env = options.env ?? globalThis;
  const visibility = options.document === undefined ? env.document : options.document;
  const AudioClass = env.Audio;
  const ContextClass = env.AudioContext ?? env.webkitAudioContext;
  const fetchFile = typeof env.fetch === 'function' ? env.fetch.bind(env) : null;
  const clock = options.now ?? (() => env.performance?.now?.() ?? Date.now());
  const musicUrl = String(options.musicUrl ?? new URL('./audio/music-loop.mp3', import.meta.url));
  const sfxUrls = Object.fromEntries(SOUND_EVENTS.map(name => [
    name, String(options.sfxUrls?.[name] ?? new URL(`./audio/${name}.wav`, import.meta.url)),
  ]));
  const maxVoices = Number.isInteger(options.maxVoices)
    ? Math.max(1, Math.min(16, options.maxVoices)) : 6;

  let musicVolume = finiteVolume(options.music, 0.38);
  let sfxVolume = finiteVolume(options.sfx, 0.7);
  let muted = options.muted === true;
  let scene = 'ready';
  let unlocked = false;
  let destroyed = false;
  let initialized = false;
  let music = null;
  let musicFailed = false;
  let musicBlocked = false;
  let musicRequest = 0;
  let musicPending = null;
  let context = null;
  let master = null;
  let musicSource = null;
  let musicGain = null;
  let contextRequest = 0;
  let contextPending = null;
  let voiceSequence = 0;
  const buffers = new Map();
  const loading = new Map();
  const failed = new Set();
  const lastPlayed = new Map();
  const voices = new Set();
  const abort = typeof env.AbortController === 'function' ? new env.AbortController() : null;

  const hidden = () => visibility?.hidden === true || visibility?.visibilityState === 'hidden';
  const canHear = () => !destroyed && unlocked && !hidden() && !muted;
  const wantsMusic = () => canHear() && musicVolume > 0 && (scene === 'ready' || scene === 'playing');
  const wantsSfx = () => canHear() && sfxVolume > 0 && scene !== 'paused';
  const wantsContext = () => wantsSfx() || Boolean(musicSource && wantsMusic() && !musicFailed && !musicBlocked);

  function stopVoice(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already ended or never started. */ }
    try { voice.source.disconnect(); } catch { /* Released by the platform. */ }
    try { voice.gain.disconnect(); } catch { /* Released by the platform. */ }
  }

  function stopEffects() {
    for (const voice of [...voices]) stopVoice(voice);
  }

  function pauseMusic() {
    musicRequest += 1;
    musicPending = null;
    try { music?.pause(); } catch { /* Audio may be unavailable. */ }
  }

  function onMusicError() {
    if (destroyed) return;
    musicFailed = true;
    pauseMusic();
    void syncContext();
  }

  function initialize() {
    if (initialized || destroyed) return;
    initialized = true;
    if (typeof AudioClass === 'function') {
      try {
        music = new AudioClass();
        music.preload = 'none';
        music.loop = true;
        music.playsInline = true;
        music.volume = musicVolume;
        music.src = musicUrl;
        music.addEventListener?.('error', onMusicError);
      } catch { music = null; }
    }
    if (typeof ContextClass === 'function') {
      try {
        context = new ContextClass({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = muted ? 0 : sfxVolume;
        master.connect(context.destination);
      } catch {
        try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* No context. */ }
        context = null;
        master = null;
      }
    }
    if (context && music && typeof context.createMediaElementSource === 'function') {
      try {
        musicGain = context.createGain();
        musicGain.gain.value = muted ? 0 : musicVolume;
        musicGain.connect(context.destination);
        // Each media element may be routed only once; initialize() is one-shot.
        musicSource = context.createMediaElementSource(music);
        musicSource.connect(musicGain);
        music.volume = 1;
      } catch {
        try { musicGain?.disconnect(); } catch { /* Incomplete graph. */ }
        musicGain = null;
        if (musicSource) {
          // A source was created but its graph failed; do not leak unscaled audio.
          try { musicSource.disconnect(); } catch { /* Incomplete graph. */ }
          musicFailed = true;
        }
        musicSource = null;
        music.volume = musicVolume;
      }
    }
  }

  function syncMusic() {
    if (!music) return;
    music.volume = musicSource ? 1 : musicVolume;
    if (!wantsMusic() || musicFailed || musicBlocked) {
      pauseMusic();
      return;
    }
    if (musicPending || music.paused === false) return;
    const request = ++musicRequest;
    try {
      // Keep play() in the gesture's call stack when invoked from unlock().
      const result = music.play();
      musicPending = Promise.resolve(result).then(() => {
        if (request === musicRequest && !wantsMusic()) pauseMusic();
      }).catch(error => {
        if (destroyed || request !== musicRequest) return;
        if (error?.name === 'NotSupportedError') musicFailed = true;
        else if (error?.name !== 'AbortError') musicBlocked = true;
      }).finally(() => {
        if (request === musicRequest) musicPending = null;
      });
    } catch {
      musicBlocked = true;
      musicPending = null;
    }
  }

  function syncContext() {
    if (!context || destroyed || context.state === 'closed') return Promise.resolve(false);
    const running = wantsContext();
    if (contextPending?.running === running) return contextPending.promise;
    if (!contextPending && context.state === (running ? 'running' : 'suspended')) {
      return Promise.resolve(running);
    }
    const request = ++contextRequest;
    try {
      // Call immediately; resume() must not be deferred beyond a user gesture.
      const result = running ? context.resume() : context.suspend();
      const promise = Promise.resolve(result).then(() => !destroyed && context.state === 'running')
        .catch(() => false).finally(() => {
          if (request === contextRequest) contextPending = null;
        });
      contextPending = { running, promise };
      return promise;
    } catch { contextPending = null; return Promise.resolve(false); }
  }

  function updateGain() {
    if (!context) return;
    for (const [node, volume] of [[master, sfxVolume], [musicGain, musicVolume]]) {
      if (!node) continue;
      const target = muted ? 0 : volume;
      try {
        node.gain.cancelScheduledValues(context.currentTime);
        node.gain.setTargetAtTime(target, context.currentTime, 0.015);
      } catch { node.gain.value = target; }
    }
  }

  function loadEffect(name) {
    if (destroyed || !context || !fetchFile || failed.has(name)) return Promise.resolve(null);
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (loading.has(name)) return loading.get(name);
    const task = Promise.resolve().then(() => fetchFile(sfxUrls[name], abort ? { signal: abort.signal } : undefined))
      .then(response => {
        if (!response?.ok) throw new Error('Unavailable audio');
        return response.arrayBuffer();
      }).then(bytes => {
        if (destroyed) return null;
        return context.decodeAudioData(bytes);
      }).then(buffer => {
        if (destroyed || !buffer) return null;
        buffers.set(name, buffer);
        return buffer;
      }).catch(() => {
        if (!destroyed) failed.add(name);
        return null;
      }).finally(() => loading.delete(name));
    loading.set(name, task);
    return task;
  }

  function preloadEffects() {
    if (!unlocked || destroyed || !context || muted || sfxVolume <= 0) return;
    for (const name of SOUND_EVENTS) void loadEffect(name);
  }

  function synchronize() {
    if (destroyed) return;
    updateGain();
    if (!wantsSfx()) stopEffects();
    syncMusic();
    void syncContext();
  }

  function unlock() {
    if (destroyed) return Promise.resolve(false);
    initialize();
    unlocked = true;
    musicBlocked = false; // A fresh gesture may retry browser autoplay permission.
    updateGain();
    syncMusic();
    const ready = syncContext();
    preloadEffects();
    return ready.then(running => !destroyed && (running || Boolean(music && !musicFailed)));
  }

  function setVolumes(values = {}) {
    if (destroyed) return getState();
    musicVolume = finiteVolume(values.music, musicVolume);
    sfxVolume = finiteVolume(values.sfx, sfxVolume);
    if (typeof values.muted === 'boolean') muted = values.muted;
    synchronize();
    preloadEffects();
    return getState();
  }

  function setScene(next) {
    if (destroyed || !SCENES.has(next)) return false;
    scene = next;
    synchronize();
    return true;
  }

  function play(name) {
    if (!EVENTS.has(name) || !wantsSfx() || !context || !master || context.state !== 'running') return false;
    const buffer = buffers.get(name);
    if (!buffer) {
      void loadEffect(name);
      return false; // Never play a stale movement after a network/decode delay.
    }
    const instant = clock();
    if (!Number.isFinite(instant) || instant - (lastPlayed.get(name) ?? -Infinity) < COOLDOWN_MS[name]) return false;
    if (voices.size >= maxVoices) {
      const quietest = [...voices].sort((a, b) => a.priority - b.priority || a.order - b.order)[0];
      if (!quietest || quietest.priority > PRIORITY[name]) return false;
      stopVoice(quietest);
    }
    let voice;
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      voice = { source, gain, priority: PRIORITY[name], order: ++voiceSequence };
      source.buffer = buffer;
      gain.gain.value = EVENT_GAIN[name];
      source.connect(gain);
      gain.connect(master);
      source.onended = () => stopVoice(voice);
      voices.add(voice);
      source.start(0);
      lastPlayed.set(name, instant);
      return true;
    } catch {
      if (voice) stopVoice(voice);
      return false;
    }
  }

  function getState() {
    return Object.freeze({
      unlocked, destroyed, scene, music: musicVolume, sfx: sfxVolume, muted,
      activeEffects: voices.size, loadedEffects: buffers.size,
      failedEffects: failed.size,
      musicPlaying: Boolean(music && !music.paused && !musicFailed && !musicBlocked && wantsMusic()),
      musicBlocked, musicFailed,
      musicReady: Boolean(music && music.readyState >= 2),
      musicAvailable: Boolean(music && !musicFailed),
      effectsAvailable: Boolean(context && master && context.state !== 'closed'),
    });
  }

  function onVisibilityChange() { synchronize(); }
  visibility?.addEventListener?.('visibilitychange', onVisibilityChange);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    visibility?.removeEventListener?.('visibilitychange', onVisibilityChange);
    pauseMusic();
    stopEffects();
    abort?.abort();
    buffers.clear();
    loading.clear();
    lastPlayed.clear();
    music?.removeEventListener?.('error', onMusicError);
    try { music?.removeAttribute?.('src'); music?.load?.(); } catch { /* Release best effort. */ }
    try { master?.disconnect(); } catch { /* Already disconnected. */ }
    try { musicSource?.disconnect(); } catch { /* Already disconnected. */ }
    try { musicGain?.disconnect(); } catch { /* Already disconnected. */ }
    try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* Already closed. */ }
  }

  return Object.freeze({ unlock, setVolumes, setScene, play, getState, destroy });
}

export default createSoundController;
