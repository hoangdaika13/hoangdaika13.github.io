(() => {
  "use strict";

  const peers = new Map();
  const pendingCandidates = new Map();
  let socket = null;
  let call = null;
  let localStream = null;
  let displayStream = null;
  let devices = { cameras: [], microphones: [], speakers: [] };

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const user = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const notice = (message, type = "success") => window.HHCommunity?.notice?.(message, type);

  function emit(event, payload = {}, timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error("Máy chủ signaling chưa trực tuyến. Hãy cấu hình HH_SOCKET_URL."));
      const timer = setTimeout(() => reject(new Error("Máy chủ cuộc gọi không phản hồi.")), timeout);
      socket.emit(event, payload, (result = {}) => {
        clearTimeout(timer);
        if (!result.ok) reject(new Error(result.error || "Không thể thực hiện cuộc gọi."));
        else resolve(result);
      });
    });
  }

  function stage() {
    return document.querySelector("[data-hh-call-stage]");
  }

  function tileId(socketId) {
    return `hh-call-peer-${String(socketId).replace(/[^a-z0-9_-]/gi, "")}`;
  }

  function renderStage() {
    document.querySelector("[data-hh-call-stage]")?.remove();
    const element = document.createElement("section");
    element.className = `hh-call-stage ${call?.type === "audio" ? "audio-only" : ""}`;
    element.dataset.hhCallStage = "";
    element.innerHTML = `<header><div><small>${call?.group ? "CUỘC GỌI NHÓM" : "CUỘC GỌI RIÊNG"}</small><strong>${call?.type === "audio" ? "Cuộc gọi thoại" : "Cuộc gọi video"}</strong><span data-hh-call-status>Đang kết nối...</span></div><div><i></i><span>${call?.participants?.length || 1} người</span></div></header><div class="hh-call-grid" data-hh-call-grid><article class="local" data-call-tile="local"><video autoplay muted playsinline></video><div><strong>${esc(user().name || "Bạn")}</strong><span>Bạn</span></div></article></div><footer><button type="button" data-call-control="mic" class="active" title="Tắt microphone" aria-label="Microphone">🎙</button><button type="button" data-call-control="camera" class="${call?.type === "video" ? "active" : ""}" title="Bật hoặc tắt camera" aria-label="Camera">▣</button><button type="button" data-call-control="screen" title="Chia sẻ màn hình" aria-label="Chia sẻ màn hình">▤</button><button type="button" data-call-control="devices" title="Chọn thiết bị" aria-label="Chọn thiết bị">⚙</button><button type="button" data-call-control="end" class="danger" title="Kết thúc cuộc gọi" aria-label="Kết thúc">☎</button></footer><aside data-hh-call-devices hidden></aside><p class="hh-call-security">WebRTC + TLS/WSS · Chưa bật mã hóa đầu cuối riêng</p>`;
    document.body.append(element);
    const localVideo = element.querySelector("[data-call-tile='local'] video");
    if (localVideo && localStream) localVideo.srcObject = localStream;
    return element;
  }

  function setStatus(text) {
    const node = stage()?.querySelector("[data-hh-call-status]");
    if (node) node.textContent = text;
  }

  function ensureRemoteTile(socketId, person = {}) {
    const grid = stage()?.querySelector("[data-hh-call-grid]");
    if (!grid) return null;
    let tile = grid.querySelector(`#${CSS.escape(tileId(socketId))}`);
    if (!tile) {
      tile = document.createElement("article");
      tile.id = tileId(socketId);
      tile.dataset.callTile = socketId;
      tile.innerHTML = `<video autoplay playsinline></video><div><strong>${esc(person.name || "Thành viên HH")}</strong><span data-call-media-state>Đang kết nối</span></div>`;
      grid.append(tile);
    }
    return tile;
  }

  function removePeer(socketId) {
    const peer = peers.get(socketId);
    if (peer) peer.close();
    peers.delete(socketId);
    pendingCandidates.delete(socketId);
    document.getElementById(tileId(socketId))?.remove();
  }

  function sendSignal(targetSocketId, signal) {
    if (!call) return;
    socket.emit("call:signal", { callId: call.id, targetSocketId, signal });
  }

  function createPeer(targetSocketId, person = {}) {
    if (peers.has(targetSocketId)) return peers.get(targetSocketId);
    const peer = new RTCPeerConnection({ iceServers: call?.iceServers || [] });
    peers.set(targetSocketId, peer);
    localStream?.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.addEventListener("icecandidate", (event) => { if (event.candidate) sendSignal(targetSocketId, { candidate: event.candidate }); });
    peer.addEventListener("track", (event) => {
      const tile = ensureRemoteTile(targetSocketId, person);
      const video = tile?.querySelector("video");
      if (video && video.srcObject !== event.streams[0]) video.srcObject = event.streams[0];
      const status = tile?.querySelector("[data-call-media-state]");
      if (status) status.textContent = "Đã kết nối";
    });
    peer.addEventListener("connectionstatechange", () => {
      if (["failed", "closed"].includes(peer.connectionState)) removePeer(targetSocketId);
      else if (peer.connectionState === "connected") setStatus("Đang trong cuộc gọi");
    });
    return peer;
  }

  async function offerTo(participant) {
    const peer = createPeer(participant.socketId, participant.user);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal(participant.socketId, { description: peer.localDescription });
  }

  async function handleSignal(payload = {}) {
    if (!call || payload.callId !== call.id || !payload.fromSocketId) return;
    const peer = createPeer(payload.fromSocketId, payload.from || {});
    try {
      if (payload.signal?.description) {
        const description = new RTCSessionDescription(payload.signal.description);
        await peer.setRemoteDescription(description);
        const queued = pendingCandidates.get(payload.fromSocketId) || [];
        for (const candidate of queued) await peer.addIceCandidate(candidate).catch(() => {});
        pendingCandidates.delete(payload.fromSocketId);
        if (description.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal(payload.fromSocketId, { description: peer.localDescription });
        }
      } else if (payload.signal?.candidate) {
        const candidate = new RTCIceCandidate(payload.signal.candidate);
        if (peer.remoteDescription) await peer.addIceCandidate(candidate);
        else pendingCandidates.set(payload.fromSocketId, [...(pendingCandidates.get(payload.fromSocketId) || []), candidate]);
      }
    } catch (error) {
      console.warn("WebRTC signaling failed", error);
    }
  }

  async function getLocalMedia(type, constraints = {}) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ camera/microphone.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints.audioDeviceId ? { deviceId: { exact: constraints.audioDeviceId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
      video: type === "video" ? (constraints.videoDeviceId ? { deviceId: { exact: constraints.videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }) : false
    });
    return stream;
  }

  async function start(room, type = "video") {
    bindSocket();
    if (!socket?.connected) throw new Error("Cuộc gọi cần máy chủ Socket.io chạy liên tục. HH_SOCKET_URL hiện chưa sẵn sàng.");
    localStream = await getLocalMedia(type);
    const result = await emit("call:start", { room, type });
    call = { ...result.call, iceServers: result.iceServers || [], maxParticipants: result.maxParticipants || 8 };
    if (result.existing) {
      const joined = await emit("call:join", { callId: call.id, mic: true, camera: type === "video" });
      call = { ...joined.call, iceServers: joined.iceServers || result.iceServers || [] };
    }
    renderStage();
    setStatus(result.existing ? "Đã tham gia cuộc gọi" : "Đang gọi...");
  }

  async function join(incoming) {
    bindSocket();
    const type = incoming.call?.type || "video";
    localStream = await getLocalMedia(type);
    const result = await emit("call:join", { callId: incoming.call.id, mic: true, camera: type === "video" });
    call = { ...result.call, iceServers: result.iceServers || incoming.iceServers || [] };
    document.querySelector("[data-hh-incoming-call]")?.remove();
    renderStage();
    setStatus("Đang trong cuộc gọi");
  }

  function showIncoming(payload = {}) {
    if (!payload.call?.id || call) return;
    document.querySelector("[data-hh-incoming-call]")?.remove();
    const element = document.createElement("section");
    element.className = "hh-incoming-call";
    element.dataset.hhIncomingCall = "";
    element.innerHTML = `<div><i>${esc((payload.caller?.name || "HH").split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase())}</i><span><small>${payload.call.type === "audio" ? "CUỘC GỌI THOẠI" : "CUỘC GỌI VIDEO"}</small><strong>${esc(payload.caller?.name || "Thành viên HH")}</strong><p>${payload.call.group ? "Cuộc gọi nhóm" : "Cuộc gọi riêng"}</p></span></div><footer><button type="button" data-call-decline>✕</button><button type="button" data-call-accept>✓</button></footer>`;
    document.body.append(element);
    element.querySelector("[data-call-decline]").addEventListener("click", () => { socket?.emit("call:decline", { callId: payload.call.id }); element.remove(); });
    element.querySelector("[data-call-accept]").addEventListener("click", async () => { try { await join(payload); } catch (error) { element.remove(); notice(error.message, "error"); cleanup(false); } });
    setTimeout(() => element.isConnected && element.remove(), 45000);
  }

  async function replaceTrack(kind, track) {
    for (const peer of peers.values()) {
      const sender = peer.getSenders().find((item) => item.track?.kind === kind);
      if (sender) await sender.replaceTrack(track);
      else if (track && localStream) peer.addTrack(track, localStream);
    }
  }

  async function toggleMic(button) {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    button.classList.toggle("active", track.enabled);
    socket?.emit("call:media", { callId: call?.id, mic: track.enabled, camera: Boolean(localStream?.getVideoTracks()[0]?.enabled), screen: Boolean(displayStream) });
  }

  async function toggleCamera(button) {
    let track = localStream?.getVideoTracks()[0];
    if (!track && call?.type === "video") {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      track = stream.getVideoTracks()[0];
      localStream.addTrack(track);
      await replaceTrack("video", track);
      const video = stage()?.querySelector("[data-call-tile='local'] video");
      if (video) video.srcObject = localStream;
    } else if (track) track.enabled = !track.enabled;
    button.classList.toggle("active", Boolean(track?.enabled));
    socket?.emit("call:media", { callId: call?.id, mic: Boolean(localStream?.getAudioTracks()[0]?.enabled), camera: Boolean(track?.enabled), screen: Boolean(displayStream) });
  }

  async function toggleScreen(button) {
    if (displayStream) {
      displayStream.getTracks().forEach((track) => track.stop());
      displayStream = null;
      await replaceTrack("video", localStream?.getVideoTracks()[0] || null);
      button.classList.remove("active");
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Trình duyệt chưa hỗ trợ chia sẻ màn hình.");
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = displayStream.getVideoTracks()[0];
      await replaceTrack("video", track);
      button.classList.add("active");
      track.addEventListener("ended", () => { if (displayStream) toggleScreen(button).catch(() => {}); }, { once: true });
    }
    socket?.emit("call:media", { callId: call?.id, mic: Boolean(localStream?.getAudioTracks()[0]?.enabled), camera: Boolean(localStream?.getVideoTracks()[0]?.enabled), screen: Boolean(displayStream) });
  }

  async function enumerateDevices() {
    const list = await navigator.mediaDevices.enumerateDevices();
    devices = { cameras: list.filter((item) => item.kind === "videoinput"), microphones: list.filter((item) => item.kind === "audioinput"), speakers: list.filter((item) => item.kind === "audiooutput") };
    return devices;
  }

  async function showDevices() {
    const aside = stage()?.querySelector("[data-hh-call-devices]");
    if (!aside) return;
    await enumerateDevices();
    aside.hidden = !aside.hidden;
    const speakerControl = typeof HTMLMediaElement.prototype.setSinkId === "function" && devices.speakers.length
      ? `<label><span>Loa</span><select data-call-device="output">${devices.speakers.map((item, index) => `<option value="${esc(item.deviceId)}">${esc(item.label || `Loa ${index + 1}`)}</option>`).join("")}</select></label>`
      : '<p>Trình duyệt đang dùng loa mặc định của hệ thống.</p>';
    aside.innerHTML = `<header><strong>Thiết bị cuộc gọi</strong><button type="button" data-call-devices-close>×</button></header><label><span>Microphone</span><select data-call-device="audio">${devices.microphones.map((item, index) => `<option value="${esc(item.deviceId)}">${esc(item.label || `Microphone ${index + 1}`)}</option>`).join("")}</select></label><label><span>Camera</span><select data-call-device="video">${devices.cameras.map((item, index) => `<option value="${esc(item.deviceId)}">${esc(item.label || `Camera ${index + 1}`)}</option>`).join("")}</select></label>${speakerControl}`;
  }

  async function switchDevice(kind, deviceId) {
    if (kind === "output") {
      const media = [...(stage()?.querySelectorAll("video, audio") || [])];
      await Promise.all(media.filter((item) => typeof item.setSinkId === "function").map((item) => item.setSinkId(deviceId)));
      notice("Đã chuyển thiết bị phát âm thanh.");
      return;
    }
    const media = await navigator.mediaDevices.getUserMedia(kind === "audio" ? { audio: { deviceId: { exact: deviceId } } } : { video: { deviceId: { exact: deviceId } } });
    const track = kind === "audio" ? media.getAudioTracks()[0] : media.getVideoTracks()[0];
    const old = kind === "audio" ? localStream?.getAudioTracks()[0] : localStream?.getVideoTracks()[0];
    old?.stop();
    if (old) localStream.removeTrack(old);
    localStream.addTrack(track);
    await replaceTrack(kind, track);
    const localVideo = stage()?.querySelector("[data-call-tile='local'] video");
    if (localVideo) localVideo.srcObject = localStream;
  }

  async function hangup(remoteEnded = false) {
    if (call && !remoteEnded && socket?.connected) {
      const mine = String(call.startedBy?.id || "") === String(user().id || "");
      const event = !call.group || mine ? "call:end" : "call:leave";
      await emit(event, { callId: call.id, reason: "hangup" }).catch(() => {});
    }
    cleanup();
  }

  function cleanup(removeIncoming = true) {
    peers.forEach((peer) => peer.close());
    peers.clear();
    pendingCandidates.clear();
    localStream?.getTracks().forEach((track) => track.stop());
    displayStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    displayStream = null;
    call = null;
    stage()?.remove();
    if (removeIncoming) document.querySelector("[data-hh-incoming-call]")?.remove();
  }

  function bindSocket() {
    const next = window.HHRealtimeSocket;
    if (!next || socket === next) return;
    socket = next;
    socket.on("call:incoming", showIncoming);
    socket.on("call:signal", handleSignal);
    socket.on("call:participant:joined", (payload) => { if (call && payload.callId === call.id) offerTo(payload.participant).catch(() => {}); });
    socket.on("call:participant:left", (payload) => { if (call && payload.callId === call.id) removePeer(payload.socketId); });
    socket.on("call:participant:media", (payload) => { const label = document.getElementById(tileId(payload.socketId))?.querySelector("[data-call-media-state]"); if (label) label.textContent = `${payload.media?.mic ? "Mic bật" : "Mic tắt"}${payload.media?.screen ? " · Đang chia sẻ" : payload.media?.camera ? " · Camera bật" : " · Camera tắt"}`; });
    socket.on("call:ended", (payload) => { if (call && payload.callId === call.id) { notice("Cuộc gọi đã kết thúc."); hangup(true); } });
    socket.on("call:declined", (payload) => { if (call && payload.callId === call.id) setStatus(`${payload.user?.name || "Thành viên"} đã từ chối`); });
    socket.on("call:host", (payload) => { if (call && payload.callId === call.id) call.startedBy = payload.startedBy; });
  }

  document.addEventListener("click", async (event) => {
    const startButton = event.target.closest("[data-hh-call]");
    if (startButton) {
      startButton.disabled = true;
      try { await start(startButton.dataset.room, startButton.dataset.hhCall); }
      catch (error) { cleanup(); notice(error.name === "NotAllowedError" ? "Bạn chưa cấp quyền camera/microphone." : error.message, "error"); }
      finally { startButton.disabled = false; }
      return;
    }
    const control = event.target.closest("[data-call-control]");
    if (control) {
      try {
        if (control.dataset.callControl === "mic") await toggleMic(control);
        else if (control.dataset.callControl === "camera") await toggleCamera(control);
        else if (control.dataset.callControl === "screen") await toggleScreen(control);
        else if (control.dataset.callControl === "devices") await showDevices();
        else if (control.dataset.callControl === "end") await hangup();
      } catch (error) { notice(error.message, "error"); }
      return;
    }
    if (event.target.closest("[data-call-devices-close]")) { const aside = stage()?.querySelector("[data-hh-call-devices]"); if (aside) aside.hidden = true; }
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-call-device]");
    if (select) switchDevice(select.dataset.callDevice, select.value).catch((error) => notice(error.message, "error"));
  });

  window.addEventListener("hh:realtime-ready", bindSocket);
  window.addEventListener("beforeunload", () => { if (call && socket?.connected) socket.emit("call:leave", { callId: call.id }); });
  bindSocket();

  window.HHCalls = Object.freeze({ start, hangup, available: () => Boolean(window.HHRealtimeSocket?.connected) });
})();
