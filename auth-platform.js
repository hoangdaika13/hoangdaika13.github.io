(() => {
  "use strict";

  const GUEST_KEY = "hh.auth.guest";
  const LAST_PROFILE_KEY = "hh.auth.last-profile";
  const STREAK_KEY = "hh.auth.login-streak";
  let memoryToken = "";
  let initialized = false;
  let qrPoll = 0;
  let credentialedFetchInstalled = false;
  let turnstileLoader = null;

  const token = () => memoryToken;
  const setToken = (value = "") => {
    memoryToken = String(value || "");
  };

  const fromBase64Url = (value) => {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  };

  const toBase64Url = (value) => {
    const bytes = new Uint8Array(value || []);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const credentialJSON = (credential) => ({
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
    response: {
      clientDataJSON: toBase64Url(credential.response.clientDataJSON),
      authenticatorData: credential.response.authenticatorData ? toBase64Url(credential.response.authenticatorData) : undefined,
      signature: credential.response.signature ? toBase64Url(credential.response.signature) : undefined,
      userHandle: credential.response.userHandle ? toBase64Url(credential.response.userHandle) : undefined,
      attestationObject: credential.response.attestationObject ? toBase64Url(credential.response.attestationObject) : undefined,
      transports: credential.response.getTransports?.() || undefined
    }
  });

  const publicKeyOptions = (options = {}) => ({
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: options.user ? { ...options.user, id: fromBase64Url(options.user.id) } : undefined,
    allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: fromBase64Url(item.id) })),
    excludeCredentials: options.excludeCredentials?.map((item) => ({ ...item, id: fromBase64Url(item.id) }))
  });

  const readJSON = (storage, key, fallback = null) => {
    try { return JSON.parse(storage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };

  const writePublicProfile = (user) => {
    if (!user) return;
    const profile = {
      id: user.id || "",
      name: user.name || user.email || "Thành viên HH",
      email: user.email || "",
      avatar: user.avatar || "",
      nickname: user.nickname || "",
      creativeColor: user.creativeColor || "#f05caf",
      interests: Array.isArray(user.interests) ? user.interests : [],
      roles: Array.isArray(user.roles) ? user.roles : [],
      guest: Boolean(user.guest),
      lastWorkspace: user.lastWorkspace || localStorage.getItem("hh.auth.last-workspace") || "Command Center",
      lastSeenAt: new Date().toISOString()
    };
    localStorage.setItem("hh-auth-user", JSON.stringify(profile));
    if (!profile.guest) localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem("hh-chat-last-name", profile.name);
  };

  const installCredentialedFetch = (backendOrigin) => {
    if (credentialedFetchInstalled || !backendOrigin) return;
    credentialedFetchInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const target = typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
      if (!target.startsWith(backendOrigin)) return nativeFetch(input, init);
      return nativeFetch(input, { credentials: "include", ...init });
    };
  };

  const recordLoginStreak = () => {
    const state = readJSON(localStorage, STREAK_KEY, { count: 0, lastDate: "" });
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.lastDate !== today) state.count = state.lastDate === yesterday ? Number(state.count || 0) + 1 : 1;
    state.lastDate = today;
    localStorage.setItem(STREAK_KEY, JSON.stringify(state));
    return state.count;
  };

  const compressAvatar = (file) => new Promise((resolve, reject) => {
    if (!file || file.size > 2 * 1024 * 1024) return reject(new Error("Ảnh đại diện cần nhỏ hơn 2 MB."));
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      const scale = Math.max(160 / image.width, 160 / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (160 - width) / 2, (160 - height) / 2, width, height);
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL("image/webp", 0.78));
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("Không thể đọc ảnh đã chọn.")); };
    image.src = source;
  });

  function init({ realtimeUrl = "", socketUrl = "", randomId = () => crypto.randomUUID() } = {}) {
    if (initialized) return;
    initialized = true;
    installCredentialedFetch(realtimeUrl);

    const gate = document.querySelector("#authGate");
    const appShell = document.querySelector("#appShell");
    const statusNode = document.querySelector("#authGateStatus");
    const statusText = statusNode?.querySelector("span") || statusNode;
    const loginForm = document.querySelector("#gateLoginForm");
    const registerForm = document.querySelector("#gateRegisterForm");
    const logoutButton = document.querySelector("#logoutButton");
    const online = document.querySelector("#onlineCount");
    const note = document.querySelector("#realtimeNote");
    const consent = document.querySelector("#trackingConsent");
    if (!gate || !loginForm || !registerForm) return;

    let user = null;
    let socket = null;
    let oauthProviders = {};
    let signupStep = 1;
    let emailTimer = 0;
    let captchaToken = "";
    let captchaWidgetId = null;
    const anonymousIdKey = "hh-anonymous-id";
    let anonymousId = localStorage.getItem(anonymousIdKey);
    if (!anonymousId) {
      anonymousId = randomId();
      localStorage.setItem(anonymousIdKey, anonymousId);
    }

    const setStatus = (message, kind = "info") => {
      if (statusText) statusText.textContent = message;
      statusNode?.classList.toggle("is-error", kind === "error");
      statusNode?.classList.toggle("is-success", kind === "success");
      gate.dataset.authStatus = kind;
      const authCard = gate.querySelector("[data-auth-card]");
      if (authCard) authCard.dataset.authState = kind;
      window.HHAuthExperience?.setStatus?.(message, kind);
    };

    const setOAuthError = (message) => {
      setStatus(message, "error");
      loginForm.querySelectorAll("input, button").forEach((control) => { control.disabled = false; });
      loginForm.querySelector('[name="email"]')?.focus();
    };

    const setBusy = (form, busy, message = "Đang xác thực...") => {
      form?.classList.toggle("auth-authenticating", busy);
      form?.querySelectorAll("button, input, select").forEach((control) => {
        if (control.matches("[data-password-toggle]")) return;
        control.disabled = busy;
      });
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) {
        const label = submit.querySelector("span") || submit;
        if (!submit.dataset.idleLabel) submit.dataset.idleLabel = label.textContent.trim();
        label.textContent = busy ? message : submit.dataset.idleLabel;
        submit.setAttribute("aria-busy", String(busy));
      }
    };

    const clearErrors = (form) => {
      form?.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
      form?.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    };

    const fieldError = (form, name, message) => {
      const input = form?.querySelector(`[name="${name}"]`);
      const error = form?.querySelector(`[data-field-error="${name}"]`) || input?.closest(".auth-field")?.querySelector("[data-field-error]");
      if (input) input.setAttribute("aria-invalid", "true");
      if (error) error.textContent = message;
      input?.focus();
      setStatus(message, "error");
      return false;
    };

    const api = async (path, options = {}) => {
      if (!realtimeUrl) throw new Error("Backend đăng nhập chưa được cấu hình.");
      const response = await fetch(`${realtimeUrl}${path}`, {
        ...options,
        credentials: "include",
        cache: "no-store",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          ...(options.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || "Không thể kết nối máy chủ.");
        error.code = data.code || "";
        error.status = response.status;
        error.fields = data.fields || {};
        throw error;
      }
      return data;
    };

    const loadTurnstile = () => {
      if (window.turnstile) return Promise.resolve(window.turnstile);
      if (turnstileLoader) return turnstileLoader;
      turnstileLoader = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.turnstile);
        script.onerror = () => reject(new Error("Không tải được bước xác minh bảo mật."));
        document.head.append(script);
      });
      return turnstileLoader;
    };

    const showAdaptiveCaptcha = async () => {
      const panel = loginForm.querySelector("[data-auth-captcha]");
      const mount = panel?.querySelector("[data-turnstile-widget]");
      const sitekey = oauthProviders.turnstileSiteKey;
      if (!panel || !mount || !sitekey) throw new Error("Máy chủ chưa cấu hình đầy đủ CAPTCHA thích ứng.");
      panel.hidden = false;
      const turnstile = await loadTurnstile();
      if (captchaWidgetId !== null) turnstile.reset(captchaWidgetId);
      else captchaWidgetId = turnstile.render(mount, {
        sitekey,
        theme: "dark",
        size: "flexible",
        callback: (value) => { captchaToken = value; setStatus("Xác minh bảo mật hoàn tất. Bạn có thể đăng nhập lại.", "success"); },
        "expired-callback": () => { captchaToken = ""; },
        "error-callback": () => { captchaToken = ""; setStatus("Không thể xác minh bảo mật. Hãy thử lại.", "error"); }
      });
      mount.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    };

    const showPanel = (name) => {
      const authForms = gate.querySelector(".auth-gate-forms");
      const social = gate.querySelector(".auth-social-row");
      const divider = gate.querySelector(".auth-divider");
      const tabs = gate.querySelector(".auth-mode-tabs");
      const recovery = gate.querySelector("[data-forgot-panel]");
      const qr = gate.querySelector("[data-qr-panel]");
      const emailVerify = gate.querySelector("[data-email-verify-panel]");
      const special = name === "recovery" || name === "qr" || name === "verify-email";
      [authForms, social, divider, tabs].forEach((node) => { if (node) node.hidden = special; });
      if (recovery) recovery.hidden = name !== "recovery";
      if (qr) qr.hidden = name !== "qr";
      if (emailVerify) emailVerify.hidden = name !== "verify-email";
      if (!special) selectAuthPanel(name);
    };

    const selectAuthPanel = (name) => {
      gate.querySelectorAll("[data-auth-tab]").forEach((tab) => {
        const active = tab.dataset.authTab === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      gate.querySelectorAll("[data-auth-panel]").forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
      clearErrors(name === "login" ? loginForm : registerForm);
      setStatus(name === "register" ? "Tạo HH ID miễn phí trong 3 bước." : "Sẵn sàng đăng nhập an toàn.");
    };

    const setSignupStep = (step) => {
      signupStep = Math.min(3, Math.max(1, Number(step) || 1));
      registerForm.querySelectorAll("[data-signup-step]").forEach((panel) => { panel.hidden = Number(panel.dataset.signupStep) !== signupStep; });
      registerForm.querySelectorAll("[data-signup-step-nav]").forEach((button) => {
        const current = Number(button.dataset.signupStepNav);
        button.classList.toggle("active", current === signupStep);
        button.classList.toggle("complete", current < signupStep);
        button.setAttribute("aria-current", current === signupStep ? "step" : "false");
      });
      window.HHAuthExperience?.setSignupStep?.(signupStep);
      const active = registerForm.querySelector(`[data-signup-step="${signupStep}"]`);
      active?.querySelector("input:not([type=hidden]), button")?.focus({ preventScroll: true });
    };

    const validateStep = (step) => {
      clearErrors(registerForm);
      const data = new FormData(registerForm);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      if (step === 1) {
        if (!/^\S+@\S+\.\S+$/.test(email)) return fieldError(registerForm, "email", "Hãy nhập một địa chỉ email hợp lệ.");
        if (password.length < 8) return fieldError(registerForm, "password", "Mật khẩu cần ít nhất 8 ký tự.");
        if (password !== data.get("confirmPassword")) return fieldError(registerForm, "confirmPassword", "Mật khẩu xác nhận chưa khớp.");
      }
      if (step === 2 && String(data.get("name") || "").trim().length < 2) return fieldError(registerForm, "name", "Tên hiển thị cần ít nhất 2 ký tự.");
      return true;
    };

    const renderReturningUser = () => {
      const profile = readJSON(localStorage, LAST_PROFILE_KEY);
      const card = gate.querySelector("[data-returning-user]");
      if (!card || !profile) return;
      card.hidden = false;
      card.querySelector("[data-returning-name]").textContent = String(profile.name || "bạn").split(/\s+/).at(-1);
      card.querySelector("[data-returning-workspace]").textContent = profile.lastWorkspace || "Command Center";
      card.querySelector("[data-returning-device]").textContent = profile.lastDevice || "Thiết bị gần nhất";
      const recentProject = card.querySelector("[data-auth-recent-project]");
      if (recentProject) recentProject.textContent = `Tiếp tục ${profile.lastProjectName || "dự án gần đây"} →`;
      const avatar = card.querySelector("[data-returning-avatar]");
      if (profile.avatar) {
        avatar.style.backgroundImage = `url(${JSON.stringify(profile.avatar).slice(1, -1)})`;
        avatar.textContent = "";
      } else avatar.textContent = String(profile.name || "HH").split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
      const loginEmail = loginForm.querySelector('[name="email"]');
      if (loginEmail && !loginEmail.value) loginEmail.value = profile.email || "";
    };

    const setGateState = () => {
      const authenticated = Boolean(user);
      document.body.classList.toggle("auth-unlocked", authenticated);
      document.body.classList.toggle("auth-locked", !authenticated);
      document.body.classList.toggle("auth-authenticated", authenticated);
      document.body.classList.toggle("auth-guest", Boolean(user?.guest));
      gate.setAttribute("aria-hidden", String(authenticated));
      if (appShell) appShell.hidden = !authenticated;
      if (authenticated) {
        writePublicProfile(user);
        window.dispatchEvent(new CustomEvent("hh:auth-change", { detail: { user, token: token(), guest: Boolean(user.guest) } }));
      }
    };

    const completeAuth = async (data, message) => {
      setToken(data.token || "");
      sessionStorage.removeItem(GUEST_KEY);
      user = data.user || null;
      if (!user) throw new Error("Máy chủ không trả về hồ sơ tài khoản.");
      const streak = recordLoginStreak();
      gate.classList.add("auth-success");
      setStatus(`${message} · Chuỗi hoạt động ${streak} ngày`, "success");
      writePublicProfile(user);
      await new Promise((resolve) => setTimeout(resolve, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520));
      setGateState();
      const pendingRoute = sessionStorage.getItem("hh.auth.pending-route") || "#/home";
      sessionStorage.removeItem("hh.auth.pending-route");
      location.hash = pendingRoute;
      connectSocket();
    };

    const loadMe = async () => {
      if (sessionStorage.getItem(GUEST_KEY) === "1") {
        user = readJSON(sessionStorage, "hh.auth.guest-user", { id: "guest", name: "Khách HH", email: "", roles: [], guest: true });
        setStatus("Đang dùng chế độ khách · dữ liệu chỉ lưu trên thiết bị.", "success");
        return setGateState();
      }
      if (!realtimeUrl) return setStatus("Bạn có thể dùng thử công cụ local với chế độ khách.");
      try {
        const data = await api("/api/auth/me");
        user = data.user || null;
        if (user) {
          writePublicProfile(user);
          setStatus(`Chào mừng ${user.name || user.email} quay lại.`, "success");
        } else setStatus("Sẵn sàng đăng nhập an toàn.");
      } catch (error) {
        setToken("");
        user = null;
        const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname) && [0, 404].includes(Number(error.status || 0));
        setStatus(localPreview ? "Bản xem trước local · đăng nhập máy chủ cần Vercel, chế độ khách vẫn hoạt động." : error.message, localPreview ? "info" : "error");
      }
      setGateState();
    };

    const login = async (event) => {
      event.preventDefault();
      clearErrors(loginForm);
      if (!loginForm.reportValidity()) return;
      const data = new FormData(loginForm);
      try {
        setBusy(loginForm, true);
        setStatus("Đang xác thực tài khoản...");
        const result = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: data.get("email"), password: data.get("password"), remember: data.get("remember") === "on", captchaToken })
        });
        captchaToken = "";
        await completeAuth(result, "Đăng nhập thành công");
        loginForm.reset();
      } catch (error) {
        if (error.code === "CAPTCHA_REQUIRED") {
          try { await showAdaptiveCaptcha(); }
          catch (captchaError) { setStatus(captchaError.message, "error"); }
        }
        const field = error.status === 401 ? "password" : (error.fields?.email ? "email" : "password");
        fieldError(loginForm, field, error.message);
      } finally { setBusy(loginForm, false); }
    };

    const register = async (event) => {
      event.preventDefault();
      if (signupStep < 3) return setSignupStep(signupStep + 1);
      if (!validateStep(1) || !validateStep(2)) return;
      const data = new FormData(registerForm);
      const interests = data.getAll("interests");
      if (!interests.length) return setStatus("Hãy chọn ít nhất một lĩnh vực để cá nhân hóa.", "error");
      if (data.get("consent") !== "on") return setStatus("Bạn cần đồng ý điều khoản để tạo tài khoản.", "error");
      try {
        setBusy(registerForm, true, "Đang tạo HH ID...");
        setStatus("Đang tạo hồ sơ và gửi email xác minh...");
        const result = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: data.get("email"), password: data.get("password"), name: data.get("name"), nickname: data.get("nickname"),
            avatar: data.get("avatar"), creativeColor: data.get("creativeColor"), interests, consent: true
          })
        });
        if (result.verificationRequired) {
          setToken(result.token || "");
          user = result.user;
          gate.querySelector("[data-email-verify-address]").textContent = String(data.get("email") || "");
          const verifyStatus = gate.querySelector("[data-email-verify-status]");
          verifyStatus.textContent = result.verificationDelivery === "sent"
            ? "Mã xác minh đã được gửi. Hãy kiểm tra cả thư mục Spam."
            : "Máy chủ chưa cấu hình gửi email. Hãy thêm RESEND_API_KEY và EMAIL_FROM trên Vercel.";
          if (result.developmentCode) gate.querySelector("[data-email-verify-code]").value = result.developmentCode;
          showPanel("verify-email");
          setStatus("Tài khoản đã tạo · còn một bước xác minh email.", "success");
        } else {
          await completeAuth(result, "Tạo tài khoản thành công");
          registerForm.reset();
          setSignupStep(1);
        }
      } catch (error) {
        const field = error.status === 409 ? "email" : (error.fields?.name ? "name" : "email");
        fieldError(registerForm, field, error.message);
      } finally { setBusy(registerForm, false); }
    };

    const passkeyLogin = async () => {
      if (!window.PublicKeyCredential || !navigator.credentials) return setStatus("Trình duyệt này chưa hỗ trợ Passkey.", "error");
      const email = loginForm.querySelector('[name="email"]')?.value.trim() || "";
      try {
        setStatus("Đang chuẩn bị Passkey...");
        const options = await api("/api/auth/passkey/login/options", { method: "POST", body: JSON.stringify({ email }) });
        const credential = await navigator.credentials.get({ publicKey: publicKeyOptions(options.options || options) });
        const result = await api("/api/auth/passkey/login/verify", { method: "POST", body: JSON.stringify({ requestId: options.requestId, response: credentialJSON(credential) }) });
        await completeAuth(result, "Đăng nhập bằng Passkey thành công");
      } catch (error) { setStatus(error.name === "NotAllowedError" ? "Bạn đã hủy yêu cầu Passkey." : error.message, "error"); }
    };

    const requestRecovery = async () => {
      const panel = gate.querySelector("[data-forgot-panel]");
      const email = panel.querySelector("[data-recovery-email]").value.trim();
      const verify = panel.querySelector("[data-recovery-verify]");
      const code = panel.querySelector("[data-recovery-code]").value.trim();
      const password = panel.querySelector("[data-recovery-password]").value;
      const status = panel.querySelector("[data-recovery-status]");
      try {
        if (verify.hidden) {
          const result = await api("/api/auth/forgot-password/request", { method: "POST", body: JSON.stringify({ email }) });
          verify.hidden = false;
          panel.querySelector("[data-recovery-action]").textContent = "Xác minh và đổi mật khẩu";
          status.textContent = result.message || "Nếu email tồn tại, mã xác minh đã được gửi.";
        } else {
          const verified = await api("/api/auth/forgot-password/verify", { method: "POST", body: JSON.stringify({ email, code }) });
          const result = await api("/api/auth/forgot-password/reset", { method: "POST", body: JSON.stringify({ email, password, resetToken: verified.resetToken }) });
          status.textContent = result.message || "Đã đổi mật khẩu. Bạn có thể đăng nhập.";
          setTimeout(() => showPanel("login"), 900);
        }
      } catch (error) { status.textContent = error.message; }
    };

    const verifyEmail = async () => {
      const panel = gate.querySelector("[data-email-verify-panel]");
      const code = panel.querySelector("[data-email-verify-code]").value.trim();
      const status = panel.querySelector("[data-email-verify-status]");
      if (!/^\d{6}$/.test(code)) { status.textContent = "Hãy nhập đủ mã xác minh 6 số."; return; }
      try {
        status.textContent = "Đang xác minh...";
        await api("/api/auth/email-verification/verify", { method: "POST", body: JSON.stringify({ code }) });
        user = { ...user, emailVerified: true, verified: true };
        await completeAuth({ user, token: token() }, "Email đã xác minh");
        registerForm.reset();
        setSignupStep(1);
      } catch (error) { status.textContent = error.message; }
    };

    const resendEmailVerification = async () => {
      const panel = gate.querySelector("[data-email-verify-panel]");
      const status = panel.querySelector("[data-email-verify-status]");
      try {
        status.textContent = "Đang gửi lại mã...";
        const result = await api("/api/auth/email-verification/request", { method: "POST", body: "{}" });
        status.textContent = result.delivery === "sent" ? "Đã gửi mã mới." : "Dịch vụ email chưa được cấu hình trên máy chủ.";
        if (result.developmentCode) panel.querySelector("[data-email-verify-code]").value = result.developmentCode;
      } catch (error) { status.textContent = error.message; }
    };

    const openQr = async () => {
      showPanel("qr");
      const panel = gate.querySelector("[data-qr-panel]");
      const qr = panel.querySelector("[data-qr-code]");
      const label = panel.querySelector("[data-qr-code-text]");
      const status = panel.querySelector("[data-qr-status]");
      clearInterval(qrPoll);
      try {
        const result = await api("/api/auth/qr/create", { method: "POST", body: JSON.stringify({ returnTo: location.origin }) });
        label.textContent = result.code || result.id;
        if (result.qrDataUrl) qr.innerHTML = `<img src="${result.qrDataUrl}" alt="Mã QR đăng nhập HH">`;
        else qr.innerHTML = `<span>${String(result.code || "QR").replace(/[^A-Z0-9-]/gi, "")}</span>`;
        status.textContent = "Đang chờ điện thoại xác nhận...";
        qrPoll = setInterval(async () => {
          try {
            const state = await api(`/api/auth/qr/status?qrId=${encodeURIComponent(result.qrId)}&code=${encodeURIComponent(result.code)}`);
            if (state.status === "approved" && state.user) {
              clearInterval(qrPoll);
              await completeAuth(state, "Đăng nhập từ thiết bị khác thành công");
            } else if (state.status === "expired") {
              clearInterval(qrPoll);
              status.textContent = "Mã đã hết hạn. Hãy tạo lại.";
            }
          } catch (error) { status.textContent = error.message; }
        }, 2500);
      } catch (error) { status.textContent = error.message; }
    };

    const connectSocket = async () => {
      if (socket) socket.disconnect();
      if (!socketUrl || !window.io) return;
      socket = window.io(socketUrl, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        auth: { token: token(), anonymousId, consent: Boolean(consent?.checked), page: location.pathname, referrer: document.referrer }
      });
      window.HHRealtimeSocket = socket;
      socket.on("connect", () => window.dispatchEvent(new CustomEvent("hh:realtime-ready", { detail: { socket } })));
      socket.on("disconnect", () => window.dispatchEvent(new CustomEvent("hh:realtime-offline")));
      socket.on("site:stats", (stats) => { if (online) online.textContent = `${Number(stats.online || 0)} đang online`; });
    };

    const approveQrFromUrl = async () => {
      const params = new URLSearchParams(location.search);
      const payload = params.get("qrLogin");
      if (!payload || !user || user.guest) return;
      const [qrId, code] = payload.split(".");
      history.replaceState({}, document.title, `${location.pathname}${location.hash || "#/home"}`);
      try {
        setStatus("Đang xác nhận đăng nhập cho thiết bị khác...");
        await api("/api/auth/qr/approve", { method: "POST", body: JSON.stringify({ qrId, code }) });
        setStatus("Đã cấp quyền đăng nhập cho thiết bị kia.", "success");
      } catch (error) { setStatus(error.message, "error"); }
    };

    const exchangeOAuthCode = async () => {
      const current = new URL(location.href);
      const code = current.searchParams.get("authCode");
      if (!code) return false;
      current.searchParams.delete("authCode");
      history.replaceState({}, document.title, `${current.pathname}${current.search}${current.hash || "#/home"}`);
      try {
        setStatus("Đang hoàn tất đăng nhập Google...");
        const result = await api("/api/auth/exchange", { method: "POST", body: JSON.stringify({ code }) });
        await completeAuth(result, "Đăng nhập Google thành công");
        return true;
      } catch (error) {
        setOAuthError(error.message);
        return false;
      }
    };

    gate.querySelectorAll("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => showPanel(button.dataset.authTab)));
    gate.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
      const input = button.parentElement?.querySelector("input");
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "text" ? "Ẩn" : "Hiện";
      button.setAttribute("aria-label", input.type === "text" ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    }));
    gate.querySelectorAll("input[type=password]").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        const warning = input.closest(".auth-field")?.querySelector("[data-caps-warning]");
        if (warning) warning.hidden = !event.getModifierState("CapsLock");
      });
    });
    registerForm.querySelectorAll("[data-auth-next-step]").forEach((button) => button.addEventListener("click", () => {
      if (validateStep(signupStep)) setSignupStep(button.dataset.authNextStep);
    }));
    registerForm.querySelectorAll("[data-auth-prev-step]").forEach((button) => button.addEventListener("click", () => setSignupStep(button.dataset.authPrevStep)));
    registerForm.querySelectorAll("[data-signup-step-nav]").forEach((button) => button.addEventListener("click", () => {
      const target = Number(button.dataset.signupStepNav);
      if (target < signupStep || validateStep(signupStep)) setSignupStep(target);
    }));
    registerForm.querySelector("[data-register-password]")?.addEventListener("input", (event) => {
      const value = event.target.value;
      const rules = { length: value.length >= 8, case: /[a-zà-ỹ]/.test(value) && /[A-ZÀ-Ỹ]/.test(value), number: /\d/.test(value), symbol: /[^A-Za-zÀ-ỹ\d]/.test(value) };
      Object.entries(rules).forEach(([name, pass]) => registerForm.querySelector(`[data-rule="${name}"]`)?.classList.toggle("pass", pass));
    });
    registerForm.querySelector("[data-register-email]")?.addEventListener("input", (event) => {
      clearTimeout(emailTimer);
      const email = event.target.value.trim();
      const output = registerForm.querySelector("[data-email-availability]");
      if (!/^\S+@\S+\.\S+$/.test(email)) { output.textContent = ""; return; }
      output.textContent = "Đang kiểm tra email...";
      emailTimer = setTimeout(async () => {
        try {
          const result = await api(`/api/auth/email-availability?email=${encodeURIComponent(email)}`);
          output.textContent = result.available ? "Email có thể sử dụng." : "Email đã có tài khoản.";
          output.dataset.available = String(Boolean(result.available));
        } catch { output.textContent = "Sẽ kiểm tra lại khi tạo tài khoản."; }
      }, 450);
    });
    gate.querySelector("[data-avatar-trigger]")?.addEventListener("click", () => gate.querySelector("[data-avatar-input]")?.click());
    gate.querySelector("[data-avatar-input]")?.addEventListener("change", async (event) => {
      try {
        const avatar = await compressAvatar(event.target.files?.[0]);
        gate.querySelector("[data-avatar-value]").value = avatar;
        const preview = gate.querySelector("[data-avatar-preview]");
        preview.style.backgroundImage = `url(${avatar})`;
        preview.textContent = "";
      } catch (error) { setStatus(error.message, "error"); }
    });
    loginForm.addEventListener("submit", login);
    registerForm.addEventListener("submit", register);
    gate.querySelector("[data-passkey-login]")?.addEventListener("click", passkeyLogin);
    gate.querySelector("[data-device-login]")?.addEventListener("click", openQr);
    gate.querySelector("[data-forgot-open]")?.addEventListener("click", () => showPanel("recovery"));
    gate.querySelector("[data-forgot-close]")?.addEventListener("click", () => showPanel("login"));
    gate.querySelector("[data-recovery-action]")?.addEventListener("click", requestRecovery);
    gate.querySelector("[data-email-verify-action]")?.addEventListener("click", verifyEmail);
    gate.querySelector("[data-email-verify-resend]")?.addEventListener("click", resendEmailVerification);
    gate.querySelector("[data-qr-close]")?.addEventListener("click", () => { clearInterval(qrPoll); showPanel("login"); });
    gate.querySelector("[data-switch-account]")?.addEventListener("click", () => {
      localStorage.removeItem(LAST_PROFILE_KEY);
      gate.querySelector("[data-returning-user]").hidden = true;
      loginForm.reset();
      loginForm.querySelector('[name="email"]')?.focus();
    });
    gate.querySelector("[data-auth-continue-project]")?.addEventListener("click", () => {
      const profile = readJSON(localStorage, LAST_PROFILE_KEY, {});
      sessionStorage.setItem("hh.auth.pending-route", profile.lastProjectRoute || "#/work/project-center");
      loginForm.querySelector('[name="email"]')?.focus();
      setStatus("Đăng nhập để tiếp tục dự án gần đây.");
    });
    gate.querySelector("[data-guest-login]")?.addEventListener("click", () => {
      const guestUser = { id: `guest-${anonymousId}`, name: "Khách HH", email: "", roles: [], guest: true, interests: [] };
      sessionStorage.setItem(GUEST_KEY, "1");
      sessionStorage.setItem("hh.auth.guest-user", JSON.stringify(guestUser));
      user = guestUser;
      setStatus("Đã mở workspace local. Tính năng đồng bộ cần tài khoản.", "success");
      setGateState();
      location.hash = "#/home";
    });
    gate.querySelectorAll("[data-oauth-provider]").forEach((button) => button.addEventListener("click", () => {
      if (!realtimeUrl || !oauthProviders.google) return setOAuthError("Google OAuth chưa được cấu hình trên máy chủ.");
      sessionStorage.setItem("hh-auth-return-to", location.hash || "#/home");
      location.assign(`${realtimeUrl}/api/auth/google?returnTo=${encodeURIComponent(location.origin)}`);
    }));
    logoutButton?.addEventListener("click", async () => {
      try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
      setToken("");
      user = null;
      sessionStorage.removeItem(GUEST_KEY);
      sessionStorage.removeItem("hh.auth.guest-user");
      localStorage.removeItem("hh-auth-user");
      if (socket) socket.disconnect();
      setGateState();
      showPanel("login");
      location.hash = "";
    });
    consent?.addEventListener("change", () => localStorage.setItem("hh-tracking-consent", consent.checked ? "yes" : "no"));

    const params = new URLSearchParams(location.search);
    if (params.has("authError")) {
      const message = params.get("authError");
      history.replaceState({}, document.title, `${location.pathname}${location.hash || "#/home"}`);
      if (message) setOAuthError(message);
    }

    if (note) note.textContent = realtimeUrl ? "Phiên đăng nhập dùng cookie bảo mật; dữ liệu theo dõi chỉ chạy khi bạn đồng ý." : "Backend chưa cấu hình; chế độ khách vẫn dùng được công cụ local.";
    if (consent) consent.checked = localStorage.getItem("hh-tracking-consent") === "yes";
    renderReturningUser();
    setSignupStep(1);
    setGateState();
    Promise.resolve(realtimeUrl ? api("/api/auth/providers") : {}).then((providers) => {
      oauthProviders = providers || {};
      gate.querySelectorAll("[data-oauth-provider]").forEach((button) => {
        button.disabled = !oauthProviders.google;
        button.title = oauthProviders.google ? "Đăng nhập an toàn với Google" : "Google OAuth chưa được cấu hình";
      });
    }).catch(() => {
      oauthProviders = {};
      gate.querySelectorAll("[data-oauth-provider]").forEach((button) => {
        button.disabled = true;
        button.title = "Không kết nối được Google OAuth";
      });
    });
    exchangeOAuthCode().then((exchanged) => exchanged ? true : loadMe().then(approveQrFromUrl).then(connectSocket));
  }

  window.HHAuthSession = Object.freeze({ token, setToken });
  window.HHAuthPlatform = Object.freeze({ init, token, setToken, publicKeyOptions, credentialJSON });
})();
