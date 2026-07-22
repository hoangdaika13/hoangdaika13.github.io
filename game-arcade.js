(function () {
  const games = [
    ["neon-drift", "Neon Drift", "Đua tàu né cổng plasma", "ND"],
    ["galaxy-defense", "Galaxy Defense", "Thủ thành chống wave", "GD"],
    ["star-colony", "Star Colony", "Xây thuộc địa cân bằng tài nguyên", "SC"],
    ["cipher-run", "Cipher Run", "Giải mã hệ thống bỏ hoang", "CR"],
    ["asteroid-miner", "Asteroid Miner", "Khai thác và craft module", "AM"],
    ["rhythm-reactor", "Rhythm Reactor", "Bấm theo nhịp reactor", "RR"],
    ["quiz-arena", "Quiz Arena", "Đấu kiến thức nhanh", "QA"],
    ["creative-sandbox", "Creative Sandbox", "Xây tàu, map và hành tinh", "CS"],
    ["space-chess", "Space Chess", "Cờ chiến thuật kỹ năng", "SX"],
    ["survival-orbit", "Survival Orbit", "Sinh tồn trên trạm", "SO"]
  ].map(([id, title, desc, icon]) => ({ id, title, desc, icon }));
  const STORE = "hh.arcade.v1";
  let root;
  let active = "neon-drift";
  let running = false;
  let score = 0;
  let combo = 1;
  let level = 1;
  let raf = 0;
  let state = load();
  let ctx;
  let canvas;
  let tick = 0;
  let player = { x: 100, y: 100, vx: 0, vy: 0 };
  let objects = [];
  const keys = new Set();
  const questions = [
    { q: "Hành tinh đỏ là?", a: "Sao Hỏa", choices: ["Sao Hỏa", "Sao Kim", "Sao Thủy"] },
    { q: "CSS dùng để?", a: "Tạo giao diện", choices: ["Tạo giao diện", "Nấu ăn", "Sạc pin"] },
    { q: "BPM trong nhạc là?", a: "Nhịp mỗi phút", choices: ["Nhịp mỗi phút", "Độ sáng", "Dung lượng"] }
  ];
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
  }
  function save() {
    localStorage.setItem(STORE, JSON.stringify(state));
  }
  function reward(xp = 25) {
    window.dispatchEvent(new CustomEvent("hh:game-reward", { detail: { source: "arcade", gameId: active, score, xp } }));
  }
  function resetGame() {
    score = 0;
    combo = 1;
    level = Number(state[active]?.level || 1);
    tick = 0;
    player = { x: 80, y: 180, vx: 0, vy: 0 };
    objects = Array.from({ length: 12 }, (_, i) => ({
      x: 220 + i * 90,
      y: 60 + Math.random() * 260,
      r: 12 + Math.random() * 18,
      type: i % 4 === 0 ? "reward" : "hazard"
    }));
  }
  function start() {
    running = true;
    loop();
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function endRound() {
    running = false;
    state[active] = { high: Math.max(state[active]?.high || 0, score), level: Math.max(level, state[active]?.level || 1), last: Date.now() };
    save();
    reward(Math.max(20, Math.round(score / 10)));
    render();
  }
  function drawStars(w, h) {
    ctx.fillStyle = "#050812";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = (i * 97 + tick * (i % 5 + 1)) % w;
      const y = (i * 43) % h;
      ctx.fillStyle = i % 9 === 0 ? "#ff63c9" : "#67f2ff";
      ctx.globalAlpha = 0.25 + (i % 5) * 0.08;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawCanvasGame() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    drawStars(w, h);
    const speed = 2 + level * 0.45;
    if (keys.has("ArrowUp") || keys.has("w")) player.vy -= 0.34;
    if (keys.has("ArrowDown") || keys.has("s")) player.vy += 0.34;
    if (keys.has("ArrowLeft") || keys.has("a")) player.vx -= 0.34;
    if (keys.has("ArrowRight") || keys.has("d")) player.vx += 0.34;
    player.vx *= 0.92;
    player.vy *= 0.92;
    player.x = Math.max(22, Math.min(w - 22, player.x + player.vx));
    player.y = Math.max(22, Math.min(h - 22, player.y + player.vy));
    objects.forEach((obj) => {
      obj.x -= speed;
      if (obj.x < -40) {
        obj.x = w + 80 + Math.random() * 160;
        obj.y = 44 + Math.random() * (h - 88);
        obj.type = Math.random() > 0.68 ? "reward" : "hazard";
      }
      const dx = obj.x - player.x;
      const dy = obj.y - player.y;
      if (Math.hypot(dx, dy) < obj.r + 16) {
        if (obj.type === "reward") {
          score += 30 * combo;
          combo = Math.min(9, combo + 1);
        } else {
          score = Math.max(0, score - 25);
          combo = 1;
        }
        obj.x = w + 140;
      }
      ctx.beginPath();
      ctx.fillStyle = obj.type === "reward" ? "#ffe66f" : "#ff63c9";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 18;
      ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = "#67f2ff";
    ctx.shadowColor = "#67f2ff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-16, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#eef8ff";
    ctx.font = "800 15px system-ui";
    ctx.fillText(`Score ${score}  Combo x${combo}  Level ${level}`, 16, 28);
  }
  function loop() {
    if (!running) return;
    tick += 1;
    drawCanvasGame();
    if (tick % 300 === 0) level += 1;
    raf = requestAnimationFrame(loop);
  }
  function runPanelAction(type) {
    if (type === "build") score += 70;
    if (type === "solve") score += 90;
    if (type === "mine") score += 60 + Math.round(Math.random() * 80);
    if (type === "rhythm") {
      const hit = Math.random() > 0.25;
      score += hit ? 120 * combo : -20;
      combo = hit ? Math.min(12, combo + 1) : 1;
    }
    if (type === "quiz") score += 100;
    if (type === "sandbox") score += 50;
    if (type === "chess") score += 80;
    if (type === "survival") score += 75;
    render();
  }
  function activeGame() {
    return games.find((game) => game.id === active) || games[0];
  }
  function panelForGame() {
    if (active === "star-colony") return `<div class="ag-panel">${["Oxy", "Năng lượng", "Farm", "Lab"].map((name) => `<div class="ag-card"><h4>${name}</h4><p>Nâng module để thuộc địa sống sót lâu hơn.</p><button data-ag-action="build">Xây +</button></div>`).join("")}</div>`;
    if (active === "cipher-run") return `<div class="ag-card"><h4>Mật mã</h4><p>Chuỗi: HH-13-ASTRA. Chọn khóa đúng để mở cửa.</p><div class="ag-grid">${["A", "S", "T", "R", "A", "13"].map((x) => `<div class="ag-tile" data-ag-action="solve">${x}</div>`).join("")}</div></div>`;
    if (active === "asteroid-miner") return `<div class="ag-panel">${["Ore", "Crystal", "Plasma", "Relic"].map((name) => `<div class="ag-card"><h4>${name}</h4><p>Khoan nhanh, có tỉ lệ nhận vật phẩm hiếm.</p><button data-ag-action="mine">Khai thác</button></div>`).join("")}</div>`;
    if (active === "rhythm-reactor") return `<div class="ag-card"><h4>Reactor pads</h4><p>Bấm ô sáng để giữ combo nhịp.</p><div class="ag-grid">${Array.from({ length: 9 }, (_, i) => `<div class="ag-tile ${i === tick % 9 ? "is-lit" : ""}" data-ag-action="rhythm">${i + 1}</div>`).join("")}</div></div>`;
    if (active === "quiz-arena") return `<div class="ag-panel">${questions.map((q) => `<div class="ag-card"><h4>${q.q}</h4>${q.choices.map((c) => `<button data-ag-action="quiz">${c}</button>`).join("")}</div>`).join("")}</div>`;
    if (active === "creative-sandbox") return `<div class="ag-panel">${["Mũi tàu", "Cánh", "Động cơ", "Hành tinh"].map((name) => `<div class="ag-card"><h4>${name}</h4><p>Thêm vào bản thiết kế sandbox.</p><button data-ag-action="sandbox">Thêm</button></div>`).join("")}</div>`;
    if (active === "space-chess") return `<div class="ag-card"><h4>Bàn chiến thuật</h4><div class="ag-grid">${Array.from({ length: 9 }, (_, i) => `<div class="ag-tile" data-ag-action="chess">${i % 2 ? "◇" : "◆"}</div>`).join("")}</div></div>`;
    if (active === "survival-orbit") return `<div class="ag-panel">${["Sửa oxy", "Tắt cháy", "Sạc pin", "Khóa cửa"].map((name) => `<div class="ag-card"><h4>${name}</h4><p>Giữ trạm sống sót qua từng phút.</p><button data-ag-action="survival">Làm ngay</button></div>`).join("")}</div>`;
    return `<canvas class="ag-canvas" data-ag-canvas tabindex="0" aria-label="Arcade canvas"></canvas>`;
  }
  function render() {
    if (!root) return;
    const game = activeGame();
    root.innerHTML = `
      <section class="hh-arcade">
        <div class="ag-hero">
          <div>
            <p class="ag-kicker">Arcade Galaxy</p>
            <h2>10 game phụ để farm XP và nghỉ tay</h2>
            <p>Chọn từng game nhỏ, chơi nhanh ngay trên web, nhận XP chung cho Game Center. Các game dùng local fallback nên vẫn chạy khi backend chưa bật.</p>
          </div>
          <div class="ag-score">
            <div>Score<b>${score}</b></div>
            <div>Combo<b>x${combo}</b></div>
            <div>Level<b>${level}</b></div>
          </div>
        </div>
        <div class="ag-layout">
          <nav class="ag-menu">${games.map((item) => `
            <button class="ag-game-button ${active === item.id ? "is-active" : ""}" type="button" data-ag-game="${item.id}">
              <span class="ag-icon">${item.icon}</span><span><h3>${item.title}</h3><small>${item.desc}</small></span><b>${state[item.id]?.high || 0}</b>
            </button>`).join("")}</nav>
          <main class="ag-stage">
            <div class="ag-stage-head">
              <div><p class="ag-kicker">${game.icon} - Playable module</p><h3>${game.title}</h3><p>${game.desc}</p></div>
              <div class="ag-controls">
                <button class="is-primary" type="button" data-ag-start>Chơi</button>
                <button type="button" data-ag-pause>Tạm dừng</button>
                <button type="button" data-ag-reset>Reset</button>
                <button type="button" data-ag-end>Nhận thưởng</button>
              </div>
            </div>
            <div class="ag-playfield">${panelForGame()}</div>
          </main>
          <aside class="ag-side">
            <h3>Hướng dẫn nhanh</h3>
            <p>Canvas game dùng WASD hoặc phím mũi tên. Game panel bấm trực tiếp vào các ô/nút tác vụ.</p>
            <button class="is-primary" type="button" data-ag-end>Lưu điểm & nhận XP</button>
            <div class="ag-log">
              ${games.slice(0, 5).map((item) => `<div>${item.title}: kỷ lục ${state[item.id]?.high || 0}</div>`).join("")}
            </div>
          </aside>
        </div>
      </section>`;
    root.querySelectorAll("[data-ag-game]").forEach((button) => button.addEventListener("click", () => {
      pause();
      active = button.dataset.agGame;
      resetGame();
      render();
    }));
    root.querySelectorAll("[data-ag-start]").forEach((button) => button.addEventListener("click", start));
    root.querySelectorAll("[data-ag-pause]").forEach((button) => button.addEventListener("click", pause));
    root.querySelectorAll("[data-ag-reset]").forEach((button) => button.addEventListener("click", () => { resetGame(); render(); }));
    root.querySelectorAll("[data-ag-end]").forEach((button) => button.addEventListener("click", endRound));
    root.querySelectorAll("[data-ag-action]").forEach((button) => button.addEventListener("click", () => runPanelAction(button.dataset.agAction)));
    canvas = root.querySelector("[data-ag-canvas]");
    ctx = canvas?.getContext("2d") || null;
    drawCanvasGame();
    if (running) loop();
  }
  function onKey(event) {
    keys.add(event.key);
  }
  function onKeyUp(event) {
    keys.delete(event.key);
  }
  window.HHGameArcade = {
    mount(host) {
      root = host;
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKeyUp);
      resetGame();
      render();
    },
    unmount() {
      pause();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      if (root) root.innerHTML = "";
      root = null;
    },
    inspect() { return { active, games, state, score, running }; }
  };
  window.dispatchEvent(new CustomEvent("hh:game-arcade-ready"));
})();
