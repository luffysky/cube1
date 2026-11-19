// Own the repeat clock; operating-system key repeat is deliberately ignored.
export class InputRepeater {
  constructor(getSettings, perform) {
    this.getSettings = getSettings;
    this.perform = perform;
    this.clear();
  }
  clear() {
    this.held = new Map(); this.order = 0; this.direction = null;
    this.horizontalTime = 0; this.horizontalNext = 0;
    this.softTime = 0; this.softNext = 0;
  }
  press(action, { minDas = 0 } = {}) {
    if (this.held.has(action)) return;
    this.held.set(action, ++this.order);
    if (action === 'left' || action === 'right') {
      this.direction = action;
      this.horizontalTime = 0;
      this.horizontalNext = Math.max(this.getSettings().das, minDas);
      this.perform(action, false);
    } else if (action === 'soft') {
      this.softTime = 0;
      this.softNext = this.getSettings().soft;
      this.perform(action, this.getSettings().soft === 0);
    } else this.perform(action, false);
  }
  release(action) {
    this.held.delete(action);
    if (action === this.direction) {
      const other = action === 'left' ? 'right' : 'left';
      this.direction = this.held.has(other) ? other : null;
      this.horizontalTime = 0;
      this.horizontalNext = this.getSettings().das;
      if (this.direction) this.perform(this.direction, false);
    }
  }
  step(dt, { maxHorizontalRepeats = 32 } = {}) {
    const {das, arr, soft} = this.getSettings();
    if (this.direction) {
      this.horizontalTime += dt;
      if (arr === 0) {
        if (this.horizontalTime >= das) this.perform(this.direction, true);
      } else {
        let guard = 0;
        const maxRepeats = Math.max(1, Math.min(32, Math.floor(maxHorizontalRepeats) || 1));
        while (this.horizontalTime + 1e-7 >= this.horizontalNext && guard++ < maxRepeats) {
          this.perform(this.direction, false);
          this.horizontalNext += arr;
        }
        // Do not replay delayed horizontal presses in a burst after a missed frame.
        if (maxRepeats < 32 && this.horizontalTime + 1e-7 >= this.horizontalNext) {
          this.horizontalNext = this.horizontalTime + arr;
        }
      }
    }
    if (this.held.has('soft')) {
      this.softTime += dt;
      if (soft === 0) this.perform('soft', true);
      else {
        let guard = 0;
        while (this.softTime + 1e-7 >= this.softNext && guard++ < 32) {
          this.perform('soft', false); this.softNext += soft;
        }
      }
    }
  }
}
