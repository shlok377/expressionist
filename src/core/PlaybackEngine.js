/**
 * Deep Playback Engine Module.
 * Decouples 60 FPS clock driving, Playhead boundary invariants,
 * scrubbing, and frame subscriptions from the canvas rendering loop.
 */
export class PlaybackEngine {
  constructor({
    initialTime = 0,
    totalDuration = 0,
    clock = null,
  } = {}) {
    this.playhead = Math.max(0, initialTime);
    this.totalDuration = Math.max(0, totalDuration);
    this.isPlaying = false;

    // Clock adapter for browser or headless/test execution
    this.clock = clock || {
      requestFrame: (cb) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(cb) : setTimeout(cb, 16)),
      cancelFrame: (id) => (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame(id) : clearTimeout(id)),
      now: () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
    };

    this.frameId = null;
    this.lastTime = 0;

    // Coarse-grained state subscribers (React UI, play/pause buttons)
    this.stateSubscribers = new Set();

    // High-frequency 60 FPS frame subscribers (GPU translate3d, dirty-checked canvas)
    this.frameSubscribers = new Set();
  }

  _notifyState() {
    const state = this.getState();
    for (const listener of this.stateSubscribers) {
      try {
        listener(state);
      } catch (err) {
        console.error('PlaybackEngine state subscriber error:', err);
      }
    }
  }

  _notifyFrame(time) {
    for (const listener of this.frameSubscribers) {
      try {
        listener(time);
      } catch (err) {
        console.error('PlaybackEngine frame subscriber error:', err);
      }
    }
  }

  _startLoop() {
    if (this.frameId !== null) return;
    this.lastTime = this.clock.now();

    const loop = (currentTime) => {
      if (!this.isPlaying) return;

      const now = currentTime || this.clock.now();
      const deltaSeconds = (now - this.lastTime) / 1000;
      this.lastTime = now;

      const nextPlayhead = this.playhead + deltaSeconds;

      // Invariant: Stop and reset to 0:00 when playback reaches sequence end
      if (nextPlayhead >= this.totalDuration) {
        this.pause();
        this.seek(0);
        return;
      }

      this.playhead = nextPlayhead;

      // 60 FPS frame update to subscribers (bypasses React render loop)
      this._notifyFrame(nextPlayhead);

      this.frameId = this.clock.requestFrame(loop);
    };

    this.frameId = this.clock.requestFrame(loop);
  }

  _stopLoop() {
    if (this.frameId !== null) {
      this.clock.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      playhead: this.playhead,
      totalDuration: this.totalDuration,
    };
  }

  getTime() {
    return this.playhead;
  }

  getTotalDuration() {
    return this.totalDuration;
  }

  play() {
    if (this.isPlaying || this.totalDuration <= 0) return;

    // Reset to start if currently at or beyond end
    if (this.playhead >= this.totalDuration) {
      this.playhead = 0;
      this._notifyFrame(0);
    }

    this.isPlaying = true;
    this._startLoop();
    this._notifyState();
  }

  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this._stopLoop();
    this._notifyState();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time) {
    const clamped = Math.max(0, Math.min(this.totalDuration, time));
    this.playhead = clamped;
    this._notifyFrame(clamped);
    this._notifyState();
  }

  step(deltaSeconds) {
    const next = Math.max(0, Math.min(this.totalDuration, Math.round((this.playhead + deltaSeconds) * 100) / 100));
    this.seek(next);
  }

  setTotalDuration(duration) {
    const newTotal = Math.max(0, duration);
    this.totalDuration = newTotal;

    if (this.playhead > newTotal) {
      this.seek(newTotal);
    } else {
      this._notifyState();
    }
  }

  /**
   * Subscribe to coarse-grained state changes (play, pause, seek, duration).
   */
  subscribe(listener) {
    this.stateSubscribers.add(listener);
    return () => this.stateSubscribers.delete(listener);
  }

  /**
   * Subscribe to high-frequency 60 FPS frame ticks.
   * Directly passes the current playhead timestamp without React re-rendering.
   */
  subscribeFrame(listener) {
    this.frameSubscribers.add(listener);
    return () => this.frameSubscribers.delete(listener);
  }

  destroy() {
    this.pause();
    this.stateSubscribers.clear();
    this.frameSubscribers.clear();
  }
}
