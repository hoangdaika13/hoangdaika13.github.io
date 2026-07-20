(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STYLE_ID = "hh-graphic-collaboration-style-v1";
  const ANONYMOUS_KEY = "hh-design-collaboration-anonymous-id";
  const ROLE_LABELS = Object.freeze({ viewer: "Chỉ xem", commenter: "Bình luận", editor: "Biên tập", owner: "Chủ phòng" });
  const ROLE_RANK = Object.freeze({ viewer: 0, commenter: 1, editor: 2, owner: 3 });
  const SAMPLE_LAYERS = Object.freeze([
    { id: "hero-bg", label: "Nền Aurora", color: "#1a3150" },
    { id: "hero-shape", label: "Khối vector", color: "#fc5caf" },
    { id: "hero-title", label: "Tiêu đề", color: "#effaff" },
    { id: "hero-button", label: "Nút hành động", color: "#62d7e7" },
    { id: "hero-character", label: "Nhân vật", color: "#a78bfa" }
  ]);
  const hasDocument = typeof document !== "undefined";
  const instances = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min = 0, max = 100) {
    const parsed = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min));
  }

  function randomId() {
    if (globalScope.crypto?.randomUUID) return globalScope.crypto.randomUUID();
    return `design-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function readJson(key) {
    try { return JSON.parse(globalScope.localStorage?.getItem(key) || "null"); }
    catch { return null; }
  }

  function anonymousId() {
    let id = "";
    try {
      id = globalScope.localStorage?.getItem(ANONYMOUS_KEY) || "";
      if (!id) {
        id = randomId();
        globalScope.localStorage?.setItem(ANONYMOUS_KEY, id);
      }
    } catch { id = randomId(); }
    return id;
  }

  function createFallbackRoom(identity) {
    const user = identity || { id: `guest:${anonymousId()}`, name: "Khách cục bộ (chưa đăng nhập)", avatar: "", guest: true, authenticated: false };
    return {
      code: "LOCAL",
      name: "Bản xem trước cục bộ",
      members: [{ socketId: "local", user, role: "viewer", cursor: null, selection: { layerIds: [] } }],
      comments: [], locks: [], versions: [],
      branches: [{ id: "main", name: "Main", createdAt: new Date().toISOString() }],
      reviews: [], persistence: "local-readonly",
      limits: { members: 1, comments: 0, locks: 0 }
    };
  }

  function positionFromEvent(event, node) {
    const rect = node.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 100),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height) * 100)
    };
  }

  function injectStyles() {
    if (!hasDocument || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-hh-design-collaboration]{--dc-bg:#070b12;--dc-panel:#0d141e;--dc-panel-2:#111c29;--dc-line:#26384a;--dc-text:#edf7ff;--dc-muted:#8fa2b5;--dc-cyan:#62d7e7;--dc-pink:#fc5caf;--dc-green:#67dba1;--dc-yellow:#f6d365;display:block;color:var(--dc-text);font:500 13px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;background:radial-gradient(circle at 12% -8%,rgba(98,215,231,.14),transparent 28%),radial-gradient(circle at 96% 4%,rgba(252,92,175,.12),transparent 26%),var(--dc-bg);border:1px solid var(--dc-line);border-radius:12px;overflow:hidden;min-height:640px;box-shadow:0 24px 70px rgba(0,0,0,.34)}
      [data-hh-design-collaboration] *{box-sizing:border-box}[data-hh-design-collaboration] button,[data-hh-design-collaboration] input,[data-hh-design-collaboration] textarea,[data-hh-design-collaboration] select{font:inherit}[data-hh-design-collaboration] button{border:1px solid var(--dc-line);background:#121d29;color:var(--dc-text);border-radius:7px;padding:8px 11px;cursor:pointer;transition:transform .16s,border-color .16s,background .16s}[data-hh-design-collaboration] button:hover:not(:disabled){transform:translateY(-1px);border-color:var(--dc-cyan);background:#172638}[data-hh-design-collaboration] button:disabled{cursor:not-allowed;opacity:.45}[data-hh-design-collaboration] button.is-primary{background:linear-gradient(120deg,var(--dc-cyan),#78e6b2);border-color:transparent;color:#071119;font-weight:800}[data-hh-design-collaboration] button.is-danger{color:#ff9cba;border-color:#7a3153}[data-hh-design-collaboration] input,[data-hh-design-collaboration] textarea,[data-hh-design-collaboration] select{width:100%;background:#080e16;border:1px solid var(--dc-line);border-radius:7px;color:var(--dc-text);padding:9px 10px}[data-hh-design-collaboration] textarea{resize:vertical;min-height:74px}[data-hh-design-collaboration] button:focus-visible,[data-hh-design-collaboration] input:focus-visible,[data-hh-design-collaboration] textarea:focus-visible,[data-hh-design-collaboration] select:focus-visible{outline:2px solid var(--dc-cyan);outline-offset:2px}
      .dc-topbar{min-height:64px;padding:11px 14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--dc-line);background:rgba(9,15,23,.88);backdrop-filter:blur(16px)}.dc-brand{display:flex;align-items:center;gap:10px;min-width:0}.dc-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:linear-gradient(145deg,var(--dc-pink),var(--dc-cyan));color:#071119;font-weight:900;box-shadow:0 0 26px rgba(98,215,231,.2)}.dc-brand strong,.dc-brand small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dc-brand small{color:var(--dc-muted);font-size:10px;text-transform:uppercase}.dc-top-actions{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.dc-status{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dc-line);border-radius:999px;padding:6px 9px;color:var(--dc-muted);white-space:nowrap}.dc-status::before{content:"";width:7px;height:7px;border-radius:50%;background:#718096}.dc-status[data-state="online"]::before{background:var(--dc-green);box-shadow:0 0 10px var(--dc-green)}.dc-status[data-state="connecting"]::before,.dc-status[data-state="reconnecting"]::before{background:var(--dc-yellow)}.dc-status[data-state="readonly"]::before{background:var(--dc-pink)}
      .dc-notice{margin:10px 14px 0;padding:9px 11px;border:1px solid #654265;background:#27172b;color:#f4b9df;border-radius:8px}.dc-notice[data-kind="info"]{border-color:#31576d;background:#102331;color:#bdebf1}.dc-connect{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.72fr);gap:14px;padding:18px}.dc-welcome,.dc-connect-card{border:1px solid var(--dc-line);background:linear-gradient(145deg,rgba(17,28,41,.95),rgba(10,15,24,.95));border-radius:10px;padding:22px}.dc-welcome{min-height:380px;display:grid;align-content:center;position:relative;overflow:hidden}.dc-welcome::after{content:"";position:absolute;width:240px;height:240px;border:42px solid rgba(98,215,231,.08);border-radius:44px;right:-40px;bottom:-70px;transform:rotate(22deg)}.dc-eyebrow{color:var(--dc-cyan);font-size:10px;font-weight:800;text-transform:uppercase}.dc-welcome h2{font-size:clamp(28px,4vw,52px);line-height:1.02;margin:10px 0 14px;max-width:720px}.dc-welcome p{color:var(--dc-muted);max-width:650px;font-size:14px}.dc-feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:20px}.dc-feature{border:1px solid var(--dc-line);background:#0b121c;border-radius:8px;padding:10px}.dc-feature b{display:block;color:var(--dc-cyan);font-size:11px}.dc-feature span{color:var(--dc-muted);font-size:10px}.dc-connect-card{display:grid;align-content:center;gap:12px}.dc-connect-card h3{margin:0;font-size:18px}.dc-field{display:grid;gap:5px}.dc-field span{color:var(--dc-muted);font-size:11px}.dc-inline{display:flex;gap:7px}.dc-security{font-size:10px;color:var(--dc-muted);border-top:1px solid var(--dc-line);padding-top:11px}
      .dc-workspace{display:grid;grid-template-columns:190px minmax(0,1fr) 310px;min-height:574px}.dc-members{border-right:1px solid var(--dc-line);background:#090f17;padding:12px;overflow:auto}.dc-panel-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.dc-panel-title strong{font-size:11px;text-transform:uppercase;color:var(--dc-muted)}.dc-member{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;padding:8px;border-radius:8px}.dc-member:hover{background:#111c29}.dc-avatar{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#22374b,#4e2853);color:#dffaff;font-size:10px;font-weight:800;position:relative}.dc-avatar.is-online::after{content:"";position:absolute;width:8px;height:8px;border-radius:50%;right:0;bottom:0;background:var(--dc-green);border:2px solid #0b1119}.dc-member-info{min-width:0}.dc-member-info b,.dc-member-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dc-member-info b{font-size:11px}.dc-member-info small{color:var(--dc-muted);font-size:9px}.dc-role-select{margin-top:4px;padding:3px 5px!important;font-size:9px!important}.dc-canvas-wrap{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;background:#070b11}.dc-canvas-toolbar{display:flex;align-items:center;gap:6px;padding:9px 10px;border-bottom:1px solid var(--dc-line);overflow:auto}.dc-room-code{font-family:ui-monospace,monospace;color:var(--dc-cyan);margin-left:auto}.dc-canvas-stage{position:relative;min-height:410px;margin:14px;overflow:hidden;border:1px solid #314559;border-radius:8px;background:linear-gradient(90deg,rgba(98,215,231,.04) 1px,transparent 1px),linear-gradient(rgba(98,215,231,.04) 1px,transparent 1px),#0a111a;background-size:24px 24px;touch-action:none}.dc-artboard{position:absolute;inset:9% 8%;border-radius:8px;background:radial-gradient(circle at 77% 20%,rgba(252,92,175,.32),transparent 31%),radial-gradient(circle at 20% 70%,rgba(98,215,231,.28),transparent 34%),linear-gradient(145deg,#15263d,#12111f);box-shadow:0 18px 50px rgba(0,0,0,.45);overflow:hidden}.dc-artboard-label{position:absolute;left:6%;top:9%;color:#8ef0f5;font-size:10px;text-transform:uppercase}.dc-artboard h3{position:absolute;left:6%;top:18%;max-width:55%;margin:0;font-size:clamp(26px,4vw,56px);line-height:.98}.dc-artboard p{position:absolute;left:6%;top:58%;max-width:48%;color:#c3d1df}.dc-design-button{position:absolute;left:6%;bottom:10%;padding:10px 16px;border-radius:999px;background:linear-gradient(110deg,var(--dc-pink),#a78bfa);font-weight:800}.dc-design-character{position:absolute;right:8%;bottom:9%;width:26%;aspect-ratio:3/4;border-radius:48% 48% 30% 30%;background:linear-gradient(150deg,#81ecdf,#5751a7 55%,#f16aaa);box-shadow:0 0 50px rgba(98,215,231,.23)}.dc-design-character::before{content:"";position:absolute;width:46%;aspect-ratio:1;left:27%;top:8%;border-radius:48%;background:#ffd6c8}.dc-layer-hit{position:absolute;border:1px solid transparent;background:transparent!important;padding:0!important;border-radius:3px!important}.dc-layer-hit:hover,.dc-layer-hit.is-selected{border-color:var(--dc-cyan);box-shadow:0 0 0 1px rgba(98,215,231,.35)}.dc-layer-hit[data-layer="hero-title"]{left:4%;top:14%;width:58%;height:40%}.dc-layer-hit[data-layer="hero-button"]{left:4%;bottom:6%;width:28%;height:17%}.dc-layer-hit[data-layer="hero-character"]{right:5%;bottom:5%;width:32%;height:82%}.dc-layer-hit[data-layer="hero-bg"]{inset:0;z-index:-1}.dc-cursor{position:absolute;z-index:8;pointer-events:none;color:var(--cursor,#62d7e7);transform:translate(-2px,-2px)}.dc-cursor::before{content:"";display:block;width:0;height:0;border-left:8px solid currentColor;border-top:5px solid transparent;border-bottom:5px solid transparent;transform:rotate(45deg)}.dc-cursor span{display:block;margin:2px 0 0 8px;padding:2px 5px;border-radius:4px;background:currentColor;color:#071119;font-size:9px;white-space:nowrap}.dc-pin{position:absolute;z-index:9;display:grid!important;place-items:center;width:24px;height:24px;padding:0!important;border-radius:50%!important;background:var(--dc-pink)!important;color:#fff!important;font-size:10px;transform:translate(-50%,-50%);box-shadow:0 0 18px rgba(252,92,175,.45)}.dc-pin.is-resolved{background:#516072!important;opacity:.62}.dc-layer-strip{display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid var(--dc-line);overflow:auto}.dc-layer-chip{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.dc-color-dot{width:7px;height:7px;border-radius:50%;background:var(--layer-color)}.dc-lock{color:var(--dc-yellow);font-size:9px}
      .dc-inspector{border-left:1px solid var(--dc-line);background:#0a1018;min-width:0}.dc-tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--dc-line)}.dc-tabs button{border:0;border-radius:0;background:transparent;color:var(--dc-muted);padding:11px 5px}.dc-tabs button.is-active{color:var(--dc-cyan);box-shadow:inset 0 -2px var(--dc-cyan)}.dc-inspector-body{height:522px;overflow:auto;padding:12px}.dc-section{border:1px solid var(--dc-line);background:#0c141f;border-radius:8px;padding:11px;margin-bottom:10px}.dc-section h4{margin:0 0 8px;font-size:11px}.dc-comment{padding:9px 0;border-bottom:1px solid var(--dc-line)}.dc-comment:last-child{border:0}.dc-comment-head{display:flex;justify-content:space-between;gap:8px}.dc-comment p{margin:5px 0;color:#d3dee8;word-break:break-word}.dc-comment small{color:var(--dc-muted);font-size:9px}.dc-empty{color:var(--dc-muted);text-align:center;padding:28px 12px}.dc-history{display:grid;gap:7px}.dc-history-item{border-left:2px solid var(--dc-cyan);padding:5px 8px;background:#0a111a}.dc-history-item b,.dc-history-item small{display:block}.dc-history-item small{color:var(--dc-muted);font-size:9px}.dc-form-stack{display:grid;gap:7px}.dc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:980px){.dc-workspace{grid-template-columns:150px minmax(0,1fr) 270px}.dc-feature-grid{grid-template-columns:1fr}.dc-canvas-stage{margin:9px}.dc-artboard p{display:none}}
      @media(max-width:760px){[data-hh-design-collaboration]{border-radius:0}.dc-topbar{align-items:flex-start}.dc-top-actions{max-width:55%}.dc-connect{grid-template-columns:1fr}.dc-welcome{min-height:300px}.dc-workspace{grid-template-columns:1fr}.dc-members{border-right:0;border-bottom:1px solid var(--dc-line);display:flex;gap:4px;overflow:auto}.dc-members .dc-panel-title{min-width:90px}.dc-member{min-width:145px}.dc-canvas-stage{min-height:390px}.dc-inspector{border-left:0;border-top:1px solid var(--dc-line)}.dc-inspector-body{height:auto;max-height:460px}.dc-artboard h3{font-size:34px}}
      @media(max-width:480px){.dc-brand small,.dc-top-actions .dc-identity{display:none}.dc-top-actions{max-width:none}.dc-status{font-size:0}.dc-status::after{content:attr(aria-label);font-size:10px}.dc-connect{padding:10px}.dc-welcome,.dc-connect-card{padding:16px}.dc-feature-grid{grid-template-columns:1fr 1fr}.dc-inline{flex-direction:column}.dc-canvas-stage{min-height:340px}.dc-artboard{inset:7% 4%}.dc-artboard h3{max-width:64%;font-size:28px}.dc-layer-strip{padding-bottom:12px}}
      @media(prefers-reduced-motion:reduce){[data-hh-design-collaboration] *,[data-hh-design-collaboration] *::before,[data-hh-design-collaboration] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function loadSocketClient(socketUrl) {
    if (typeof globalScope.io === "function") return Promise.resolve(globalScope.io);
    if (!hasDocument || !socketUrl) return Promise.reject(new Error("Thiếu Socket.IO client hoặc URL máy chủ."));
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-hh-design-socket-client]");
      if (existing) {
        existing.addEventListener("load", () => resolve(globalScope.io), { once: true });
        existing.addEventListener("error", () => reject(new Error("Không tải được Socket.IO client.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.hhDesignSocketClient = "true";
      script.src = `${String(socketUrl).replace(/\/$/, "")}/socket.io/socket.io.js`;
      script.async = true;
      script.onload = () => typeof globalScope.io === "function" ? resolve(globalScope.io) : reject(new Error("Socket.IO client không hợp lệ."));
      script.onerror = () => reject(new Error("Không tải được Socket.IO client."));
      document.head.appendChild(script);
    });
  }

  function createController(root, options = {}) {
    injectStyles();
    const authUser = readJson("hh-auth-user");
    const fallbackIdentity = authUser
      ? { id: String(authUser.id || authUser._id || "authenticated"), name: authUser.name || authUser.email || "Thành viên HH", avatar: authUser.avatar || "", guest: false, authenticated: true }
      : { id: `guest:${anonymousId()}`, name: `${options.guestName || "Khách HH"} (chưa đăng nhập)`, avatar: "", guest: true, authenticated: false };
    const state = {
      connection: "connecting", message: "Đang kết nối máy chủ cộng tác...", kind: "info",
      room: null, identity: fallbackIdentity, selfSocketId: "", tab: "comments", commentMode: false,
      pinDraft: null, selectedLayers: [], ownSocket: false, socket: null, destroyed: false
    };
    const socketHandlers = [];
    let cursorFrame = 0;
    let pendingCursor = null;

    function currentMember() {
      return state.room?.members?.find((member) => member.socketId === state.selfSocketId || member.user?.id === state.identity?.id) || null;
    }

    function currentRole() { return currentMember()?.role || "viewer"; }
    function can(minimum) { return (ROLE_RANK[currentRole()] || 0) >= ROLE_RANK[minimum]; }
    function readonly() { return state.connection !== "online" || state.room?.persistence === "local-readonly"; }
    function initials(name) { return String(name || "HH").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

    function statusLabel() {
      return ({ online: "Đang đồng bộ", connecting: "Đang kết nối", reconnecting: "Đang kết nối lại", readonly: "Chỉ xem cục bộ", offline: "Mất kết nối" })[state.connection] || "Ngoại tuyến";
    }

    function topbar() {
      return `<header class="dc-topbar">
        <div class="dc-brand"><span class="dc-logo" aria-hidden="true">CO</span><div><strong>HH Design Collaboration</strong><small>Realtime review workspace</small></div></div>
        <div class="dc-top-actions">
          <span class="dc-status" data-state="${escapeHtml(state.connection)}" role="status" aria-live="polite" aria-label="${escapeHtml(statusLabel())}">${escapeHtml(statusLabel())}</span>
          <span class="dc-identity">${escapeHtml(state.identity?.name || "Khách")}</span>
          ${state.room ? `<button type="button" data-dc-action="copy-code" title="Sao chép mã phòng">${escapeHtml(state.room.code)}</button><button type="button" data-dc-action="leave" class="is-danger">Rời phòng</button>` : ""}
        </div>
      </header>`;
    }

    function connectView() {
      const offline = state.connection !== "online";
      return `<div class="dc-connect">
        <section class="dc-welcome"><span class="dc-eyebrow">Cộng tác thiết kế thời gian thực</span><h2>Cùng nhìn một canvas.<br>Cùng đưa ra quyết định.</h2><p>Con trỏ trực tiếp, vùng chọn, bình luận ghim, quyền truy cập, khóa layer, phiên bản, nhánh và yêu cầu duyệt trong một workspace rõ ràng.</p><div class="dc-feature-grid"><div class="dc-feature"><b>Presence & cursor</b><span>Biết ai đang ở đâu trên canvas</span></div><div class="dc-feature"><b>Role & lock</b><span>Viewer, commenter, editor, owner</span></div><div class="dc-feature"><b>Review flow</b><span>Version, branch và phê duyệt</span></div></div></section>
        <section class="dc-connect-card" aria-labelledby="dc-connect-title"><span class="dc-eyebrow">Bắt đầu</span><h3 id="dc-connect-title">Tạo hoặc tham gia phòng</h3>
          <label class="dc-field"><span>Tên phòng mới</span><input data-dc-room-name maxlength="80" value="HH Creative Review" ${offline ? "disabled" : ""}></label>
          <button type="button" class="is-primary" data-dc-action="create" ${offline ? "disabled" : ""}>Tạo phòng thiết kế</button>
          <div class="dc-inline"><label class="dc-field" style="flex:1"><span>Mã phòng gồm 8 ký tự</span><input data-dc-room-code maxlength="8" placeholder="A1B2C3D4" autocapitalize="characters" ${offline ? "disabled" : ""}></label><button type="button" data-dc-action="join" ${offline ? "disabled" : ""}>Tham gia</button></div>
          ${offline ? `<button type="button" data-dc-action="readonly">Mở bản xem trước chỉ đọc</button>` : ""}
          <p class="dc-security">Danh tính đăng nhập được ưu tiên. Khách luôn có nhãn “chưa đăng nhập”. Dữ liệu phòng hoạt động nằm trong bộ nhớ máy chủ; WSS/TLS được dùng khi triển khai sau HTTPS.</p>
        </section>
      </div>`;
    }

    function memberList() {
      const owner = currentRole() === "owner";
      const members = state.room?.members || [];
      return `<aside class="dc-members" aria-label="Thành viên đang trực tuyến"><div class="dc-panel-title"><strong>Đang online</strong><span>${members.length}/${state.room?.limits?.members || 24}</span></div>${members.map((member) => {
        const editable = owner && member.role !== "owner";
        return `<article class="dc-member"><span class="dc-avatar is-online">${escapeHtml(initials(member.user?.name))}</span><div class="dc-member-info"><b>${escapeHtml(member.user?.name || "Thành viên")}</b><small>${escapeHtml(ROLE_LABELS[member.role] || member.role)}${member.user?.guest ? " · khách" : " · đã xác thực"}</small>${editable ? `<label class="dc-sr" for="role-${escapeHtml(member.socketId)}">Đổi quyền</label><select id="role-${escapeHtml(member.socketId)}" class="dc-role-select" data-dc-role-user="${escapeHtml(member.user.id)}"><option value="viewer" ${member.role === "viewer" ? "selected" : ""}>Chỉ xem</option><option value="commenter" ${member.role === "commenter" ? "selected" : ""}>Bình luận</option><option value="editor" ${member.role === "editor" ? "selected" : ""}>Biên tập</option></select>` : ""}</div></article>`;
      }).join("")}</aside>`;
    }

    function canvas() {
      const locks = new Map((state.room?.locks || []).map((lock) => [lock.layerId, lock]));
      const selected = new Set(state.selectedLayers);
      const cursors = (state.room?.members || []).filter((member) => member.socketId !== state.selfSocketId && member.cursor);
      const comments = (state.room?.comments || []).filter((comment) => comment.artboardId === "hero" || !comment.artboardId);
      return `<main class="dc-canvas-wrap"><div class="dc-canvas-toolbar"><button type="button" data-dc-action="comment-mode" class="${state.commentMode ? "is-primary" : ""}" ${!can("commenter") || readonly() ? "disabled" : ""}>${state.commentMode ? "Đang ghim bình luận" : "Ghim bình luận"}</button><button type="button" data-dc-action="version" ${!can("editor") || readonly() ? "disabled" : ""}>Tạo phiên bản</button><span class="dc-room-code">${escapeHtml(currentRole())} · ${escapeHtml(state.room?.persistence === "memory" ? "realtime memory" : "local")}</span></div>
        <div class="dc-canvas-stage" data-dc-canvas role="application" aria-label="Canvas cộng tác. Dùng Tab để chọn layer, sau đó Enter để chọn.">
          <div class="dc-artboard" aria-label="Artboard Hero"><span class="dc-artboard-label">HH Creative System</span><h3>Thiết kế cùng nhau, quyết định nhanh hơn.</h3><p>Một canvas minh họa để thử con trỏ, vùng chọn, comment và khóa layer.</p><span class="dc-design-button">Khám phá studio</span><span class="dc-design-character" aria-hidden="true"></span>
            ${["hero-bg", "hero-title", "hero-button", "hero-character"].map((id) => `<button type="button" class="dc-layer-hit ${selected.has(id) ? "is-selected" : ""}" data-layer="${id}" data-dc-action="select-layer" aria-label="Chọn ${escapeHtml(SAMPLE_LAYERS.find((item) => item.id === id)?.label || id)}"></button>`).join("")}
          </div>
          ${cursors.map((member) => `<span class="dc-cursor" style="left:${clamp(member.cursor.x)}%;top:${clamp(member.cursor.y)}%;--cursor:${escapeHtml(member.cursor.color || "#62d7e7")}"><span>${escapeHtml(member.user?.name || "Thành viên")}</span></span>`).join("")}
          ${comments.map((comment, index) => `<button type="button" class="dc-pin ${comment.resolved ? "is-resolved" : ""}" style="left:${clamp(comment.x)}%;top:${clamp(comment.y)}%" data-dc-comment-id="${escapeHtml(comment.id)}" title="${escapeHtml(comment.body)}">${index + 1}</button>`).join("")}
        </div>
        <div class="dc-layer-strip" aria-label="Layer nhanh">${SAMPLE_LAYERS.map((layer) => { const lock = locks.get(layer.id); const owned = lock?.user?.id === state.identity?.id; return `<span class="dc-layer-chip"><i class="dc-color-dot" style="--layer-color:${layer.color}"></i>${escapeHtml(layer.label)}${lock ? `<span class="dc-lock">${escapeHtml(lock.user.name)}</span>` : ""}<button type="button" data-dc-layer-lock="${layer.id}" ${!can("editor") || readonly() || (lock && !owned) ? "disabled" : ""}>${owned ? "Mở" : lock ? "Đã khóa" : "Khóa"}</button></span>`; }).join("")}</div>
      </main>`;
    }

    function commentsPanel() {
      const comments = state.room?.comments || [];
      return `<section><div class="dc-section"><h4>Bình luận ghim</h4><form class="dc-form-stack" data-dc-comment-form><textarea name="body" maxlength="2000" placeholder="Nhập góp ý rõ ràng..." ${!can("commenter") || readonly() ? "disabled" : ""}>${escapeHtml(state.pinDraft?.body || "")}</textarea><div class="dc-inline"><input name="x" type="number" min="0" max="100" value="${Math.round(state.pinDraft?.x ?? 50)}" aria-label="Tọa độ ngang"><input name="y" type="number" min="0" max="100" value="${Math.round(state.pinDraft?.y ?? 50)}" aria-label="Tọa độ dọc"><button class="is-primary" ${!can("commenter") || readonly() ? "disabled" : ""}>Gửi</button></div></form></div>${comments.length ? comments.slice().reverse().map((comment) => `<article class="dc-comment"><div class="dc-comment-head"><b>${escapeHtml(comment.user?.name || "Thành viên")}</b><small>${comment.resolved ? "Đã xử lý" : "Đang mở"}</small></div><p>${escapeHtml(comment.body)}</p><small>${escapeHtml(comment.layerId || comment.artboardId || "Canvas")} · ${new Date(comment.createdAt).toLocaleString("vi-VN")}</small>${!comment.resolved && (comment.user?.id === state.identity?.id || can("editor")) ? `<button type="button" data-dc-resolve="${escapeHtml(comment.id)}">Đánh dấu đã xử lý</button>` : ""}</article>`).join("") : `<p class="dc-empty">Chưa có bình luận.</p>`}</section>`;
    }

    function versionsPanel() {
      const versions = state.room?.versions || [];
      const branches = state.room?.branches || [];
      const reviews = state.room?.reviews || [];
      return `<section><form class="dc-section dc-form-stack" data-dc-branch-form><h4>Tạo nhánh thiết kế</h4><input name="name" maxlength="80" placeholder="Ví dụ: hero-refresh" ${!can("editor") || readonly() ? "disabled" : ""}><button ${!can("editor") || readonly() ? "disabled" : ""}>Tạo nhánh</button></form><div class="dc-section"><h4>Nhánh · ${branches.length}</h4><div class="dc-history">${branches.map((branch) => `<div class="dc-history-item"><b>${escapeHtml(branch.name)}</b><small>${escapeHtml(branch.user?.name || "Hệ thống")} · ${new Date(branch.createdAt).toLocaleString("vi-VN")}</small>${branch.id !== "main" && can("editor") && !readonly() ? `<button type="button" data-dc-review-branch="${escapeHtml(branch.id)}">Yêu cầu duyệt</button>` : ""}</div>`).join("")}</div></div><div class="dc-section"><h4>Phiên bản · ${versions.length}</h4><div class="dc-history">${versions.length ? versions.slice().reverse().map((version) => `<div class="dc-history-item"><b>${escapeHtml(version.label)}</b><small>${escapeHtml(version.user?.name || "Thành viên")} · ${new Date(version.createdAt).toLocaleString("vi-VN")}</small></div>`).join("") : `<p class="dc-empty">Chưa có snapshot.</p>`}</div></div><div class="dc-section"><h4>Yêu cầu duyệt · ${reviews.length}</h4><div class="dc-history">${reviews.length ? reviews.slice().reverse().map((review) => `<div class="dc-history-item"><b>${escapeHtml(review.title)}</b><small>${escapeHtml(review.status)} · ${escapeHtml(review.user?.name || "Thành viên")}</small>${review.status === "pending" && currentRole() === "owner" ? `<button type="button" data-dc-approve="${escapeHtml(review.id)}">Duyệt</button>` : ""}</div>`).join("") : `<p class="dc-empty">Chưa có yêu cầu.</p>`}</div></div></section>`;
    }

    function inspector() {
      return `<aside class="dc-inspector"><div class="dc-tabs" role="tablist"><button role="tab" data-dc-tab="comments" class="${state.tab === "comments" ? "is-active" : ""}" aria-selected="${state.tab === "comments"}">Bình luận</button><button role="tab" data-dc-tab="versions" class="${state.tab === "versions" ? "is-active" : ""}" aria-selected="${state.tab === "versions"}">Phiên bản</button><button role="tab" data-dc-tab="info" class="${state.tab === "info" ? "is-active" : ""}" aria-selected="${state.tab === "info"}">Thông tin</button></div><div class="dc-inspector-body">${state.tab === "comments" ? commentsPanel() : state.tab === "versions" ? versionsPanel() : `<section class="dc-section"><h4>Trạng thái phòng</h4><p><b>${escapeHtml(state.room?.name)}</b></p><p>Vai trò: ${escapeHtml(ROLE_LABELS[currentRole()] || currentRole())}</p><p>Lưu trữ: ${escapeHtml(state.room?.persistence || "memory")}</p><p>Mã hóa truyền tải: TLS/WSS khi website dùng HTTPS.</p><p>Không tuyên bố mã hóa đầu cuối. Nội dung cộng tác hoạt động nằm trong bộ nhớ máy chủ.</p></section>`}</div></aside>`;
    }

    function render() {
      if (state.destroyed) return;
      root.setAttribute("data-hh-design-collaboration", "");
      root.innerHTML = `${topbar()}${state.message ? `<div class="dc-notice" data-kind="${escapeHtml(state.kind)}" role="status">${escapeHtml(state.message)}</div>` : ""}${state.room ? `<div class="dc-workspace">${memberList()}${canvas()}${inspector()}</div>` : connectView()}`;
    }

    function setMessage(message, kind = "info") { state.message = message; state.kind = kind; render(); }

    function emitAck(event, payload = {}) {
      return new Promise((resolve, reject) => {
        if (!state.socket?.connected) return reject(new Error("Máy chủ cộng tác đang ngoại tuyến."));
        const timer = setTimeout(() => reject(new Error("Máy chủ phản hồi quá lâu.")), 6000);
        state.socket.emit(event, payload, (response = {}) => {
          clearTimeout(timer);
          response.ok ? resolve(response) : reject(new Error(response.error || "Thao tác không thành công."));
        });
      });
    }

    function applyRoom(response) {
      state.room = response.room;
      state.selfSocketId = response.selfSocketId || state.socket?.id || "";
      state.identity = response.identity || state.identity;
      state.message = `Đã tham gia ${response.room.name}.`;
      state.kind = "info";
      render();
    }

    function replaceById(list, item) {
      const next = Array.isArray(list) ? list.slice() : [];
      const index = next.findIndex((entry) => entry.id === item.id);
      if (index >= 0) next[index] = item; else next.push(item);
      return next;
    }

    function onSocket(event, handler) {
      state.socket.on(event, handler);
      socketHandlers.push([event, handler]);
    }

    function bindSocket(socket) {
      state.socket = socket;
      onSocket("connect", () => {
        state.connection = "online";
        state.message = state.room && state.room.code !== "LOCAL" ? "Đã kết nối lại. Hãy tham gia lại phòng để lấy trạng thái mới nhất." : "Máy chủ cộng tác đã sẵn sàng.";
        state.kind = "info";
        if (state.room?.code && state.room.code !== "LOCAL") emitAck("design:room:join", { code: state.room.code }).then(applyRoom).catch((error) => setMessage(error.message, "error"));
        else render();
      });
      onSocket("disconnect", () => { state.connection = "reconnecting"; state.message = "Mất kết nối. Workspace tạm thời chỉ xem cho đến khi đồng bộ lại."; state.kind = "error"; render(); });
      onSocket("connect_error", () => { state.connection = "readonly"; state.message = "Không kết nối được máy chủ. Bạn có thể mở bản xem trước chỉ đọc."; state.kind = "error"; render(); });
      onSocket("design:presence", ({ members }) => { if (!state.room) return; state.room.members = members || []; render(); });
      onSocket("design:permission", ({ userId, role }) => { if (!state.room) return; state.room.members = state.room.members.map((member) => member.user.id === userId ? { ...member, role } : member); render(); });
      onSocket("design:cursor", ({ socketId, user, cursor }) => { if (!state.room) return; state.room.members = replaceById(state.room.members.map((member) => ({ ...member, id: member.socketId })), { ...(state.room.members.find((member) => member.socketId === socketId) || { socketId, user, role: "viewer" }), id: socketId, cursor }).map(({ id, ...member }) => member); render(); });
      onSocket("design:selection", ({ socketId, user, selection }) => { if (!state.room) return; state.room.members = state.room.members.map((member) => member.socketId === socketId ? { ...member, user, selection } : member); render(); });
      onSocket("design:comment:added", ({ comment }) => { if (!state.room) return; state.room.comments = replaceById(state.room.comments, comment); render(); });
      onSocket("design:comment:updated", ({ comment }) => { if (!state.room) return; state.room.comments = replaceById(state.room.comments, comment); render(); });
      onSocket("design:lock:acquired", ({ lock }) => { if (!state.room) return; state.room.locks = (state.room.locks || []).filter((item) => item.layerId !== lock.layerId).concat(lock); render(); });
      onSocket("design:lock:released", ({ layerId }) => { if (!state.room) return; state.room.locks = (state.room.locks || []).filter((item) => item.layerId !== layerId); render(); });
      onSocket("design:version:created", ({ version }) => { if (!state.room) return; state.room.versions = replaceById(state.room.versions, version); render(); });
      onSocket("design:branch:created", ({ branch }) => { if (!state.room) return; state.room.branches = replaceById(state.room.branches, branch); render(); });
      onSocket("design:review:created", ({ review }) => { if (!state.room) return; state.room.reviews = replaceById(state.room.reviews, review); render(); });
      onSocket("design:review:updated", ({ review }) => { if (!state.room) return; state.room.reviews = replaceById(state.room.reviews, review); render(); });
    }

    async function connect() {
      const supplied = options.socket || (globalScope.HHRealtimeSocket?.connected ? globalScope.HHRealtimeSocket : null);
      if (supplied) {
        state.ownSocket = false;
        bindSocket(supplied);
        state.connection = supplied.connected ? "online" : "connecting";
        state.message = supplied.connected ? "Máy chủ cộng tác đã sẵn sàng." : "Đang chờ kết nối realtime...";
        return render();
      }
      const socketUrl = options.socketUrl || globalScope.HH_SOCKET_URL || globalScope.HH_REALTIME_URL || "";
      if (!socketUrl) {
        state.connection = "readonly";
        state.message = "Chưa có URL máy chủ. Chế độ dự phòng chỉ cho phép xem.";
        state.kind = "error";
        return render();
      }
      try { await loadSocketClient(socketUrl); }
      catch (error) {
        state.connection = "readonly";
        state.message = `${error.message} Chế độ dự phòng chỉ cho phép xem.`;
        state.kind = "error";
        return render();
      }
      const token = options.token || globalScope.localStorage?.getItem("hh-auth-token") || "";
      const socket = globalScope.io(socketUrl, {
        transports: ["websocket", "polling"],
        auth: { token, anonymousId: anonymousId(), designName: options.guestName || "Khách HH", consent: false }
      });
      state.ownSocket = true;
      bindSocket(socket);
      render();
    }

    async function handleAction(action, target) {
      try {
        if (action === "create") return applyRoom(await emitAck("design:room:create", { name: root.querySelector("[data-dc-room-name]")?.value }));
        if (action === "join") return applyRoom(await emitAck("design:room:join", { code: root.querySelector("[data-dc-room-code]")?.value }));
        if (action === "readonly") { state.connection = "readonly"; state.room = createFallbackRoom(state.identity); state.selfSocketId = "local"; state.message = "Đang xem bản cục bộ. Không có thay đổi nào được gửi hoặc lưu."; return render(); }
        if (action === "copy-code") { await globalScope.navigator?.clipboard?.writeText(state.room.code); return setMessage("Đã sao chép mã phòng."); }
        if (action === "leave") { if (state.room?.code !== "LOCAL") await emitAck("design:room:leave"); state.room = null; state.selectedLayers = []; return setMessage("Đã rời phòng."); }
        if (action === "comment-mode") { state.commentMode = !state.commentMode; return render(); }
        if (action === "select-layer") { const id = target.dataset.layer; state.selectedLayers = [id]; state.socket?.emit("design:selection", { layerIds: [id], artboardId: "hero" }); return render(); }
        if (action === "version") { const label = `Snapshot ${new Date().toLocaleTimeString("vi-VN")}`; await emitAck("design:version:create", { label, branchId: "main", projectHash: `ui-${Date.now().toString(36)}` }); return setMessage(`Đã tạo ${label}.`); }
      } catch (error) { setMessage(error.message, "error"); }
    }

    async function onClick(event) {
      const actionNode = event.target.closest("[data-dc-action]");
      if (actionNode) return handleAction(actionNode.dataset.dcAction, actionNode);
      const tab = event.target.closest("[data-dc-tab]");
      if (tab) { state.tab = tab.dataset.dcTab; return render(); }
      const lockButton = event.target.closest("[data-dc-layer-lock]");
      if (lockButton) {
        const layerId = lockButton.dataset.dcLayerLock;
        const own = state.room?.locks?.find((lock) => lock.layerId === layerId && lock.user.id === state.identity.id);
        try { await emitAck(own ? "design:lock:release" : "design:lock:acquire", { layerId }); }
        catch (error) { setMessage(error.message, "error"); }
        return;
      }
      const resolveButton = event.target.closest("[data-dc-resolve]");
      if (resolveButton) return emitAck("design:comment:resolve", { commentId: resolveButton.dataset.dcResolve, resolved: true }).catch((error) => setMessage(error.message, "error"));
      const reviewButton = event.target.closest("[data-dc-review-branch]");
      if (reviewButton) return emitAck("design:review:create", { branchId: reviewButton.dataset.dcReviewBranch, title: "Duyệt thay đổi thiết kế" }).catch((error) => setMessage(error.message, "error"));
      const approveButton = event.target.closest("[data-dc-approve]");
      if (approveButton) return emitAck("design:review:update", { reviewId: approveButton.dataset.dcApprove, status: "approved", response: "Đã duyệt trong HH Design" }).catch((error) => setMessage(error.message, "error"));
      const pin = event.target.closest("[data-dc-comment-id]");
      if (pin) { state.tab = "comments"; return render(); }
      const canvasNode = event.target.closest("[data-dc-canvas]");
      if (canvasNode && state.commentMode && can("commenter") && !readonly()) { state.pinDraft = { ...positionFromEvent(event, canvasNode), body: "" }; state.tab = "comments"; state.commentMode = false; render(); root.querySelector("[data-dc-comment-form] textarea")?.focus(); }
    }

    async function onSubmit(event) {
      event.preventDefault();
      const commentForm = event.target.closest("[data-dc-comment-form]");
      if (commentForm) {
        const form = new FormData(commentForm);
        try {
          await emitAck("design:comment:add", { body: form.get("body"), x: form.get("x"), y: form.get("y"), artboardId: "hero", layerId: state.selectedLayers[0] || "" });
          state.pinDraft = null;
          return setMessage("Đã ghim bình luận lên canvas.");
        } catch (error) { return setMessage(error.message, "error"); }
      }
      const branchForm = event.target.closest("[data-dc-branch-form]");
      if (branchForm) {
        const form = new FormData(branchForm);
        try { await emitAck("design:branch:create", { name: form.get("name"), baseVersionId: state.room?.versions?.at(-1)?.id || "" }); return setMessage("Đã tạo nhánh thiết kế."); }
        catch (error) { return setMessage(error.message, "error"); }
      }
    }

    function onChange(event) {
      const role = event.target.closest("[data-dc-role-user]");
      if (role) emitAck("design:permission:set", { userId: role.dataset.dcRoleUser, role: role.value }).catch((error) => setMessage(error.message, "error"));
    }

    function onPointerMove(event) {
      const canvasNode = event.target.closest?.("[data-dc-canvas]");
      if (!canvasNode || !state.room || readonly()) return;
      pendingCursor = { ...positionFromEvent(event, canvasNode), artboardId: "hero", color: "#62d7e7" };
      if (cursorFrame) return;
      cursorFrame = globalScope.requestAnimationFrame?.(() => {
        cursorFrame = 0;
        if (pendingCursor) state.socket?.emit("design:cursor", pendingCursor);
      }) || setTimeout(() => { cursorFrame = 0; if (pendingCursor) state.socket?.emit("design:cursor", pendingCursor); }, 32);
    }

    function unmountController() {
      state.destroyed = true;
      root.removeEventListener("click", onClick);
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("change", onChange);
      root.removeEventListener("pointermove", onPointerMove);
      socketHandlers.forEach(([event, handler]) => state.socket?.off(event, handler));
      if (state.room?.code && state.room.code !== "LOCAL" && state.socket?.connected) state.socket.emit("design:room:leave", {});
      if (state.ownSocket) state.socket?.disconnect();
      if (cursorFrame) (globalScope.cancelAnimationFrame || clearTimeout)(cursorFrame);
      root.replaceChildren();
      root.removeAttribute("data-hh-design-collaboration");
    }

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("change", onChange);
    root.addEventListener("pointermove", onPointerMove);
    render();
    connect();
    return { getState: () => ({ ...state, socket: undefined }), createRoom: (name) => emitAck("design:room:create", { name }).then(applyRoom), joinRoom: (code) => emitAck("design:room:join", { code }).then(applyRoom), leaveRoom: () => emitAck("design:room:leave"), unmount: unmountController };
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const controller = createController(root, options);
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    instances.delete(root);
    return true;
  }

  const api = { VERSION, ROLE_LABELS, SAMPLE_LAYERS: SAMPLE_LAYERS.map((item) => ({ ...item })), createFallbackRoom, positionFromEvent, mount, unmount };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicCollaboration = api;
}(typeof window !== "undefined" ? window : globalThis));
