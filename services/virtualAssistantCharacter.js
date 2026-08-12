(function (global) {
  "use strict";

  const STATES = Object.freeze(["loading", "appear", "idle", "idle-look-around", "greeting", "listening", "thinking", "speaking", "explaining", "pointing", "celebrating", "warning", "sleeping", "minimized", "goodbye"]);
  class CharacterAdapter {
    constructor(host, options = {}) {
      this.host = host;
      this.options = options;
      this.state = "loading";
      this.frame = 0;
      this.last = 0;
      this.hidden = document.hidden;
      this.pointer = { x: 0, y: 0 };
      this.quality = options.quality || "balanced";
      this.samples = [];
      this.downgraded = false;
      this.visibilityHandler = () => {
        this.hidden = document.hidden;
        if (!this.hidden) this.start();
        else { cancelAnimationFrame(this.frame); this.frame = 0; }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    async load() {
      const renderer = global.HHCharacter3DRenderer;
      if (renderer?.mount) {
        try {
          this.renderer = await renderer.mount(this.host, this.options);
          this.host.dataset.hvaAsset = this.options.modelUrl ? "procedural-3d-ready-for-model" : "procedural-3d";
          this.host.querySelector("[data-hva-character-image]")?.setAttribute("hidden", "");
        } catch {
          this.renderer = null;
        }
      }
      if (!this.renderer) {
        const img = this.host.querySelector("[data-hva-character-image]");
        if (img) { img.hidden = false; img.src = this.options.fallbackImage || "assets/hikari-h/hikari-h-original-v1-alpha.webp"; }
        this.host.dataset.hvaAsset = "original-2d-fallback";
      }
      this.setState("appear");
      setTimeout(() => this.state === "appear" && this.setState("idle"), 650);
      this.start();
      return this.host.dataset.hvaAsset;
    }

    setState(next) {
      if (!STATES.includes(next)) return false;
      this.host.dataset.hvaState = next;
      this.host.classList.add("is-crossfading");
      this.state = next;
      this.renderer?.setState?.(next, { crossfade: 360 });
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = setTimeout(() => this.host?.classList.remove("is-crossfading"), 420);
      return true;
    }

    setPointer(clientX, clientY) {
      const x = Math.max(-1, Math.min(1, (clientX / innerWidth - .5) * 2));
      const y = Math.max(-1, Math.min(1, (clientY / innerHeight - .5) * 2));
      this.pointer = { x, y };
      this.host.style.setProperty("--hva-look-x", `${x * 4.5}deg`);
      this.host.style.setProperty("--hva-look-y", `${y * -2.8}deg`);
      this.renderer?.lookAt?.(x, y);
    }

    lip(value = 0) {
      this.host.style.setProperty("--hva-mouth", String(Math.max(0, Math.min(1, Number(value) || 0))));
      this.renderer?.setViseme?.("aa", value);
    }

    start() {
      if (this.hidden || this.frame) return;
      if (this.quality === "static") { this.renderer?.update?.(1 / 60, { force: true }); return; }
      const tick = (now) => {
        this.frame = 0;
        if (this.hidden || !this.host?.isConnected) return;
        const delta = Math.min(.05, Math.max(0, (now - (this.last || now)) / 1000));
        this.last = now;
        this.renderer?.update?.(delta);
        if (delta > 0) {
          this.samples.push(1 / delta);
          if (this.samples.length > 180) this.samples.shift();
          if (!this.downgraded && this.samples.length >= 120 && this.samples.reduce((a, b) => a + b, 0) / this.samples.length < 35) {
            this.downgraded = true;
            this.quality = this.quality === "cinematic" ? "balanced" : "static";
            this.host.dataset.hvaQuality = this.quality;
            this.renderer?.setQuality?.(this.quality);
          }
        }
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }

    destroy() {
      cancelAnimationFrame(this.frame);
      clearTimeout(this.crossfadeTimer);
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.renderer?.dispose?.();
      this.renderer = null;
      this.host = null;
    }
  }

  global.HHVirtualAssistantCharacter = Object.freeze({ STATES, CharacterAdapter });
})(window);
