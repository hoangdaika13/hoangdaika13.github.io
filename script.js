const canvas = document.querySelector(".ambient-canvas");
const context = canvas.getContext("2d");
const scrollMeter = document.querySelector(".scroll-meter");
const themeToggle = document.querySelector(".theme-toggle");
const colors = ["#ff4f9a", "#ffd84d", "#27d98b", "#29c7ff", "#3f63ff", "#ff7a59"];
let particles = [];

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  particles = Array.from({ length: Math.min(80, Math.floor(window.innerWidth / 16)) }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: 2 + Math.random() * 5,
    speed: 0.18 + Math.random() * 0.55,
    drift: -0.25 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
}

function drawParticles() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const particle of particles) {
    particle.y += particle.speed;
    particle.x += particle.drift;

    if (particle.y > window.innerHeight + 16) {
      particle.y = -16;
      particle.x = Math.random() * window.innerWidth;
    }

    context.beginPath();
    context.globalAlpha = 0.34;
    context.fillStyle = particle.color;
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }

  requestAnimationFrame(drawParticles);
}

function updateScrollMeter() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  scrollMeter.style.width = `${Math.min(progress * 100, 100)}%`;
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.14 }
);

document
  .querySelectorAll(".section, .project-card, .quote-band, .tool-shell")
  .forEach((target) => {
    target.classList.add("reveal");
    revealObserver.observe(target);
  });

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  themeToggle.textContent = isDark ? "Tối" : "Sáng";
  localStorage.setItem("hoangdaika13-theme", isDark ? "dark" : "light");
});

if (localStorage.getItem("hoangdaika13-theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Tối";
}

function valueOf(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setStatus(message) {
  const status = document.getElementById("toolStatus");
  if (status) status.textContent = message;
}

function buildPrompt() {
  const title = valueOf("storyTitle") || "Một câu chuyện đời thường nhiều cảm xúc";
  const duration = valueOf("duration") || "8-12 phút";
  const audience = valueOf("audience") || "Người xem 40+";
  const tone = valueOf("tone") || "Kể chuyện đời thường sâu cảm xúc";
  const source = valueOf("sourceText") || "Chưa có nội dung nguồn. Hãy tự xây một câu chuyện mới theo chủ đề.";

  return `Bạn là biên kịch YouTube chuyên viết kịch bản kể chuyện cho ${audience}.

Nhiệm vụ:
- Viết lại hoặc phát triển câu chuyện thành một kịch bản hoàn chỉnh.
- Tiêu đề/chủ đề: ${title}
- Thời lượng mục tiêu: ${duration}
- Phong cách: ${tone}
- Ngôn ngữ: Tiếng Việt tự nhiên, có cảm xúc, dễ nghe khi đọc voice.

Yêu cầu chất lượng:
1. Mở đầu phải có hook mạnh trong 20 giây đầu.
2. Câu chuyện đi theo mạch rõ: mở chuyện, xung đột, bí mật, cao trào, giải quyết, bài học.
3. Không viết outline, không viết bảng, không ghi chú ngoài lề.
4. Không dùng timestamp.
5. Giữ văn phong kể chuyện liền mạch, giàu hình ảnh, phù hợp người xem YouTube.
6. Nếu nội dung nguồn ngắn, hãy phát triển thêm chi tiết hợp lý nhưng không làm mất ý chính.
7. Kết thúc có dư âm, bài học hoặc CTA mềm.

Nội dung nguồn:
${source}`;
}

function buildDraft() {
  const title = valueOf("storyTitle") || "Câu chuyện chưa đặt tên";
  const duration = valueOf("duration") || "8-12 phút";
  const audience = valueOf("audience") || "Người xem 40+";
  const tone = valueOf("tone") || "Kể chuyện đời thường sâu cảm xúc";
  const source = valueOf("sourceText");
  const seed = source || "Một nhân vật chính từng chịu nhiều hiểu lầm, nhưng cuối cùng sự thật được hé lộ và mọi người nhận ra giá trị của lòng tử tế.";

  return `TIÊU ĐỀ: ${title}

ĐỊNH HƯỚNG
- Người xem: ${audience}
- Thời lượng: ${duration}
- Phong cách: ${tone}

HOOK MỞ ĐẦU
Không phải ai im lặng cũng là người sai. Có những sự thật bị chôn giấu nhiều năm, chỉ chờ một ngày rất bình thường để khiến cả gia đình phải nhìn lại mọi chuyện.

TÓM TẮT NGUỒN
${seed}

BẢN NHÁP KỊCH BẢN
Ngày hôm đó bắt đầu như bao ngày khác, nhưng chỉ một câu nói vô tình đã kéo cả nhà trở về với những chuyện tưởng như đã ngủ yên. Nhân vật chính không vội giải thích. Người ấy chỉ lặng lẽ nhìn từng người, như thể đã quen với việc bị hiểu lầm.

Trong quá khứ, có một quyết định rất khó khăn đã được đưa ra. Quyết định ấy khiến nhiều người tổn thương, nhưng phía sau nó lại là một lý do không ai biết. Càng đi sâu vào câu chuyện, người xem càng nhận ra rằng điều đáng sợ nhất không phải là nghèo khó hay mất mát, mà là khi người thân không còn đủ kiên nhẫn để lắng nghe nhau.

Mâu thuẫn bắt đầu tăng lên khi một bằng chứng cũ xuất hiện: một lá thư, một cuộc gọi, một món đồ hoặc một người chứng kiến. Từ đây, mọi lời trách móc trước đó dần đổi thành im lặng. Người từng bị xem là vô tâm hóa ra lại là người âm thầm gánh phần nặng nhất.

CAO TRÀO
Sự thật được nói ra vào đúng lúc không ai còn có thể trốn tránh. Người gây tổn thương phải đối diện với lỗi lầm của mình, còn người chịu đựng cuối cùng cũng được trả lại sự công bằng.

KẾT
Câu chuyện khép lại bằng một bài học nhẹ nhưng sâu: trong gia đình, đôi khi điều cần nhất không phải là thắng trong một cuộc tranh cãi, mà là đủ thương để hỏi: "Ngày đó, bạn đã đau như thế nào?"

GỢI Ý NÂNG CẤP
- Thêm tên nhân vật cụ thể.
- Thêm một bí mật gia đình hoặc plot twist ở giữa.
- Làm đoạn cao trào dài hơn, có đối thoại trực tiếp.
- Tăng cảm xúc ở đoạn kết để phù hợp video YouTube.`;
}

function setOutput(text, message) {
  const output = document.getElementById("outputText");
  output.value = text;
  setStatus(message);
}

document.getElementById("makePrompt")?.addEventListener("click", () => {
  setOutput(buildPrompt(), "Đã tạo prompt. Bạn có thể copy sang AI khác hoặc bấm Gọi Gemini.");
});

document.getElementById("makeDraft")?.addEventListener("click", () => {
  setOutput(buildDraft(), "Đã tạo bản nháp local trong trình duyệt.");
});

document.getElementById("copyOutput")?.addEventListener("click", async () => {
  const output = document.getElementById("outputText");
  if (!output.value.trim()) {
    setStatus("Chưa có nội dung để copy.");
    return;
  }
  await navigator.clipboard.writeText(output.value);
  setStatus("Đã copy kết quả.");
});

document.getElementById("downloadOutput")?.addEventListener("click", () => {
  const output = document.getElementById("outputText");
  if (!output.value.trim()) {
    setStatus("Chưa có nội dung để tải.");
    return;
  }

  const blob = new Blob([output.value], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kich-ban-ai.txt";
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Đã tạo file TXT.");
});

document.getElementById("callGemini")?.addEventListener("click", async () => {
  const apiKey = valueOf("apiKey");
  const model = valueOf("modelName") || "gemini-1.5-flash";

  if (!apiKey) {
    setStatus("Bạn cần nhập API key Gemini nếu muốn gọi AI thật.");
    return;
  }

  setStatus("Đang gọi Gemini...");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt() }]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            topP: 0.95,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";
    setOutput(text || "Gemini không trả về nội dung.", "Gemini đã trả kết quả.");
  } catch (error) {
    setStatus("Không gọi được Gemini. Hãy kiểm tra API key, model hoặc mạng/CORS.");
    console.error(error);
  }
});

resizeCanvas();
drawParticles();
updateScrollMeter();

window.addEventListener("resize", resizeCanvas);
window.addEventListener("scroll", updateScrollMeter, { passive: true });
