(function initSocialMediaToolCapabilities(root) {
  "use strict";

  const VERSION = 6;
  const action = (handler, label, icon, hint = "") => Object.freeze({ handler, label, icon, hint });
  const run = (label, hint = "") => action("run", label, "▶", hint);
  const validate = (label = "Kiểm tra đầu vào") => action("validate", label, "✓", "Chạy validator riêng trước khi xử lý.");
  const apply = (label = "Áp dụng kết quả") => action("apply", label, "↙", "Đưa kết quả đã kiểm tra trở lại dự án.");
  const exportResult = (label = "Xuất kết quả") => action("export", label, "⇩", "Xuất đúng định dạng mà Tool Contract cho phép.");
  const preview = (label = "Làm mới preview") => action("preview", label, "◉", "Cập nhật bản xem trước mà không gửi dữ liệu ra ngoài.");
  const image = (label = "Xuất ảnh") => action("download", label, "▧", "Render ảnh từ workspace hiện tại.");
  const variants = (label = "Tạo bộ kích thước") => action("variants", label, "▦", "Tạo các biến thể nền tảng kèm safe-zone và rights manifest.");
  const connect = (label = "Kết nối chính thức") => action("connect", label, "⌁", "Mở luồng OAuth hoặc cấu hình API chính thức.");
  const packageKit = (label = "Đóng gói ZIP") => action("package", label, "ZIP", "Đóng gói asset, nội dung, metadata và bằng chứng quyền.");

  const CAPABILITIES = Object.freeze({
    "instagram-filter":[validate("Kiểm tra ảnh"),preview("Xem bộ lọc"),image("Xuất ảnh đã lọc"),variants()],
    "instagram-post":[validate("Kiểm tra bài đăng"),preview("Xem feed/carousel"),image("Xuất bài đăng"),variants(),packageKit()],
    "instagram-story":[validate("Kiểm tra safe-zone"),preview("Xem Story"),image("Xuất Story 9:16"),variants("Tạo Story/Reel")],
    "instagram-dm":[validate("Kiểm tra mô phỏng"),preview("Xem hội thoại"),image("Xuất bản có watermark"),packageKit()],
    "instagram-owned-media":[connect("Kết nối Instagram"),run("Đồng bộ media thật"),exportResult("Xuất danh sách media")],
    "x-composer":[validate("Kiểm tra giới hạn X"),run("Chia Tweet/Thread"),apply("Áp dụng thread"),exportResult("Xuất thread")],
    "tweet-card":[validate("Kiểm tra nội dung thẻ"),preview("Xem Tweet Card"),image("Xuất Tweet Card")],
    "x-revenue":[validate("Kiểm tra giả định"),run("Tính khoảng ước lượng"),exportResult("Xuất bảng giả định")],
    "threads-composer":[validate("Kiểm tra giới hạn Threads"),run("Chia chuỗi Threads"),apply("Áp dụng chuỗi"),exportResult("Xuất chuỗi")],
    "whatsapp-mockup":[validate("Kiểm tra chống giả mạo"),preview("Xem WhatsApp"),image("Xuất bản có watermark")],
    "imessage-mockup":[validate("Kiểm tra chống giả mạo"),preview("Xem iMessage"),image("Xuất bản có watermark")],
    "youtube-thumbnail":[validate("Kiểm tra URL video"),run("Lấy metadata công khai"),exportResult("Xuất metadata")],
    "vimeo-thumbnail":[validate("Kiểm tra URL video"),run("Lấy metadata công khai"),exportResult("Xuất metadata")],
    "open-graph":[validate("Kiểm tra metadata"),run("Tạo OG + JSON-LD"),apply("Áp dụng metadata"),exportResult("Xuất HTML/JSON")],
    "facebook-composer":[validate("Kiểm tra bài Facebook"),preview("Xem Post/Reel"),image("Xuất creative"),packageKit("Gói đăng thủ công")],
    "tiktok-kit":[validate("Kiểm tra TikTok safe-zone"),preview("Xem cover/caption"),variants("Tạo Cover 9:16"),packageKit("Gói TikTok")],
    "linkedin-composer":[validate("Kiểm tra bài LinkedIn"),run("Tạo bài/Article"),apply(),exportResult("Xuất bài viết")],
    "pinterest-pin":[validate("Kiểm tra Pin"),preview("Xem Pin 2:3"),image("Xuất Pin"),variants()],
    "reddit-formatter":[validate("Kiểm tra Markdown"),run("Định dạng Reddit"),apply(),exportResult("Xuất Markdown")],
    "telegram-composer":[validate("Kiểm tra Telegram"),run("Tạo tin/album"),apply(),exportResult()],
    "discord-announcement":[validate("Kiểm tra Discord"),run("Tạo announcement"),apply(),exportResult("Xuất Markdown/JSON")],
    "mastodon-bluesky":[validate("Kiểm tra giới hạn mạng mở"),run("Tạo hai phiên bản"),apply(),exportResult()],
    "snapchat-story":[validate("Kiểm tra safe-zone"),preview("Xem Story"),image("Xuất Story")],
    "bio-link":[validate("Kiểm tra liên kết"),run("Tạo trang Bio"),preview("Xem Bio page"),exportResult("Xuất HTML/JSON")],
    "qr-campaign":[run("Mở QR Studio"),packageKit("Gói QR chiến dịch")],
    "profile-picture":[validate("Kiểm tra vùng avatar"),preview("Xem crop tròn"),image("Xuất avatar"),variants()],
    "cover-generator":[validate("Kiểm tra safe-zone cover"),preview("Xem các cover"),variants("Tạo cover đa nền tảng")],
    "meme-studio":[validate("Kiểm tra chữ/ảnh"),preview("Xem Meme"),image("Xuất Meme")],
    "quote-card":[validate("Kiểm tra trích dẫn"),preview("Xem Quote Card"),image("Xuất Quote Card")],
    "product-kit":[validate("Kiểm tra nội dung sản phẩm"),preview("Xem Product Kit"),variants("Tạo bộ creative"),packageKit()],
    "hashtag-workspace":[validate("Kiểm tra hashtag"),run("Phân nhóm và lọc"),apply("Áp dụng hashtag"),exportResult("Xuất TXT/CSV")],
    "utm-builder":[validate("Kiểm tra URL/UTM"),run("Tạo URL UTM"),apply("Áp dụng URL"),exportResult("Xuất URL/CSV")],
    "caption-formatter":[validate("Kiểm tra caption"),run("Chuẩn hóa caption"),apply("Áp dụng caption"),exportResult()],
    "emoji-picker":[run("Chèn emoji"),apply("Áp dụng nội dung"),exportResult("Xuất nội dung")],
    "subtitle-studio":[run("Mở Subtitle Studio"),packageKit("Đóng gói subtitle")],
    "video-resizer":[run("Mở Video Resizer"),packageKit("Đóng gói video")],
    "brand-kit":[validate("Kiểm tra Brand Kit"),preview("Xem nhận diện"),image("Xuất brand board"),packageKit()],
    "repurpose":[validate("Kiểm tra nội dung nguồn"),run("Tạo bản nháp AI"),apply("Duyệt và áp dụng"),exportResult("Xuất các phiên bản")],
    "calendar":[validate("Kiểm tra lịch/múi giờ"),run("Tạo lịch nội dung"),exportResult("Xuất lịch")],
    "approval":[validate("Kiểm tra quyền reviewer"),run("Tạo bản chờ duyệt"),exportResult("Xuất biên bản duyệt")],
    "publishing-queue":[validate("Preflight xuất bản"),run("Đưa vào hàng đợi"),exportResult("Xuất nhật ký job")],
    "analytics":[connect("Kết nối nguồn số liệu"),run("Đồng bộ snapshot"),exportResult("Xuất CSV/PDF")],
    "community-inbox":[connect("Kết nối webhook"),run("Đồng bộ hội thoại"),exportResult("Xuất nhật ký inbox")],
    "competitor-research":[connect("Kết nối nguồn hợp lệ"),run("Phân tích đối thủ"),exportResult("Xuất báo cáo")],
    "social-listening":[connect("Kết nối nguồn lắng nghe"),run("Đồng bộ tín hiệu"),exportResult("Xuất tín hiệu")],
    "export-kit":[validate("Kiểm tra quyền asset"),packageKit("Xuất Social Kit")],
    "social-character-counter":[validate("Kiểm tra văn bản"),run("Đếm mọi nền tảng"),exportResult("Xuất bảng giới hạn")],
    "case-converter":[validate("Kiểm tra văn bản"),run("Chuyển kiểu Unicode"),apply("Áp dụng văn bản"),exportResult()],
    "whitespace-cleaner":[validate("Kiểm tra văn bản"),run("Làm sạch khoảng trắng"),apply("Áp dụng bản sạch"),exportResult()],
    "unicode-font-styler":[validate("Kiểm tra accessibility"),run("Tạo kiểu Unicode"),apply("Áp dụng kiểu chữ"),exportResult()],
    "hashtag-cleaner":[validate("Kiểm tra tag cấm/trùng"),run("Làm sạch hashtag"),apply("Áp dụng danh sách"),exportResult("Xuất TXT/CSV")],
    "username-link-builder":[validate("Kiểm tra username"),run("Tạo URL hồ sơ"),apply("Áp dụng URL"),exportResult()],
    "whatsapp-link":[validate("Kiểm tra số và nội dung"),run("Tạo wa.me"),apply("Áp dụng URL"),exportResult()],
    "telegram-link":[validate("Kiểm tra URL"),run("Tạo link Telegram"),apply("Áp dụng URL"),exportResult()],
    "social-share-link":[validate("Kiểm tra URL"),run("Tạo link chia sẻ"),apply("Áp dụng URL"),exportResult()],
    "youtube-embed":[validate("Kiểm tra video ID"),run("Tạo iframe riêng tư"),apply("Áp dụng mã nhúng"),exportResult("Xuất HTML")],
    "youtube-timestamp":[validate("Kiểm tra mốc thời gian"),run("Tạo URL theo giây"),apply("Áp dụng URL"),exportResult()],
    "social-dimensions":[run("Tra kích thước"),exportResult("Xuất bảng CSV/JSON")],
    "color-palette":[validate("Kiểm tra ảnh"),run("Trích bảng màu"),apply("Áp dụng palette"),exportResult("Xuất HEX/JSON")],
    "link-preview-audit":[validate("Kiểm tra URL/ảnh"),run("Audit preview đa nền tảng"),apply("Áp dụng metadata"),exportResult("Xuất báo cáo")],
    "alt-text-checker":[validate("Kiểm tra đầu vào"),run("Phân tích lỗi Alt Text"),apply("Áp dụng Alt Text"),exportResult("Xuất lịch sử/báo cáo")]
  });

  function forTool(toolOrId) {
    const id = typeof toolOrId === "string" ? toolOrId : toolOrId?.id;
    return Object.freeze({ version:VERSION, toolId:id, actions:CAPABILITIES[id] || [validate(), run("Chạy công cụ"), exportResult()] });
  }

  function validateCatalog(catalog = []) {
    const ids = catalog.map((item) => item.id);
    return { missing:ids.filter((id) => !CAPABILITIES[id]), extra:Object.keys(CAPABILITIES).filter((id) => !ids.includes(id)), actionless:ids.filter((id) => !(CAPABILITIES[id]?.length)) };
  }

  root.HHSocialToolCapabilities = Object.freeze({ VERSION, CAPABILITIES, forTool, validateCatalog });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialToolCapabilities;
})(typeof window !== "undefined" ? window : globalThis);
