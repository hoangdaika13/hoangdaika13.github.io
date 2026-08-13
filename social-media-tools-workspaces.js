(function initSocialToolWorkspaces(root) {
  "use strict";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
  const DEFINITIONS = Object.create(null);
  const register = (kind, ids, options = {}) => ids.forEach((id, index) => { DEFINITIONS[id] = Object.freeze({ kind, variant:index, upload:false, exportImage:false, ...options }); });

  register("image-filter", ["instagram-filter"], { upload:true, exportImage:true });
  register("social-post", ["instagram-post","instagram-story","x-composer","tweet-card","threads-composer","facebook-composer","tiktok-kit","linkedin-composer","pinterest-pin","reddit-formatter","telegram-composer","discord-announcement","mastodon-bluesky","snapchat-story"], { upload:true, exportImage:true });
  register("conversation", ["instagram-dm","whatsapp-mockup","imessage-mockup"]);
  register("media-library", ["instagram-owned-media","youtube-thumbnail","vimeo-thumbnail"]);
  register("metadata", ["open-graph","link-preview-audit"]);
  register("revenue", ["x-revenue"]);
  register("bio-page", ["bio-link"]);
  register("external-studio", ["qr-campaign","subtitle-studio","video-resizer"]);
  register("design", ["profile-picture","cover-generator","meme-studio","quote-card","product-kit","brand-kit"], { upload:true, exportImage:true });
  register("hashtag-lab", ["hashtag-workspace","hashtag-cleaner"]);
  register("url-builder", ["utm-builder","username-link-builder","whatsapp-link","telegram-link","social-share-link","youtube-timestamp"]);
  register("caption-editor", ["caption-formatter"]);
  register("counter", ["social-character-counter"]);
  register("case-editor", ["case-converter"]);
  register("cleanup-editor", ["whitespace-cleaner"]);
  register("font-editor", ["unicode-font-styler"]);
  register("accessibility", ["alt-text-checker"]);
  register("emoji-board", ["emoji-picker"]);
  register("ai-repurpose", ["repurpose"]);
  register("calendar", ["calendar"]);
  register("approval", ["approval"]);
  register("queue", ["publishing-queue"]);
  register("analytics", ["analytics"]);
  register("inbox", ["community-inbox"]);
  register("research", ["competitor-research","social-listening"]);
  register("export-package", ["export-kit"], { upload:true });
  register("video-code", ["youtube-embed"]);
  register("dimensions", ["social-dimensions"]);
  register("palette", ["color-palette"], { upload:true });
  register("communication-planner", ["content-strategy-brief","audience-persona","content-pillar-planner","campaign-objective","channel-mix-planner","editorial-angle-lab"]);
  register("copy-lab", ["hook-library","headline-analyzer","cta-optimizer","ad-copy-variants","ab-test-planner"]);
  register("pr-desk", ["pr-release-builder","media-pitch-builder","press-kit-checklist"]);
  register("brand-safety", ["crisis-response-builder","holding-statement","brand-safety-audit","claim-compliance-checker","tone-of-voice-audit"]);
  register("community-ops", ["moderation-policy","response-template-library","sentiment-triage"]);
  register("measurement-lab", ["kpi-planner","roi-calculator"]);

  const platformTheme = (tool) => ({
    "instagram-post":["INSTAGRAM","#ed4b8e"], "instagram-story":["STORY","#b94bf1"], "x-composer":["X","#e7f6ff"], "tweet-card":["X CARD","#55b9f3"], "threads-composer":["THREADS","#ffffff"],
    "facebook-composer":["FACEBOOK","#4c87ff"], "tiktok-kit":["TIKTOK","#ff426f"], "linkedin-composer":["LINKEDIN","#4ca6df"], "pinterest-pin":["PINTEREST","#e94b55"], "reddit-formatter":["REDDIT","#ff7041"],
    "telegram-composer":["TELEGRAM","#52b9e9"], "discord-announcement":["DISCORD","#7d8cff"], "mastodon-bluesky":["OPEN SOCIAL","#68d4ff"], "snapchat-story":["SNAPCHAT","#ffe84d"]
  })[tool.id] || [tool.group.toUpperCase(), "#62e1e5"];

  function cardHeader(tool, icon) { return `<header class="smw-hero"><i>${esc(icon)}</i><div><small>${esc(tool.group)}</small><strong>${esc(tool.name)}</strong></div></header>`; }
  function emptyResult(label = "Kết quả sẽ xuất hiện tại đây") { return `<div class="smw-empty"><i>◇</i><strong>${esc(label)}</strong><p>Nhập dữ liệu ở bảng thiết lập rồi chạy công cụ.</p></div>`; }

  function renderSocialPost(tool, p) {
    const [platform, accent] = platformTheme(tool); const story = /story|tiktok|snapchat/.test(tool.id); const pin = tool.id === "pinterest-pin"; const network = tool.id === "reddit-formatter" ? "r/HHCreators" : tool.id === "linkedin-composer" ? "HH Professional" : "@hoang8";
    return `<div class="smw-social-frame ${story?"is-story":""} ${pin?"is-pin":""}" style="--smw-accent:${accent}" data-smt2-canvas><header><span class="smw-avatar">H</span><div><strong>${esc(network)}</strong><small>${esc(platform)} · Bản nháp</small></div><b>•••</b></header><div class="smw-social-media"><span>＋</span><p>${story?"Vùng an toàn 9:16":"Tải ảnh hoặc video để xem trước"}</p><span class="smt2-safe-zone" data-smt2-safe-zone></span></div><article><nav><button>♡</button><button>○</button><button>↗</button><b>☆</b></nav><h2 data-smt2-preview-title>${esc(p.title)}</h2><p data-smt2-preview-caption>${esc(p.caption || "Nội dung bài đăng sẽ hiển thị với đúng bố cục nền tảng.")}</p><small data-smw-live-metric>0 ký tự</small></article></div>`;
  }

  function renderConversation(tool, p) {
    const labels={"instagram-dm":["Instagram Direct","#d64fbb"],"whatsapp-mockup":["WhatsApp","#42d785"],"imessage-mockup":["iMessage","#4a9cff"]},[label,color]=labels[tool.id];
    return `<div class="smw-phone" style="--smw-accent:${color}"><header><b>‹</b><span class="smw-avatar">H</span><div><strong>${label}</strong><small>Đang hoạt động</small></div><b>•••</b></header><main><time>Hôm nay 16:30</time><p class="is-in">Xin chào! Nội dung trao đổi của bạn là gì?</p><p class="is-out" data-smt2-preview-caption>${esc(p.caption || "Nhập tin nhắn ở bảng bên phải…")}</p></main><footer><span>＋</span><div>Tin nhắn mô phỏng</div><span>➤</span></footer><em>BẢN MÔ PHỎNG · KHÔNG PHẢI HỘI THOẠI THẬT</em></div>`;
  }

  function renderText(tool, p) {
    if (tool.id === "alt-text-checker") return `<div class="smw-accessibility"><section>${cardHeader(tool,"A11Y")}<div class="smw-image-placeholder"><span>▧</span><strong>Ảnh đang kiểm tra</strong><p>${p.assets?.length?esc(p.assets[p.activeAsset||0]?.name):"Không cần ảnh để kiểm tra nội dung; tải ảnh nếu muốn đối chiếu."}</p></div></section><section><small>ALT TEXT HIỆN TẠI</small><blockquote data-smw-alt>${esc(p.altText || "Chưa có mô tả thay thế")}</blockquote><div class="smw-score"><span style="--score:${Math.min(100,Math.max(8,[...(p.altText||"")].length/2))}%"></span><b data-smw-live-metric>0/200</b></div><ul><li>Mô tả nội dung quan trọng</li><li>Không lặp chữ “hình ảnh của”</li><li>Ngắn gọn và đúng ngữ cảnh</li></ul></section></div>`;
    const icon={"caption-formatter":"¶","social-character-counter":"123","case-converter":"Aa","whitespace-cleaner":"↹","unicode-font-styler":"𝔸"}[tool.id]||"Aa";
    if(tool.id==="social-character-counter")return `<div class="smw-counter">${cardHeader(tool,icon)}<div class="smw-counter-ring"><span data-smw-live-metric>0 ký tự</span><small>GIỚI HẠN NỀN TẢNG</small></div><section>${["Từ","Dòng","Byte","Hashtag","Mention","URL"].map((label)=>`<article><small>${label}</small><strong>—</strong></article>`).join("")}</section><p data-smt2-preview-caption>${esc(p.caption||"Nhập nội dung cần đo…")}</p></div>`;
    if(tool.id==="case-converter")return `<div class="smw-case-editor">${cardHeader(tool,icon)}<nav>${["Sentence case","UPPER CASE","lower case","Title Case","camelCase","kebab-case"].map((x,i)=>`<button class="${i?"":"is-active"}">${x}</button>`).join("")}</nav><section><small>VĂN BẢN ĐANG CHUYỂN</small><p data-smt2-preview-caption>${esc(p.caption||"Nhập nội dung cần chuyển kiểu…")}</p></section>${emptyResult("Bản chuyển đổi")}</div>`;
    if(tool.id==="whitespace-cleaner")return `<div class="smw-cleanup">${cardHeader(tool,icon)}<div><section><small>TRƯỚC</small><p data-smt2-preview-caption>${esc(p.caption||"Văn bản   có     khoảng trắng\n\n\nkhông đều")}</p></section><span>→</span><section><small>SAU</small>${emptyResult("Văn bản đã làm sạch")}</section></div></div>`;
    if(tool.id==="unicode-font-styler")return `<div class="smw-font-styler">${cardHeader(tool,icon)}<h2 data-smt2-preview-caption>${esc(p.caption||"Your social bio")}</h2><section>${[["Bold sans","𝗬𝗼𝘂𝗿 𝘀𝗼𝗰𝗶𝗮𝗹 𝗯𝗶𝗼"],["Monospace","𝚈𝚘𝚞𝚛 𝚜𝚘𝚌𝚒𝚊𝚕 𝚋𝚒𝚘"],["Circle","Ⓨⓞⓤⓡ ⓢⓞⓒⓘⓐⓛ ⓑⓘⓞ"]].map(([label,text])=>`<article><small>${label}</small><strong>${text}</strong><button>⧉</button></article>`).join("")}</section></div>`;
    return `<div class="smw-text-workbench">${cardHeader(tool,icon)}<div class="smw-editor-grid"><section><small>VĂN BẢN NGUỒN</small><p data-smt2-preview-caption>${esc(p.caption || "Dán hoặc nhập văn bản trong bảng thiết lập…")}</p><footer><b data-smw-live-metric>0 ký tự</b><span>Unicode · UTF-8</span></footer></section><section><small>KẾT QUẢ</small>${emptyResult("Chạy công cụ để tạo kết quả riêng")}</section></div></div>`;
  }

  function renderUrl(tool, p) {
    const provider={"utm-builder":"UTM","username-link-builder":"@","whatsapp-link":"WA","telegram-link":"TG","social-share-link":"↗","youtube-timestamp":"YT"}[tool.id]||"↗";
    return `<div class="smw-url-builder">${cardHeader(tool,provider)}<section><div class="smw-browser-bar"><i></i><i></i><i></i><span data-smw-url>${esc(p.canonicalUrl || p.sourceUrl || "https://")}</span><b>⌘K</b></div><div class="smw-link-flow"><article><small>01 · ĐẦU VÀO</small><strong>${esc(p.title || "Liên kết nguồn")}</strong><p>${esc(p.caption || "Nội dung chia sẻ")}</p></article><span>→</span><article><small>02 · XỬ LÝ</small><strong>${esc(provider)} Builder</strong><p>Mã hóa tham số và kiểm tra giao thức</p></article><span>→</span><article><small>03 · ĐẦU RA</small><strong>URL an toàn</strong><p>Sẵn sàng sao chép hoặc mở</p></article></div>${emptyResult("URL kết quả")}</section></div>`;
  }

  function renderDesign(tool, p) {
    const labels={"profile-picture":["AVATAR","is-avatar"],"cover-generator":["COVER","is-cover"],"meme-studio":["MEME","is-meme"],"quote-card":["QUOTE","is-quote"],"product-kit":["PRODUCT","is-product"],"brand-kit":["BRAND","is-brand"]},[label,variant]=labels[tool.id];
    return `<div class="smw-design ${variant}" data-smt2-canvas><div class="smw-artboard"><small>${label} STUDIO</small><span class="smw-art-shape">${tool.id==="profile-picture"?"H":tool.id==="product-kit"?"▣":"✦"}</span><h2 data-smt2-preview-title>${esc(p.title)}</h2><p data-smt2-preview-caption>${esc(p.caption || (tool.id==="quote-card"?"“Một câu nói hay bắt đầu từ một ý tưởng rõ ràng.”":"Thiết kế của bạn"))}</p><b>HOANG8.COM</b></div><aside><i></i><i></i><i></i><span>Vùng thiết kế chuyên biệt</span></aside></div>`;
  }

  function renderOperations(tool) {
    if (tool.id === "calendar") return `<div class="smw-calendar">${cardHeader(tool,"31")}<div class="smw-week">${["T2","T3","T4","T5","T6","T7","CN"].map((day,index)=>`<section><b>${day}</b><span>${14+index}</span>${index===1?"<article>09:00<br><strong>Instagram</strong></article>":index===3?"<article>19:30<br><strong>YouTube</strong></article>":""}</section>`).join("")}</div></div>`;
    if (tool.id === "approval") return `<div class="smw-kanban">${cardHeader(tool,"✓")}<div>${[["BẢN NHÁP",3],["CHỜ DUYỆT",1],["ĐÃ DUYỆT",2],["ĐÃ LÊN LỊCH",4]].map(([label,count],index)=>`<section><header>${label}<b>${count}</b></header>${index===1?"<article><strong>Chiến dịch mới</strong><p>Chờ reviewer kiểm tra</p><span>Ảnh · Instagram</span></article>":"<div class='smw-kanban-empty'>Thả nội dung vào đây</div>"}</section>`).join("")}</div></div>`;
    if (tool.id === "publishing-queue") return `<div class="smw-queue">${cardHeader(tool,"⇧")}<div class="smw-queue-track"><span class="is-done">Nội dung</span><i></i><span class="is-done">Duyệt</span><i></i><span>Lên lịch</span><i></i><span>Đăng</span></div><section>${["Instagram · 18:30","TikTok · 20:00","YouTube · Ngày mai"].map((item,index)=>`<article><b>${index+1}</b><strong>${item}</strong><small>${index?"Đang chờ":"Sẵn sàng"}</small><button>•••</button></article>`).join("")}</section></div>`;
    return "";
  }

  function renderDashboard(tool) {
    if (tool.id === "analytics") return `<div class="smw-analytics">${cardHeader(tool,"↗")}<div class="smw-kpis">${[["Lượt xem","—","#61e4e5"],["Tương tác","—","#8b75ff"],["Follower","—","#ef64a5"],["CTR","—","#f4c866"]].map(([label,value,color])=>`<article style="--metric:${color}"><small>${label}</small><strong>${value}</strong><span>Chờ API thật</span></article>`).join("")}</div><section><div class="smw-chart">${[28,48,35,67,53,74,62,82,68,90].map((height)=>`<i style="height:${height}%"></i>`).join("")}</div><aside><strong>Kênh đã kết nối</strong><p>Kết nối Facebook, Instagram, TikTok hoặc YouTube để xem dữ liệu thật.</p><button data-smt2-connect>Kết nối API</button></aside></section></div>`;
    if (tool.id === "community-inbox") return `<div class="smw-inbox">${cardHeader(tool,"○")}<div><nav>${["Tất cả","Chưa đọc","Bình luận","Tin nhắn"].map((x,i)=>`<button class="${i?"":"is-active"}">${x}</button>`).join("")}</nav><section>${emptyResult("Hộp thư hợp nhất đang chờ kết nối")}</section><aside><strong>Chi tiết hội thoại</strong><p>Chọn một cuộc trò chuyện từ tài khoản đã kết nối.</p></aside></div></div>`;
    return `<div class="smw-research">${cardHeader(tool,tool.id==="competitor-research"?"◎":"⌁")}<div class="smw-query"><span>⌕</span><p>${tool.id==="competitor-research"?"Nhập tài khoản đối thủ để so sánh tăng trưởng":"Nhập từ khóa, thương hiệu hoặc chủ đề cần theo dõi"}</p><button data-smt2-connect>Kết nối nguồn dữ liệu</button></div><section>${["Tín hiệu","Tăng trưởng","Tương tác","Nội dung nổi bật"].map((label)=>`<article><small>${label}</small><strong>—</strong><span>Cần dữ liệu API</span></article>`).join("")}</section></div>`;
  }

  function renderCommunication(tool,p){
    const maps={
      "communication-planner":["STRATEGY",["Bối cảnh","Đối tượng","Thông điệp","Kênh"]],
      "copy-lab":["COPY LAB",["Hook","Lợi ích","Bằng chứng","CTA"]],
      "pr-desk":["PRESS DESK",["Headline","Lead","Fact sheet","Media contact"]],
      "brand-safety":["TRUST & SAFETY",["Tín hiệu","Mức độ","Phản hồi","Phê duyệt"]],
      "community-ops":["COMMUNITY OPS",["Phân loại","Ưu tiên","Mẫu trả lời","SLA"]],
      "measurement-lab":["MEASUREMENT",["Mục tiêu","KPI","Baseline","Kết quả"]]
    },[label,steps]=maps[DEFINITIONS[tool.id].kind];
    return `<div class="smw-communication"><header>${cardHeader(tool,label)}<span>ENGINE LOCAL · KHÔNG GỬI DỮ LIỆU</span></header><div class="smw-communication-flow">${steps.map((step,index)=>`<article><i>${index+1}</i><strong>${step}</strong><p>${index===0?esc(p.objective||p.caption||"Nhập dữ liệu ở thiết lập"):"Chạy công cụ để tạo kết quả có cấu trúc"}</p></article>`).join("")}</div><section><small>KẾT QUẢ CHUYÊN BIỆT</small>${emptyResult(`Kết quả ${tool.name}`)}</section></div>`;
  }

  function render(tool, p) {
    const spec=DEFINITIONS[tool.id] || { kind:"generic", upload:false, exportImage:false };
    let html="";
    if (spec.kind === "social-post") html=renderSocialPost(tool,p);
    else if (spec.kind === "conversation") html=renderConversation(tool,p);
    else if (["caption-editor","counter","case-editor","cleanup-editor","font-editor","accessibility"].includes(spec.kind)) html=renderText(tool,p);
    else if (spec.kind === "url-builder") html=renderUrl(tool,p);
    else if (spec.kind === "design") html=renderDesign(tool,p);
    else if (["calendar","approval","queue"].includes(spec.kind)) html=renderOperations(tool);
    else if (["analytics","inbox","research"].includes(spec.kind)) html=renderDashboard(tool);
    else if (spec.kind === "image-filter") html=`<div class="smw-filter-studio" data-smt2-canvas>${cardHeader(tool,"FX")}<div class="smw-filter-image"><span>＋</span><strong>Tải ảnh để áp dụng bộ lọc</strong><p>Preview cập nhật trực tiếp theo exposure, contrast, màu và blur.</p></div><div class="smw-histogram">${[38,54,42,68,87,64,49,72,55,33,48,29].map((h)=>`<i style="height:${h}%"></i>`).join("")}</div></div>`;
    else if (spec.kind === "metadata") html=`<div class="smw-metadata">${cardHeader(tool,"OG")}<div class="smw-search-result"><small>${esc(p.canonicalUrl)}</small><h2 data-smt2-preview-title>${esc(p.title)}</h2><p data-smt2-preview-caption>${esc(p.caption||"Mô tả sẽ xuất hiện trong link preview và kết quả tìm kiếm.")}</p></div><section><code>&lt;meta property="og:title" ...&gt;</code><code>&lt;meta property="og:description" ...&gt;</code><code>&lt;meta property="og:image" ...&gt;</code></section></div>`;
    else if (spec.kind === "revenue") html=`<div class="smw-revenue">${cardHeader(tool,"X$")}<div class="smw-revenue-number"><small>ƯỚC TÍNH TRUNG TÂM</small><strong>$${Number(p.impressions||0)*Number(p.eligibleRate||0)/1000*Number(p.rpm||0)}</strong><span>Không phải doanh thu thật</span></div><div class="smw-formula">Impression <b>×</b> Eligible rate <b>÷</b> 1.000 <b>×</b> RPM</div></div>`;
    else if (spec.kind === "hashtag-lab") html=`<div class="smw-hashtag">${cardHeader(tool,"#")}<div><section><small>HASHTAG ĐẦU VÀO</small><p data-smt2-preview-caption>${esc(p.caption||"#sangtao #video #hoang8")}</p></section><span>→</span><section><small>HASHTAG ĐÃ CHUẨN HÓA</small><div class="smw-tag-cloud"><b>#hoang8</b><b>#sangtao</b><b>#socialmedia</b></div></section></div><footer><span data-smw-live-metric>0 hashtag</span><b>Tối đa đề xuất: 30</b></footer></div>`;
    else if (spec.kind === "emoji-board") html=`<div class="smw-emoji">${cardHeader(tool,"☺")}<nav><button>Gần đây</button><button>Cảm xúc</button><button>Đối tượng</button><button>Biểu tượng</button></nav><section>${["✨","🔥","🚀","💡","🎬","🎨","📌","✅","❤️","👏","🌟","💬","📣","🎯","💎","🌈","⚡","🎉","📷","▶️"].map((x)=>`<button data-smw-emoji="${x}">${x}</button>`).join("")}</section><footer>Nhãn được chọn sẽ được chèn vào nội dung.</footer></div>`;
    else if (spec.kind === "media-library") html=`<div class="smw-media-library">${cardHeader(tool,tool.id.startsWith("youtube")?"YT":tool.id.startsWith("vimeo")?"VI":"IG")}<div class="smw-video-player"><span>▶</span><strong>${tool.id.includes("thumbnail")?"Dán URL video để tải metadata công khai":"Media từ tài khoản đã kết nối"}</strong><p>Không tải lại video hoặc âm thanh trái phép.</p></div><section>${[1,2,3].map((x)=>`<article><i>▧</i><span>Media ${x}</span><small>Chưa có dữ liệu</small></article>`).join("")}</section></div>`;
    else if (spec.kind === "video-code") html=`<div class="smw-video-code">${cardHeader(tool,"&lt;/&gt;")}<div class="smw-video-player"><span>▶</span><strong>youtube-nocookie.com</strong><p>Preview riêng tư tăng cường</p></div><pre>&lt;iframe loading="lazy" allowfullscreen&gt;…&lt;/iframe&gt;</pre></div>`;
    else if (spec.kind === "dimensions") html=`<div class="smw-dimensions">${cardHeader(tool,"▰")}<section>${root.HHSocialMediaCore.SOCIAL_DIMENSIONS.map((item)=>`<article><i style="aspect-ratio:${item.width}/${item.height}"></i><div><strong>${item.platform}</strong><span>${item.asset}</span></div><b>${item.width}×${item.height}</b><small>${item.ratio}</small></article>`).join("")}</section></div>`;
    else if (spec.kind === "palette") html=`<div class="smw-palette-workspace" data-smt2-canvas>${cardHeader(tool,"◈")}<div class="smw-palette-image"><span>＋</span><strong>Tải ảnh để phân tích</strong></div><section>${["#0B1826","#6651D9","#56DDEA","#EDF6FF","#F4C866"].map((color)=>`<article style="--swatch:${color}"><i></i><b>${color}</b></article>`).join("")}</section></div>`;
    else if (spec.kind === "bio-page") html=`<div class="smw-bio"><span class="smw-avatar">H</span><h2 data-smt2-preview-title>${esc(p.title)}</h2><p data-smt2-preview-caption>${esc(p.caption||"Giới thiệu ngắn về bạn hoặc thương hiệu")}</p>${["Website chính","Nội dung mới nhất","Liên hệ hợp tác"].map((x)=>`<button>${x}<b>→</b></button>`).join("")}<small>hoang8.com</small></div>`;
    else if (spec.kind === "external-studio") html=`<div class="smw-launcher">${cardHeader(tool,"↗")}<span>◈</span><h2>Workspace chuyên dụng</h2><p>Công cụ này đã có editor riêng đầy đủ trong HH Platform và sẽ được mở ở đúng module.</p><button data-smt2-run>Mở ${esc(tool.name)}</button></div>`;
    else if (["communication-planner","copy-lab","pr-desk","brand-safety","community-ops","measurement-lab"].includes(spec.kind)) html=renderCommunication(tool,p);
    else if (spec.kind === "ai-repurpose") html=`<div class="smw-ai">${cardHeader(tool,"AI")}<div class="smw-ai-flow"><article><small>NỘI DUNG GỐC</small><p data-smt2-preview-caption>${esc(p.caption||"Nhập bài viết hoặc kịch bản gốc")}</p></article><span>✦</span><section>${["Instagram caption","TikTok hook","X thread","LinkedIn post"].map((x)=>`<article><strong>${x}</strong><small>Chờ AI tạo</small></article>`).join("")}</section></div></div>`;
    else if (spec.kind === "export-package") html=`<div class="smw-export">${cardHeader(tool,"ZIP")}<div class="smw-package"><span>ZIP</span><strong>Social Media Kit</strong><p>${p.assets?.length||0} asset · caption.txt · metadata.json · CREDITS.txt</p></div><section>${["Ảnh & video","Caption","Alt text","Metadata","Bằng chứng nguồn"].map((x,i)=>`<article><b>${i+1}</b><span>${x}</span><em>${i<(p.assets?.length?5:3)?"Sẵn sàng":"Chưa có"}</em></article>`).join("")}</section></div>`;
    else html=`<div class="smw-generic">${cardHeader(tool,"◇")}${emptyResult(tool.name)}</div>`;
    return { html:`<div class="smw-workspace kind-${spec.kind}" data-smw-kind="${spec.kind}" data-smw-tool="${tool.id}">${html}</div>`, ...spec };
  }

  function update(host, tool, p, Core) {
    host.querySelectorAll("[data-smt2-preview-title]").forEach((node)=>node.textContent=p.title||tool.name);
    host.querySelectorAll("[data-smt2-preview-caption]").forEach((node)=>node.textContent=p.caption||"Nhập nội dung ở bảng thiết lập…");
    host.querySelectorAll("[data-smw-alt]").forEach((node)=>node.textContent=p.altText||"Chưa có mô tả thay thế");
    host.querySelectorAll("[data-smw-url]").forEach((node)=>node.textContent=p.canonicalUrl||p.sourceUrl||"https://");
    const stats=Core.captionStats(p.caption, p.platform); const metric=tool.id==="hashtag-workspace"||tool.id==="hashtag-cleaner"?`${stats.hashtags.length} hashtag`:tool.id==="alt-text-checker"?`${[...(p.altText||"")].length}/200`:`${stats.characters} ký tự`;
    host.querySelectorAll("[data-smw-live-metric]").forEach((node)=>node.textContent=metric);
  }

  function validateCatalog(catalog) { return { missing:catalog.filter((tool)=>!DEFINITIONS[tool.id]).map((tool)=>tool.id), extra:Object.keys(DEFINITIONS).filter((id)=>!catalog.some((tool)=>tool.id===id)) }; }
  root.HHSocialToolWorkspaces = Object.freeze({ definitions:Object.freeze(DEFINITIONS), render, update, validateCatalog });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialToolWorkspaces;
})(typeof window !== "undefined" ? window : globalThis);
