"use strict";

// Transactional auth messages are deliberately built with tables and inline
// styles so they remain readable in Gmail, Outlook and mobile mail clients.

function text(value, fallback = "") {
  const result = String(value == null ? "" : value).trim();
  return result || fallback;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteUrl() {
  const candidate = text(process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL, "https://hoang8.com").replace(/\/+$/, "");
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString().replace(/\/+$/, "") : "https://hoang8.com";
  } catch {
    return "https://hoang8.com";
  }
}

function displayName(user) {
  return text(user?.name || user?.nickname, "người bạn").slice(0, 120);
}

function localDate(value) {
  try {
    return new Date(value || Date.now()).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh", dateStyle: "long", timeStyle: "short"
    });
  } catch {
    return "vừa lúc này";
  }
}

function methodLabel(value) {
  return ({
    password: "Email và mật khẩu",
    google: "Google OAuth",
    passkey: "Passkey",
    qr: "Mã QR"
  }[text(value).toLowerCase()] || "Phương thức bảo mật");
}

function maskedIp(value) {
  const ip = text(value, "Không xác định");
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":•••";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.•••.•••` : "Đã ẩn vì quyền riêng tư";
}

function shell({ preheader, eyebrow, title, intro, body, ctaLabel, ctaHref, footer }) {
  const accent = "#7ff2e6";
  const pink = "#f39acb";
  const gold = "#f7d77b";
  const url = escapeHtml(ctaHref || siteUrl());
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#070914;color:#f7f4ff;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070914"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#101426;border:1px solid #293458;border-radius:22px;overflow:hidden"><tr><td style="height:7px;background:${accent}"></td></tr><tr><td style="padding:27px 30px 10px;background:#121a31"><table role="presentation" width="100%"><tr><td width="48" valign="top"><div style="width:42px;height:42px;border-radius:14px;background:#1a3440;color:${accent};font-size:25px;line-height:42px;text-align:center;font-weight:800">H</div></td><td valign="middle" style="padding-left:13px"><div style="font-size:11px;line-height:1.4;letter-spacing:2.6px;font-weight:800;color:${accent}">HH PLATFORM · COSMIC MAIL</div><div style="margin-top:5px;font-size:14px;line-height:1.5;color:#c9c6d8">Một lời nhắn nhỏ từ vũ trụ HH</div></td></tr></table><div style="margin-top:28px;font-size:11px;letter-spacing:2px;font-weight:800;color:${pink}">${escapeHtml(eyebrow)}</div><h1 style="margin:8px 0 12px;font-size:36px;line-height:1.12;letter-spacing:-.7px;color:#fff">${title}</h1><p style="margin:0;font-size:16px;line-height:1.75;color:#d7d3e2">${intro}</p></td></tr><tr><td style="padding:20px 30px;background:#0e1323">${body}</td></tr><tr><td style="padding:4px 30px 30px;background:#0e1323"><a href="${url}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:${gold};color:#17111e;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(ctaLabel || "Mở HH Platform")}</a></td></tr><tr><td style="padding:19px 30px;background:#090c17;border-top:1px solid #202842;color:#88869a;font-size:11px;line-height:1.7">${footer || `Email tự động từ <a href="${url}" style="color:${accent};text-decoration:none">hoang8.com</a> · Bạn có thể quản lý phiên đăng nhập trong tài khoản.`}</td></tr></table></td></tr></table></body></html>`;
}

function welcomeEmail({ user, verificationPending = false } = {}) {
  const name = escapeHtml(displayName(user));
  const url = siteUrl();
  return {
    subject: `🌌 Chào mừng ${displayName(user)} đến với HH Platform`,
    text: `Xin chào ${displayName(user)},\n\nCảm ơn bạn đã đăng ký HH Platform. Tài khoản của bạn đã sẵn sàng để khám phá các công cụ, học tập và sáng tạo.\n${verificationPending ? "Hãy kiểm tra email xác minh được gửi kèm để hoàn tất bảo vệ tài khoản.\n" : ""}\nMở website: ${url}\n\nTrân trọng,\nNhhoang · HH Platform`,
    html: shell({
      preheader: "Chào mừng bạn đến với HH Platform — hành trình của bạn bắt đầu từ đây.",
      eyebrow: "WELCOME ABOARD",
      title: `Chào mừng<br><span style="color:#f7d77b">${name}</span>`,
      intro: "Cảm ơn bạn đã đăng ký. Từ hôm nay, bạn đã có một góc riêng để học tập, làm việc và sáng tạo cùng HH Platform.",
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:18px;background:#15263b;border:1px solid #2e5d73;border-radius:14px"><div style="font-size:22px">✦　✧　✦</div><div style="margin-top:9px;color:#80eee5;font-size:13px;font-weight:800;letter-spacing:1px">NGÔI SAO MỚI ĐÃ SÁNG</div><p style="margin:8px 0 0;color:#c8d7df;font-size:14px;line-height:1.7">${verificationPending ? "Một email xác minh riêng đang trên đường tới hộp thư của bạn. Hãy xác minh để bảo vệ tài khoản và mở đầy đủ trải nghiệm." : "Hồ sơ của bạn đã được ghi nhận. Hãy bắt đầu bằng một công cụ hoặc nhiệm vụ nhỏ hôm nay."}</p></td></tr><tr><td style="padding-top:17px;color:#bdb8cc;font-size:14px;line-height:1.7">Gợi ý khởi hành: khám phá <strong style="color:#f39acb">Trang chủ</strong>, chọn một hành tinh và bấm <strong style="color:#7ff2e6">Mở ngay</strong>.</td></tr></table>`,
      ctaLabel: "Khám phá HH Platform",
      ctaHref: `${url}/#/home`
    })
  };
}

function loginThankYouEmail({ user, session, method } = {}) {
  const name = escapeHtml(displayName(user));
  const device = session?.device || {};
  const when = localDate(session?.createdAt);
  const loginMethod = methodLabel(method || session?.type);
  const url = siteUrl();
  return {
    subject: `✨ Cảm ơn ${displayName(user)} đã trở lại HH Platform`,
    text: `Xin chào ${displayName(user)},\n\nCảm ơn bạn đã đăng nhập HH Platform lúc ${when}.\nPhương thức: ${loginMethod}\nThiết bị: ${text(device.label, "Không xác định")}\nKhu vực mạng: ${maskedIp(device.ip)}\n\nNếu đây không phải bạn, hãy mở ${url} và thu hồi phiên đăng nhập ngay.\n\nTrân trọng,\nNhhoang · HH Platform`,
    html: shell({
      preheader: `Bạn vừa trở lại HH Platform lúc ${when}.`,
      eyebrow: "WELCOME BACK",
      title: `Rất vui được gặp lại<br><span style="color:#f39acb">${name}</span>`,
      intro: "Cảm ơn bạn đã trở lại. Một phiên làm việc mới vừa được mở an toàn trong vũ trụ HH.",
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.65;color:#d6d2df"><tr><td colspan="2" style="padding-bottom:11px;color:#80eee5;font-size:12px;font-weight:800;letter-spacing:1px">DẤU VẾT PHIÊN ĐĂNG NHẬP</td></tr><tr><td style="padding:10px 0;border-top:1px solid #252d49;color:#918ba0">Thời gian</td><td align="right" style="padding:10px 0;border-top:1px solid #252d49;font-weight:750">${escapeHtml(when)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #252d49;color:#918ba0">Phương thức</td><td align="right" style="padding:10px 0;border-top:1px solid #252d49;font-weight:750">${escapeHtml(loginMethod)}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #252d49;color:#918ba0">Thiết bị</td><td align="right" style="padding:10px 0;border-top:1px solid #252d49;font-weight:750">${escapeHtml(text(device.label, "Không xác định"))}</td></tr><tr><td style="padding:10px 0;border-top:1px solid #252d49;color:#918ba0">Mạng</td><td align="right" style="padding:10px 0;border-top:1px solid #252d49;font-weight:750">${escapeHtml(maskedIp(device.ip))}</td></tr></table><div style="margin-top:18px;padding:14px 16px;background:#251a32;border:1px solid #603d68;border-radius:12px;color:#e7cde4;font-size:13px;line-height:1.65">Nếu bạn không nhận ra hoạt động này, hãy mở trung tâm tài khoản và thu hồi phiên đăng nhập ngay.</div>`,
      ctaLabel: "Mở trung tâm tài khoản",
      ctaHref: `${url}/#/home`
    })
  };
}

module.exports = { loginThankYouEmail, welcomeEmail };
