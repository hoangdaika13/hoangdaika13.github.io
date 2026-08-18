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

function shell({ preheader, eyebrow, title, intro, body, ctaLabel, ctaHref, footer, theme = "welcome", heroIcon = "✦" }) {
  const palettes = {
    welcome: { accent: "#66eaff", secondary: "#f058bd", panel: "#071a2a", border: "#4dddf2", icon: "#63ecff" },
    login: { accent: "#bc7cff", secondary: "#5ee7ff", panel: "#18102f", border: "#a875ef", icon: "#d085ff" }
  };
  const palette = palettes[theme] || palettes.welcome;
  const url = escapeHtml(ctaHref || siteUrl());
  // Compact, image-free and deliberately table-based for Gmail/Outlook. Solid
  // colours are fallbacks when an email client strips gradients or shadows.
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background-color:#030914;color:#f7f4ff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#030914;background-image:linear-gradient(145deg,#03101e 0%,#09091b 52%,#16091d 100%)">
    <tr><td align="center" style="padding:18px 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:590px;background-color:#08111f;border:1px solid ${palette.border};border-radius:22px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.52)">
        <tr><td style="height:4px;font-size:0;line-height:0;background-color:${palette.accent};background-image:linear-gradient(90deg,${palette.accent},${palette.secondary},${palette.accent})">&nbsp;</td></tr>
        <tr><td style="padding:18px 22px;background-color:${palette.panel};background-image:linear-gradient(120deg,${palette.panel} 0%,#0b1022 62%,#21102d 100%);border-bottom:1px solid #293550">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="56" valign="middle"><table role="presentation" width="46" height="46" cellpadding="0" cellspacing="0" border="0" style="width:46px;height:46px;border:1px solid ${palette.border};border-radius:50%;background-color:#11152a"><tr><td align="center" valign="middle" style="font-size:21px;line-height:46px;font-weight:900;color:${palette.accent}">HH</td></tr></table></td>
            <td valign="middle"><div style="font-size:17px;line-height:1.25;font-weight:850;color:#ffffff">HH Platform</div><div style="margin-top:3px;font-size:9px;line-height:1.4;letter-spacing:2px;font-weight:800;color:${palette.accent}">CLOUD · CONNECT · CREATE</div></td>
            <td width="80" align="right" valign="middle"><div style="color:${palette.secondary};font-size:23px;line-height:1">— ✦</div></td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 12px;background-color:#080f1d">
          <table role="presentation" width="66" height="66" cellpadding="0" cellspacing="0" border="0" style="width:66px;height:66px;border:1px solid ${palette.border};border-radius:50%;background-color:#10152a;box-shadow:0 0 24px ${palette.border}"><tr><td align="center" valign="middle" style="font-size:31px;line-height:66px;color:${palette.icon}">${escapeHtml(heroIcon)}</td></tr></table>
          <div style="margin-top:15px;font-size:10px;line-height:1.4;letter-spacing:2.1px;font-weight:800;color:${palette.accent}">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:7px 0 8px;font-size:31px;line-height:1.13;letter-spacing:-.6px;color:#ffffff">${title}</h1>
          <p style="margin:0 auto;max-width:470px;font-size:14px;line-height:1.6;color:#d6d4e3">${intro}</p>
          <div style="margin:14px auto 0;color:${palette.secondary};font-size:14px;line-height:1">────────　✦　────────</div>
        </td></tr>
        <tr><td align="center" style="padding:10px 24px 8px;background-color:#080f1d">${body}</td></tr>
        <tr><td align="center" style="padding:10px 24px 22px;background-color:#080f1d"><a href="${url}" style="display:inline-block;min-width:220px;padding:13px 22px;border:1px solid ${palette.accent};border-radius:12px;background-color:${palette.accent};background-image:linear-gradient(105deg,${palette.accent},#7b70f2 48%,${palette.secondary});color:#07101d;text-decoration:none;font-size:14px;font-weight:900;box-shadow:0 8px 28px rgba(95,221,255,.2)">${escapeHtml(ctaLabel || "Mở HH Platform")} &nbsp;✦</a></td></tr>
        <tr><td align="center" style="padding:13px 22px;background-color:#050a13;border-top:1px solid #26324b;color:#89889a;font-size:10px;line-height:1.55">${footer || `◉ &nbsp; <a href="${url}" style="color:${palette.accent};text-decoration:none">hoang8.com</a><br>COSMIC THANK-YOU · 2026.08 · Email giao dịch tự động`}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function welcomeEmail({ user, verificationPending = false } = {}) {
  const name = escapeHtml(displayName(user));
  const url = siteUrl();
  return {
    subject: `🌌 Chào mừng ${displayName(user)} đến với HH Platform`,
    text: `Xin chào ${displayName(user)},\n\nChân thành cảm ơn bạn đã tin tưởng đăng ký HH Platform. Sự hiện diện của bạn là một phần rất quý giá trong hành trình xây dựng một vũ trụ học tập, sáng tạo và kết nối hữu ích.\n${verificationPending ? "Hãy kiểm tra email xác minh được gửi kèm để hoàn tất bảo vệ tài khoản.\n" : "Tài khoản của bạn đã sẵn sàng để bắt đầu.\n"}\nMở website: ${url}\n\nVới lòng biết ơn,\nNhhoang · HH Platform`,
    html: shell({
      preheader: "Chào mừng bạn đến với HH Platform — hành trình của bạn bắt đầu từ đây.",
      eyebrow: "REGISTRATION WELCOME",
      title: `Chào mừng bạn<br><span style="color:#f058bd;font-size:21px">${name}</span>`,
      intro: "HH Platform trân trọng cảm ơn bạn đã tin tưởng đăng ký. Sự hiện diện của bạn là một phần quý giá trong hành trình xây dựng không gian học tập, sáng tạo và kết nối này.",
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:470px"><tr><td align="center" style="padding:11px 15px;background-color:#0b1c2c;border:1px solid #255e72;border-radius:12px;color:#c9eaf0;font-size:12px;line-height:1.55"><strong style="color:#66eaff">${verificationPending ? "XÁC MINH EMAIL ĐỂ HOÀN TẤT" : "TÀI KHOẢN ĐÃ SẴN SÀNG"}</strong><br>${verificationPending ? "Thư xác minh riêng đang được gửi tới hộp thư của bạn." : "Hãy bắt đầu khám phá HH Platform theo nhịp của riêng bạn."}</td></tr></table>`,
      ctaLabel: "Khám phá HH Platform",
      ctaHref: `${url}/#/home`,
      theme: "welcome",
      heroIcon: "♙"
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
    text: `Xin chào ${displayName(user)},\n\nChân thành cảm ơn bạn đã tiếp tục đồng hành cùng HH Platform. Chúng tôi trân trọng từng lần bạn quay lại và sẽ luôn cố gắng giữ trải nghiệm an toàn, nhẹ nhàng và hữu ích.\n\nBạn đã đăng nhập lúc ${when}.\nPhương thức: ${loginMethod}\nThiết bị: ${text(device.label, "Không xác định")}\nKhu vực mạng: ${maskedIp(device.ip)}\n\nNếu đây không phải bạn, hãy mở ${url} và thu hồi phiên đăng nhập ngay.\n\nVới lòng biết ơn,\nNhhoang · HH Platform`,
    html: shell({
      preheader: `Bạn vừa trở lại HH Platform lúc ${when}.`,
      eyebrow: "SUCCESSFUL LOGIN",
      title: "Đăng nhập thành công",
      intro: `Chào mừng trở lại, <strong style="color:#d085ff">${name}</strong>. Chân thành cảm ơn bạn đã tiếp tục đồng hành cùng HH Platform.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px;font-size:11px;line-height:1.45;color:#d6d2df"><tr><td width="32%" align="center" style="padding:9px 5px;background-color:#0c1d2c;border:1px solid #285b70;border-radius:9px;color:#65e9ff">♢ &nbsp; Phiên đã ghi nhận</td><td width="2%">&nbsp;</td><td width="32%" align="center" style="padding:9px 5px;background-color:#17132d;border:1px solid #594276;border-radius:9px;color:#d7b8f5">▣ &nbsp; ${escapeHtml(loginMethod)}</td><td width="2%">&nbsp;</td><td width="32%" align="center" style="padding:9px 5px;background-color:#11192e;border:1px solid #3b4e79;border-radius:9px;color:#b9d2ff">☁ &nbsp; HH Cloud Online</td></tr><tr><td colspan="5" style="padding-top:10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0c101d;border:1px solid #2f2b43;border-radius:10px"><tr><td style="padding:7px 10px;color:#918ba0">Thời gian</td><td align="right" style="padding:7px 10px;color:#eee9f8">${escapeHtml(when)}</td></tr><tr><td style="padding:7px 10px;border-top:1px solid #24263a;color:#918ba0">Thiết bị</td><td align="right" style="padding:7px 10px;border-top:1px solid #24263a;color:#eee9f8">${escapeHtml(text(device.label, "Không xác định"))}</td></tr><tr><td style="padding:7px 10px;border-top:1px solid #24263a;color:#918ba0">Mạng đã ẩn</td><td align="right" style="padding:7px 10px;border-top:1px solid #24263a;color:#eee9f8">${escapeHtml(maskedIp(device.ip))}</td></tr></table></td></tr><tr><td colspan="5" align="center" style="padding-top:9px;color:#b9afc9;font-size:11px">Nếu không nhận ra hoạt động này, hãy thu hồi phiên đăng nhập ngay.</td></tr></table>`,
      ctaLabel: "Mở Trang chủ",
      ctaHref: `${url}/#/home`,
      theme: "login",
      heroIcon: "♢"
    })
  };
}

module.exports = { loginThankYouEmail, welcomeEmail };
