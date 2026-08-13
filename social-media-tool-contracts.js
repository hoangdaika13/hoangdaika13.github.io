(function initSocialToolContracts(root) {
  "use strict";

  const Core = () => root.HHSocialMediaCore;
  const Workspaces = () => root.HHSocialToolWorkspaces;
  const CONTRACT_VERSION = 7;
  const COMMUNICATION_ENGINES = new Set(["content-strategy-brief","audience-persona","content-pillar-planner","campaign-objective","channel-mix-planner","editorial-angle-lab","hook-library","headline-analyzer","cta-optimizer","ad-copy-variants","ab-test-planner","pr-release-builder","media-pitch-builder","press-kit-checklist","crisis-response-builder","holding-statement","brand-safety-audit","claim-compliance-checker","tone-of-voice-audit","moderation-policy","response-template-library","sentiment-triage","kpi-planner","roi-calculator"]);
  const LOCAL_ENGINES = new Set(["caption-formatter","social-character-counter","case-converter","whitespace-cleaner","unicode-font-styler","alt-text-checker","hashtag-workspace","hashtag-cleaner","utm-builder","username-link-builder","whatsapp-link","telegram-link","social-share-link","youtube-timestamp","youtube-embed","social-dimensions","open-graph","link-preview-audit","x-revenue",...COMMUNICATION_ENGINES]);
  const PROVIDER_TOOLS = new Set(["instagram-owned-media","youtube-thumbnail","vimeo-thumbnail","calendar","approval","publishing-queue","analytics","community-inbox","competitor-research","social-listening","repurpose"]);
  const DEVELOPMENT_TOOLS = new Set([]);
  const WORKSPACE_ENGINES = new Set(["instagram-filter","instagram-post","instagram-story","instagram-dm","x-composer","tweet-card","threads-composer","whatsapp-mockup","imessage-mockup","facebook-composer","tiktok-kit","linkedin-composer","pinterest-pin","reddit-formatter","telegram-composer","discord-announcement","mastodon-bluesky","snapchat-story","profile-picture","cover-generator","meme-studio","quote-card","product-kit","brand-kit","qr-campaign","subtitle-studio","video-resizer","export-kit","bio-link","emoji-picker","color-palette"]);
  const MIME_LIMITS = Object.freeze({ image:25*1024*1024, video:2*1024*1024*1024, document:5*1024*1024 });
  const EXPORTS = Object.freeze({ text:["txt","json"], table:["csv","json"], image:["png","webp","json"], url:["txt","json","qr"], media:["zip","json"], operations:["csv","json"], provider:["csv","json"] });

  function inputFields(tool) {
    const kind=Workspaces().definitions[tool.id]?.kind;
    if (["caption-editor","counter","case-editor","cleanup-editor","font-editor","hashtag-lab"].includes(kind)) return ["caption"];
    if (kind === "accessibility") return ["altText","activeAsset"];
    if (kind === "url-builder") return tool.id === "username-link-builder" ? ["socialProvider","title"] : tool.id === "youtube-timestamp" ? ["sourceUrl","startSeconds"] : ["canonicalUrl","caption"];
    if (["metadata"].includes(kind)) return ["title","caption","canonicalUrl","imageUrl"];
    if (["image-filter","design","palette","social-post","export-package"].includes(kind)) return ["assets","title","caption","altText"];
    if (["calendar","approval","queue"].includes(kind)) return ["accountId","platform","scheduledAt","timezone"];
    if (["analytics","inbox","research","media-library"].includes(kind)) return ["accountId","provider"];
    if (kind === "ai-repurpose") return ["caption","platform","brandVoice"];
    if (["dimensions","emoji-board"].includes(kind)) return [];
    if (["communication-planner","copy-lab","pr-desk","brand-safety","community-ops","measurement-lab"].includes(kind)) return root.HHSocialCommunicationEngines?.FIELDS?.[tool.id] || ["title","caption"];
    return ["title","caption"];
  }

  function outputType(tool) {
    const kind=Workspaces().definitions[tool.id]?.kind;
    if (["counter","accessibility","revenue"].includes(kind)) return "table";
    if (["url-builder","metadata","video-code"].includes(kind)) return "url";
    if (["image-filter","design","palette","dimensions","social-post"].includes(kind)) return "image";
    if (["calendar","approval","queue"].includes(kind)) return "operations";
    if (["analytics","inbox","research","media-library"].includes(kind)) return "provider";
    if (kind === "export-package") return "media";
    return "text";
  }

  function readiness(tool, context = {}) {
    if (DEVELOPMENT_TOOLS.has(tool.id)) return { code:"development", label:"Đang phát triển", operational:false };
    if (LOCAL_ENGINES.has(tool.id) || WORKSPACE_ENGINES.has(tool.id)) return { code:"local-ready", label:"Local Ready", operational:true };
    if (tool.mode === "api" && ["youtube-thumbnail","vimeo-thumbnail"].includes(tool.id)) return { code:"api-configured",label:"API Configured",operational:true };
    if (["local","manual","reuse"].includes(tool.mode)) return { code:"development",label:"Đang phát triển",operational:false };
    const provider=tool.id.startsWith("instagram")?"instagram":tool.id.includes("youtube")?"youtube":tool.id.includes("tiktok")?"tiktok":context.provider;
    const state=context.providers?.[provider]||{};
    if (tool.mode === "ai") return context.aiConfigured ? { code:"api-configured",label:"AI Configured",operational:true } : { code:"permission-needed",label:"Cần cấu hình AI",operational:false };
    if (!provider && PROVIDER_TOOLS.has(tool.id)) return { code:"permission-needed",label:"Chọn tài khoản",operational:false };
    if (!state.configured) return { code:"development",label:"Chưa cấu hình API",operational:false };
    if (!state.connected) return { code:"permission-needed",label:"Cần quyền",operational:false };
    if (provider === "tiktok" && state.audited !== true && ["calendar","approval","publishing-queue"].includes(tool.id)) return { code:"review-needed",label:"Cần TikTok duyệt",operational:false };
    return { code:"connected",label:"Đã kết nối",operational:true };
  }

  function validate(tool, project = {}, context = {}) {
    const errors=[]; const warnings=[]; const fields=inputFields(tool);
    if (COMMUNICATION_ENGINES.has(tool.id)) { const checked=root.HHSocialCommunicationEngines?.validate?.(tool.id,project)||{errors:[{field:"toolId",code:"engine-missing",message:"Communication Engine chưa được nạp."}],warnings:[]}; errors.push(...checked.errors); warnings.push(...checked.warnings); }
    if (fields.includes("caption") && !String(project.caption||"").trim() && !["counter","cleanup-editor"].includes(Workspaces().definitions[tool.id]?.kind)) errors.push({ field:"caption", code:"required", message:"Nội dung đang trống." });
    if (fields.includes("altText")) { const value=String(project.altText||"").trim(); if (!value) errors.push({ field:"altText",code:"required",message:"Alt text đang trống." }); if ([...value].length>300) warnings.push({field:"altText",code:"long",message:"Alt text dài hơn 300 ký tự."}); }
    if (fields.includes("canonicalUrl") && !Core().normalizeUrl(project.canonicalUrl)) errors.push({field:"canonicalUrl",code:"https",message:"Cần URL HTTPS hợp lệ."});
    if (fields.includes("sourceUrl")) { const provider=tool.id.startsWith("vimeo")?"vimeo":"youtube"; if (!Core().parseVideoRef(project.sourceUrl,provider)) errors.push({field:"sourceUrl",code:"video",message:`URL hoặc ID ${provider==="vimeo"?"Vimeo":"YouTube"} không hợp lệ.`}); }
    if (fields.includes("assets") && !(project.assets||[]).length && ["image-filter","palette"].includes(Workspaces().definitions[tool.id]?.kind)) errors.push({field:"assets",code:"required",message:"Hãy tải ít nhất một ảnh."});
    if (["calendar","approval","publishing-queue"].includes(tool.id)) {
      if (!project.accountId) errors.push({field:"accountId",code:"required",message:"Hãy chọn tài khoản/kênh xuất bản."});
      if (!String(project.scheduledAt||"").trim()) errors.push({field:"scheduledAt",code:"required",message:"Hãy chọn thời điểm theo lịch."});
      if (!String(project.timezone||"").trim()) errors.push({field:"timezone",code:"required",message:"Múi giờ không được để trống."});
    }
    if (["instagram-filter","instagram-post","instagram-story","tiktok-kit","pinterest-pin","profile-picture","cover-generator","product-kit","brand-kit","export-kit"].includes(tool.id)) {
      const unconfirmed=(project.assets||[]).filter((asset)=>asset.rightsConfirmed!==true);
      if (unconfirmed.length) warnings.push({field:"assets",code:"rights-unconfirmed",message:`${unconfirmed.length} asset chưa xác nhận quyền sử dụng; không thể xuất gói phát hành.`});
    }
    const platform=project.socialProvider||project.platform; const limit=Core().PLATFORM_LIMITS?.[platform];
    if (limit && [...String(project.caption||"")].length>limit) errors.push({field:"caption",code:"platform-limit",message:`Nội dung vượt giới hạn ${limit} ký tự của ${platform}.`});
    const status=readiness(tool,context); if (!status.operational && !["development"].includes(status.code)) warnings.push({field:"provider",code:status.code,message:status.label});
    return { valid:errors.length===0, errors, warnings, status };
  }

  function contractFor(tool, context = {}) {
    const type=outputType(tool); const spec=Workspaces().definitions[tool.id]||{};
    const communication=COMMUNICATION_ENGINES.has(tool.id)?root.HHSocialCommunicationEngines?.engineFor?.(tool.id):null;
    const ready=readiness(tool,context); return Object.freeze({ version:CONTRACT_VERSION,id:tool.id,kind:spec.kind||"generic",mode:tool.mode,inputs:inputFields(tool),outputType:type,exports:communication?.exports||EXPORTS[type]||EXPORTS.text,applyBack:true,undoRedo:true,presets:true,upload:Boolean(spec.upload),exportImage:Boolean(spec.exportImage),readiness:ready,validator:"tool-specific",processor:communication?"communication-engine":LOCAL_ENGINES.has(tool.id)?"local-engine":WORKSPACE_ENGINES.has(tool.id)?"workspace-engine":tool.mode==="provider"?"official-provider":"not-implemented" });
  }

  function catalogContracts(catalog, context = {}) { return catalog.map((tool)=>contractFor(tool,context)); }
  root.HHSocialToolContracts=Object.freeze({CONTRACT_VERSION,LOCAL_ENGINES,COMMUNICATION_ENGINES,WORKSPACE_ENGINES,MIME_LIMITS,EXPORTS,inputFields,outputType,readiness,validate,contractFor,catalogContracts});
  if(typeof module!=="undefined"&&module.exports)module.exports=root.HHSocialToolContracts;
})(typeof window!=="undefined"?window:globalThis);
