(function (scope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else scope.HHStudyRoomCore = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const WIDTH = 1200, HEIGHT = 800, MAX_OBJECTS = 160;
  const fail = (message, code = "STUDY_INVALID", statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
  const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
  const number = (value, min, max) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail("Tọa độ bảng trắng không hợp lệ.");
    return Math.round(value * 10) / 10;
  };
  function boardObject(input, owner, version) {
    if (!input || !validId(input.id) || !["stroke", "rect", "ellipse", "text","note","line","arrow"].includes(input.kind)) fail("Đối tượng bảng trắng không hợp lệ.");
    if (typeof input.color !== "string" || !/^#[a-f0-9]{6}$/i.test(input.color)) fail("Màu bảng trắng không hợp lệ.");
    const object = { id: input.id, owner, version, kind: input.kind, color: input.color, size: number(input.size, 1, 12), x: number(input.x, 0, WIDTH), y: number(input.y, 0, HEIGHT), w: number(input.w, 1, WIDTH), h: number(input.h, 1, HEIGHT) };
    if (object.x + object.w > WIDTH + 1 || object.y + object.h > HEIGHT + 1) fail("Đối tượng cần nằm trong vùng bảng trắng.");
    if (input.kind === "stroke"||input.kind==="line"||input.kind==="arrow") {
      if (!Array.isArray(input.points) || input.points.length < 1 || input.points.length > 128) fail("Một nét vẽ cần từ 1 đến 128 điểm.");
      if(input.kind!=='stroke'&&input.points.length!==2)fail('Đường nối/mũi tên cần đúng hai điểm.');
      object.points = input.points.map(point => {
        if (!Array.isArray(point) || point.length !== 2) fail("Điểm vẽ không hợp lệ.");
        return [Math.min(object.w,number(point[0], 0, object.w+0.1)), Math.min(object.h,number(point[1], 0, object.h+0.1))];
      });
    }
    if (input.kind === "text"||input.kind==="note") {
      if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 240) fail("Chữ trên bảng tối đa 240 ký tự.");
      object.text = input.text;
    }
    if(input.group!==undefined){if(!validId(input.group))fail('Nhóm đối tượng không hợp lệ.');object.group=input.group;}
    return object;
  }
  function applyBoard(board, operations, actor, host, batchId) {
    if (!validId(batchId) || !Array.isArray(operations) || operations.length < 1 || operations.length > 12) fail("Một lần cập nhật cần từ 1 đến 12 thao tác.");
    const batch = actor + ":" + batchId;
    if (board.batches?.includes(batch)) return { ...board, duplicate: true };
    const objects = new Map((board.objects || []).map(object => [object.id, object]));
    let tombstones = [...(board.tombstones || [])];
    for (const operation of operations) {
      if (!operation || !validId(operation.id) || !["add", "update", "delete"].includes(operation.type)) fail("Thao tác bảng trắng không hợp lệ.");
      const old = objects.get(operation.id), removed = tombstones.find(item => item.id === operation.id);
      if (old && old.owner !== actor && !host) fail("Bạn chỉ được sửa nét vẽ của mình.", "BOARD_OWNER", 403);
      if (operation.type === "add") {
        if (old || removed && (removed.owner !== actor || operation.baseVersion !== removed.version)) fail("Đối tượng đã thay đổi. Tải bản mới trước khi thử lại.", "BOARD_CONFLICT", 409);
        objects.set(operation.id, boardObject({ ...operation.object, id: operation.id }, actor, (removed?.version || 0) + 1));
        tombstones = tombstones.filter(item => item.id !== operation.id);
      } else {
        if (!old || !Number.isInteger(operation.baseVersion) || operation.baseVersion !== old.version) fail("Nét vẽ đã thay đổi. Tải bản mới trước khi sửa.", "BOARD_CONFLICT", 409);
        if (operation.type === "update") objects.set(operation.id, boardObject({ ...operation.object, id: operation.id }, old.owner, old.version + 1));
        else { objects.delete(operation.id); tombstones = [...tombstones.filter(item => item.id !== operation.id), { id: operation.id, owner: old.owner, version: old.version + 1 }].slice(-256); }
      }
      if (objects.size > MAX_OBJECTS) fail("Bảng đạt giới hạn 160 đối tượng. Xóa bớt nét vẽ trước khi thêm.", "BOARD_FULL", 409);
    }
    const next = { revision: (board.revision || 0) + 1, objects: [...objects.values()], tombstones, batches: [...(board.batches || []), batch].slice(-128) };
    if (JSON.stringify(next).length > 180000) fail("Bảng trắng đạt giới hạn dữ liệu. Xóa bớt nội dung trước khi thêm.", "BOARD_FULL", 409);
    return next;
  }
  function publicPoll(poll, voter) {
    if (!poll) return null;
    const counts = poll.options.map((_, index) => (poll.votes || []).filter(vote => vote.choice === index).length);
    return { id: poll.id, revision: poll.revision, question: poll.question, options: [...poll.options], closed: !!poll.closed, counts, total: counts.reduce((a,b) => a+b,0), ...(voter ? { myVote: poll.votes?.find(vote => vote.voter === voter)?.choice ?? null } : {}) };
  }
  // Local preview only: stale drafts remain visible/exportable, never rebased into a server write.
  function previewBoard(board,operations,actor){
    const objects=new Map((board.objects||[]).map(object=>[object.id,object]));
    for(const operation of (operations||[]).slice(0,12)){
      if(!operation||!validId(operation.id))continue;
      const current=objects.get(operation.id);if(current&&current.owner!==actor)continue;
      if(operation.type==="delete")objects.delete(operation.id);
      else if(["add","update"].includes(operation.type))try{objects.set(operation.id,boardObject({...operation.object,id:operation.id},actor,current?.version||0));}catch{}
    }
    return [...objects.values()];
  }
  function newPoll(question, options, id, revision = 1) {
    if (typeof question !== "string" || !question.trim() || question.length > 240 || !Array.isArray(options) || options.length < 2 || options.length > 6 || options.some(option => typeof option !== "string" || !option.trim() || option.length > 100)) fail("Bình chọn cần câu hỏi và 2–6 đáp án, tối đa 100 ký tự mỗi đáp án.");
    const choices = options.map(option => option.trim());
    if (new Set(choices).size !== choices.length) fail("Các đáp án cần khác nhau.");
    return { id, revision, question: question.trim(), options: choices, closed:false, votes:[] };
  }
  function votePoll(poll, actor, choice, id) {
    if (!poll || poll.id !== id || poll.closed) fail("Bình chọn đã đóng hoặc đã thay đổi.", "POLL_CLOSED", 409);
    if (!Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) fail("Đáp án không hợp lệ.");
    const vote = poll.votes.find(item => item.voter === actor);
    if (vote) {
      if (vote.choice !== choice) fail("Bạn đã bình chọn trong câu hỏi này.", "ALREADY_VOTED", 409);
      return { ...poll, duplicate:true };
    }
    if (poll.votes.length >= 500) fail("Bình chọn đạt giới hạn 500 danh tính thành viên.", "POLL_FULL", 409);
    return { ...poll, revision:poll.revision + 1, votes:[...poll.votes,{voter:actor,choice}] };
  }
  function timerSummary(timer, now = Date.now()) {
    const totals = { focusMs:0, breakMs:0, discussionMs:0, completedFocusRounds:0, ...(timer?.totals || {}) };
    if (timer?.running) {
      const start = Number(timer.openedAt ?? Number(timer.deadline) - Number(timer.remainingMs));
      const end = Math.min(now, Number(timer.deadline));
      if (Number.isFinite(start) && Number.isFinite(end)) {
        totals[(timer.phase || "focus") + "Ms"] += Math.max(0,end-start);
        if ((timer.phase || "focus") === "focus" && now >= timer.deadline) totals.completedFocusRounds++;
      }
    }
    return totals;
  }
  function nextTimer(previous, mode, duration, phase, segmentId, now = Date.now()) {
    if (!["start","pause","reset","phase"].includes(mode)) fail("Thao tác đồng hồ không hợp lệ.");
    if ((phase !== undefined || mode === "phase") && !["focus","break","discussion"].includes(phase)) fail("Giai đoạn phiên học không hợp lệ.");
    const totals = timerSummary(previous, now), currentPhase = mode === "phase" ? phase : previous?.phase || "focus";
    const raw = previous?.running ? Number(previous.deadline)-now : previous ? Number(previous.remainingMs) : duration*1000;
    const remaining = Number.isFinite(raw) ? Math.max(0,raw) : 0, fresh = mode === "reset" || mode === "phase" || mode === "start" && remaining === 0;
    const remainingMs = fresh ? duration*1000 : remaining;
    const segments = [...(previous?.segments || [])];
    if (previous?.running) {
      const start = Number(previous.openedAt ?? Number(previous.deadline)-Number(previous.remainingMs)),end=Math.min(now,Number(previous.deadline));
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) segments.push({id:previous.segmentId || "legacy-"+start,phase:previous.phase || "focus",start,end});
    }
    return { revision:(previous?.revision || 0)+1, phase:currentPhase, round:Math.max(1,totals.completedFocusRounds+1), running:mode==="start", duration:fresh || !previous ? duration : previous.duration, remainingMs, deadline:mode==="start"?now+remainingMs:null, openedAt:mode==="start"?now:null, segmentId:mode==="start"?segmentId:null, totals, segments:segments.slice(-32) };
  }
  return Object.freeze({ WIDTH, HEIGHT, MAX_OBJECTS, validId, boardObject, applyBoard, previewBoard, publicPoll, newPoll, votePoll, timerSummary, nextTimer, text });
});
