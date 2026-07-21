(() => {
  "use strict";

  const SOUND_KEY = "hh.auth.sound-enabled";
  const VALID_STATES = new Set(["idle", "focus", "caps-lock", "offline", "authenticating", "success", "error"]);
  const STATE_LABELS = {
    idle: "Logo HH đang chờ",
    focus: "Logo HH đang theo dõi trường được chọn",
    "caps-lock": "Caps Lock đang bật",
    offline: "Kết nối đang ngoại tuyến",
    authenticating: "Đang xác thực tài khoản",
    success: "Đăng nhập thành công",
    error: "Xác thực chưa thành công"
  };

  let instance = null;

  const readSoundPreference = () => {
    try { return localStorage.getItem(SOUND_KEY) !== "false"; }
    catch { return true; }
  };

  const writeSoundPreference = (enabled) => {
    try { localStorage.setItem(SOUND_KEY, String(Boolean(enabled))); }
    catch { /* Local storage can be disabled in private browsing modes. */ }
  };

  const init = () => {
    if (instance) return instance;
    const gate = document.querySelector("#authGate");
    if (!gate) return null;

    const logoHosts = [...gate.querySelectorAll(".auth-brand-lockup .brand-mark, .auth-card-heading > span")]
      .filter((host) => !host.hasAttribute("data-emotional-logo-ready"));
    if (!logoHosts.length) return null;

    const card = gate.querySelector("[data-auth-card], .auth-gate-card");
    const footer = card?.querySelector(".auth-card-footer");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    const cleanupTasks = [];
    const riveRecords = [];
    let currentState = "idle";
    let forcedState = "";
    let capsLockActive = false;
    let realtimeOffline = false;
    let userInteracted = false;
    let soundEnabled = readSoundPreference();
    let audioContext = null;
    let audioMaster = null;
    let stateTimer = 0;
    let destroyed = false;

    const listen = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      cleanupTasks.push(() => target.removeEventListener(type, handler, options));
    };

    logoHosts.forEach((host) => {
      host.classList.add("auth-emotional-logo-host");
      host.setAttribute("data-emotional-logo-ready", "true");
      host.insertAdjacentHTML("beforeend", `
        <span class="auth-emotional-aura" aria-hidden="true"></span>
        <span class="auth-emotional-portal" aria-hidden="true"></span>
        <span class="auth-emotional-logo-fallback" aria-hidden="true">
          <span class="auth-emotional-eye auth-emotional-eye--left"><i></i></span>
          <span class="auth-emotional-eye auth-emotional-eye--right"><i></i></span>
          <span class="auth-emotional-mouth"></span>
        </span>`);
    });

    const liveRegion = document.createElement("span");
    liveRegion.className = "auth-emotional-live";
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    gate.append(liveRegion);

    const soundButton = document.createElement("button");
    soundButton.className = "auth-emotional-sound-toggle";
    soundButton.type = "button";
    soundButton.dataset.authSoundToggle = "";
    if (footer) footer.append(soundButton);
    else card?.append(soundButton);

    const syncSoundButton = () => {
      soundButton.setAttribute("aria-pressed", String(soundEnabled));
      soundButton.setAttribute("aria-label", soundEnabled ? "Tắt âm nhận diện của logo HH" : "Bật âm nhận diện của logo HH");
      soundButton.textContent = soundEnabled ? "Âm logo: Bật" : "Âm logo: Tắt";
    };

    const markInteraction = () => {
      userInteracted = true;
    };

    const ensureAudio = () => {
      if (!userInteracted || !soundEnabled || document.visibilityState !== "visible") return null;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        audioMaster = audioContext.createGain();
        audioMaster.gain.value = .13;
        audioMaster.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
      return audioContext;
    };

    const playSignature = (variant = "success") => {
      const context = ensureAudio();
      if (!context || !audioMaster) return false;

      const now = context.currentTime + .015;
      const duration = 1.28;
      const panner = context.createPanner();
      panner.panningModel = "equalpower";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 12;
      panner.rolloffFactor = .5;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(-.42, now);
        panner.positionX.linearRampToValueAtTime(.42, now + duration);
        panner.positionY.setValueAtTime(0, now);
        panner.positionZ.setValueAtTime(-.7, now);
      } else panner.setPosition(-.42, 0, -.7);

      const bus = context.createGain();
      bus.gain.setValueAtTime(.0001, now);
      bus.gain.exponentialRampToValueAtTime(1, now + .055);
      bus.gain.setValueAtTime(1, now + .72);
      bus.gain.exponentialRampToValueAtTime(.0001, now + duration);
      bus.connect(panner);
      panner.connect(audioMaster);

      const notes = variant === "enable" ? [392, 523.25, 659.25] : [440, 659.25, 880];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const noteGain = context.createGain();
        const start = now + index * .16;
        oscillator.type = index === 1 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.015, start + .42);
        noteGain.gain.setValueAtTime(.0001, start);
        noteGain.gain.exponentialRampToValueAtTime(index === 2 ? .34 : .26, start + .035);
        noteGain.gain.exponentialRampToValueAtTime(.0001, Math.min(now + duration, start + .84));
        oscillator.connect(noteGain);
        noteGain.connect(bus);
        oscillator.start(start);
        oscillator.stop(now + duration + .04);
      });

      window.setTimeout(() => {
        try { bus.disconnect();panner.disconnect(); }
        catch { /* Nodes may already be disconnected during page teardown. */ }
      }, Math.ceil((duration + .12) * 1000));
      return true;
    };

    const setGaze = (target) => {
      if (!target || reducedMotion?.matches) {
        logoHosts.forEach((host) => {
          host.style.setProperty("--auth-gaze-x", "0px");
          host.style.setProperty("--auth-gaze-y", "0px");
          host.style.setProperty("--auth-logo-tilt-x", "0deg");
          host.style.setProperty("--auth-logo-tilt-y", "0deg");
        });
        updateRiveGaze(0, 0);
        return;
      }

      const targetRect = target.getBoundingClientRect();
      logoHosts.forEach((host) => {
        const hostRect = host.getBoundingClientRect();
        const horizontal = Math.max(-1, Math.min(1, (targetRect.left + targetRect.width / 2 - hostRect.left - hostRect.width / 2) / Math.max(innerWidth * .34, 1)));
        const vertical = Math.max(-1, Math.min(1, (targetRect.top + targetRect.height / 2 - hostRect.top - hostRect.height / 2) / Math.max(innerHeight * .32, 1)));
        host.style.setProperty("--auth-gaze-x", `${(horizontal * 2.6).toFixed(2)}px`);
        host.style.setProperty("--auth-gaze-y", `${(vertical * 1.9).toFixed(2)}px`);
        host.style.setProperty("--auth-logo-tilt-x", `${(-vertical * 2.2).toFixed(2)}deg`);
        host.style.setProperty("--auth-logo-tilt-y", `${(horizontal * 2.8).toFixed(2)}deg`);
        updateRiveGaze(horizontal, vertical);
      });
    };

    const normalizedInputName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const updateRiveGaze = (x, y) => {
      riveRecords.forEach((record) => {
        record.inputs.forEach((input) => {
          const name = normalizedInputName(input.name);
          if (name === "gazex" || name === "lookx") input.value = x;
          if (name === "gazey" || name === "looky") input.value = y;
        });
      });
    };

    const updateRiveState = (state) => {
      riveRecords.forEach((record) => {
        record.inputs.forEach((input) => {
          const name = normalizedInputName(input.name);
          if (name === "state" && typeof input.value === "number") input.value = [...VALID_STATES].indexOf(state);
          else if (VALID_STATES.has(name.replace("capslock", "caps-lock")) && "value" in input) {
            input.value = name.replace("capslock", "caps-lock") === state;
          } else if (name === normalizedInputName(state) && typeof input.fire === "function") input.fire();
        });
      });
    };

    const attachRive = ({ src, stateMachine = "Auth Logo" } = {}) => {
      const RiveClass = window.rive?.Rive || window.Rive;
      const asset = src || gate.dataset.authRiveSrc || window.HH_AUTH_RIVE_ASSET || "";
      if (!RiveClass || !asset || riveRecords.length) return false;

      const host = logoHosts[0];
      if (!host) return false;
      const canvas = document.createElement("canvas");
      canvas.className = "auth-emotional-rive";
      canvas.setAttribute("aria-hidden", "true");
      canvas.width = Math.max(96, Math.round(host.clientWidth * (devicePixelRatio || 1)));
      canvas.height = Math.max(96, Math.round(host.clientHeight * (devicePixelRatio || 1)));
      host.append(canvas);

      try {
        let record = null;
        const riveInstance = new RiveClass({
          src: asset,
          canvas,
          autoplay: document.visibilityState === "visible" && !reducedMotion?.matches,
          stateMachines: stateMachine,
          onLoad: () => {
            const inputs = riveInstance.stateMachineInputs?.(stateMachine) || [];
            record = { host, canvas, instance: riveInstance, inputs };
            riveRecords.push(record);
            host.classList.add("has-rive");
            riveInstance.resizeDrawingSurfaceToCanvas?.();
            updateRiveState(currentState);
          }
        });
        return true;
      } catch {
        canvas.remove();
        return false;
      }
    };

    const deriveState = () => {
      if (forcedState) return forcedState;
      const cardState = card?.dataset.authState || "";
      const gateStatus = gate.dataset.authStatus || "";
      if (gate.classList.contains("auth-success") || gate.classList.contains("is-auth-success") || cardState === "success" || gateStatus === "success") return "success";
      if (card?.classList.contains("auth-authenticating") || gate.querySelector(".auth-authenticating, [aria-busy='true']")) return "authenticating";
      if (cardState === "error" || gateStatus === "error" || gate.querySelector("[aria-invalid='true']")) return "error";
      if (!navigator.onLine || realtimeOffline) return "offline";
      if (capsLockActive) return "caps-lock";
      if (gate.contains(document.activeElement) && document.activeElement !== document.body) return "focus";
      return "idle";
    };

    const applyState = (nextState, { announce = false } = {}) => {
      const state = VALID_STATES.has(nextState) ? nextState : "idle";
      const previous = currentState;
      currentState = state;
      gate.dataset.emotionalState = state;
      logoHosts.forEach((host) => { host.dataset.emotionalState = state; });
      updateRiveState(state);
      if ((announce || ["success", "error", "offline"].includes(state)) && previous !== state) liveRegion.textContent = STATE_LABELS[state];
      if (state === "success" && previous !== "success") playSignature("success");
      return state;
    };

    const syncState = () => applyState(deriveState());

    const setForcedState = (state, { duration = 0, announce = true } = {}) => {
      if (stateTimer) window.clearTimeout(stateTimer);
      stateTimer = 0;
      forcedState = VALID_STATES.has(state) ? state : "";
      applyState(forcedState || deriveState(), { announce });
      if (forcedState && duration > 0) {
        stateTimer = window.setTimeout(() => {
          forcedState = "";
          stateTimer = 0;
          syncState();
        }, duration);
      }
    };

    const handleFocusIn = (event) => {
      setGaze(event.target);
      syncState();
    };
    const handleFocusOut = (event) => {
      if (!event.relatedTarget || !gate.contains(event.relatedTarget)) setGaze(null);
      window.setTimeout(syncState, 0);
    };
    const handleCapsLock = (event) => {
      if (!event.target?.matches?.('input[type="password"]') || typeof event.getModifierState !== "function") return;
      capsLockActive = event.getModifierState("CapsLock");
      syncState();
    };
    const clearCapsLock = (event) => {
      if (!event.target?.matches?.('input[type="password"]')) return;
      capsLockActive = false;
      syncState();
    };
    const handleVisibility = () => {
      const hidden = document.visibilityState !== "visible";
      gate.classList.toggle("is-emotional-paused", hidden || Boolean(reducedMotion?.matches));
      riveRecords.forEach((record) => {
        if (hidden || reducedMotion?.matches) record.instance.pause?.();
        else record.instance.play?.();
      });
    };

    listen(gate, "pointerdown", markInteraction, { passive: true });
    listen(gate, "keydown", markInteraction);
    listen(gate, "focusin", handleFocusIn);
    listen(gate, "focusout", handleFocusOut);
    listen(gate, "keydown", handleCapsLock);
    listen(gate, "keyup", handleCapsLock);
    listen(gate, "focusout", clearCapsLock);
    listen(window, "online", () => { realtimeOffline = false;syncState(); });
    listen(window, "offline", () => syncState());
    listen(window, "hh:realtime-offline", () => { realtimeOffline = true;syncState(); });
    listen(window, "hh:realtime-ready", () => { realtimeOffline = false;syncState(); });
    listen(gate, "hh:auth-success", () => setForcedState("success", { duration: 1150 }));
    listen(window, "hh:rive-ready", () => attachRive());
    listen(document, "visibilitychange", handleVisibility);
    if (reducedMotion?.addEventListener) listen(reducedMotion, "change", handleVisibility);
    else if (reducedMotion?.addListener) {
      reducedMotion.addListener(handleVisibility);
      cleanupTasks.push(() => reducedMotion.removeListener(handleVisibility));
    }

    listen(soundButton, "click", () => {
      markInteraction();
      soundEnabled = !soundEnabled;
      writeSoundPreference(soundEnabled);
      if (audioMaster && audioContext) audioMaster.gain.setTargetAtTime(soundEnabled ? .13 : .0001, audioContext.currentTime, .015);
      syncSoundButton();
      liveRegion.textContent = soundEnabled ? "Đã bật âm nhận diện logo HH" : "Đã tắt âm nhận diện logo HH";
      if (soundEnabled) playSignature("enable");
    });

    const observer = new MutationObserver(() => {
      if (!gate.isConnected) destroy();
      else syncState();
    });
    observer.observe(gate, {
      attributes: true,
      attributeFilter: ["class", "data-auth-status"],
      childList: true,
      subtree: true
    });

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      if (stateTimer) window.clearTimeout(stateTimer);
      cleanupTasks.splice(0).forEach((cleanup) => cleanup());
      riveRecords.splice(0).forEach((record) => {
        record.instance.cleanup?.();
        record.instance.stop?.();
        record.canvas.remove();
        record.host.classList.remove("has-rive");
      });
      logoHosts.forEach((host) => {
        host.querySelectorAll(".auth-emotional-aura, .auth-emotional-portal, .auth-emotional-logo-fallback").forEach((node) => node.remove());
        host.classList.remove("auth-emotional-logo-host");
        host.removeAttribute("data-emotional-logo-ready");
        host.removeAttribute("data-emotional-state");
        host.style.removeProperty("--auth-gaze-x");
        host.style.removeProperty("--auth-gaze-y");
        host.style.removeProperty("--auth-logo-tilt-x");
        host.style.removeProperty("--auth-logo-tilt-y");
      });
      soundButton.remove();
      liveRegion.remove();
      delete gate.dataset.emotionalState;
      if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => {});
      audioContext = null;
      audioMaster = null;
      instance = null;
    };

    listen(window, "pagehide", (event) => {
      if (!event.persisted) destroy();
    });

    syncSoundButton();
    handleVisibility();
    syncState();
    attachRive();

    instance = Object.freeze({
      available: true,
      setState: setForcedState,
      clearState: () => setForcedState(""),
      getState: () => currentState,
      playSignature,
      setSoundEnabled: (enabled) => {
        soundEnabled = Boolean(enabled);
        writeSoundPreference(soundEnabled);
        if (audioMaster && audioContext) audioMaster.gain.setTargetAtTime(soundEnabled ? .13 : .0001, audioContext.currentTime, .015);
        syncSoundButton();
        return soundEnabled;
      },
      isSoundEnabled: () => soundEnabled,
      attachRive,
      destroy
    });
    window.HHEmotionalLogo = instance;
    return instance;
  };

  const boot = () => {
    if (!document.querySelector("#authGate")) {
      window.HHEmotionalLogo = Object.freeze({ available: false });
      return;
    }
    init();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
