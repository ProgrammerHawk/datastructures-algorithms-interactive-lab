/* Frame player: every algorithm compiles to a list of frames, and this
 * drives play / pause / step / scrub uniformly across all lessons. */
(function () {
  const DSA = (window.DSA = window.DSA || {});

  DSA.Player = class Player {
    constructor(opts) {
      this.frames = [];
      this.i = 0;
      this.speed = 1;
      this.timer = null;
      this.onFrame = opts.onFrame || function () {};
      this.onUpdate = opts.onUpdate || function () {};
      this.onEnd = opts.onEnd || function () {};
    }

    get baseDelay() { return 900; }
    get playing() { return this.timer != null; }
    get length() { return this.frames.length; }
    get current() { return this.frames[this.i]; }

    load(frames, opts) {
      this.pause();
      this.frames = frames && frames.length ? frames : [];
      this.i = 0;
      this.emit();
      if (opts && opts.autoplay && this.frames.length > 1) this.play();
    }

    emit() {
      if (this.frames.length) this.onFrame(this.frames[this.i], this.i);
      this.onUpdate(this);
    }

    next() {
      if (this.i < this.frames.length - 1) {
        this.i++;
        this.emit();
        return true;
      }
      return false;
    }

    prev() {
      this.pause();
      if (this.i > 0) { this.i--; this.emit(); }
    }

    seek(i) {
      this.pause();
      this.i = Math.max(0, Math.min(i, this.frames.length - 1));
      this.emit();
    }

    play() {
      if (this.playing || this.frames.length < 2) return;
      if (this.i >= this.frames.length - 1) this.i = 0;
      const tick = () => {
        if (!this.next()) { this.pause(); this.onEnd(); }
      };
      this.timer = setInterval(tick, this.baseDelay / this.speed);
      this.onUpdate(this);
    }

    pause() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; this.onUpdate(this); }
    }

    toggle() { this.playing ? this.pause() : this.play(); }

    restart() {
      this.pause();
      this.i = 0;
      this.emit();
    }

    setSpeed(s) {
      this.speed = s;
      if (this.playing) { this.pause(); this.play(); }
    }
  };
})();
