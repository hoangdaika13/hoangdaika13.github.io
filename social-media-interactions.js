(function initSocialMediaInteractions(root) {
  "use strict";

  const VERSION = 1;
  const CONTROL_CONTRACTS = Object.freeze({
    "social-post": ["preview-reaction", "preview-action"],
    "conversation": ["conversation-action"],
    "design": ["design-action"],
    "case-converter": ["case-mode"],
    "unicode-font-styler": ["font-style", "copy-variant"],
    "emoji-picker": ["emoji-category", "emoji-insert"],
    "bio-link": ["bio-link"],
    "calendar": ["calendar-event"],
    "approval": ["approval-card"],
    "publishing-queue": ["queue-action"],
    "hashtag-workspace": ["hashtag-group"],
    "analytics": ["analytics-filter"],
    "community-inbox": ["inbox-filter"]
  });

  function controlsFor(toolOrId) {
    const id = typeof toolOrId === "string" ? toolOrId : toolOrId?.id;
    const kind = toolOrId?.kind;
    const platformPosts=["instagram-post","instagram-story","x-composer","tweet-card","threads-composer","facebook-composer","tiktok-kit","linkedin-composer","pinterest-pin","reddit-formatter","telegram-composer","discord-announcement","mastodon-bluesky","snapchat-story"];
    const conversations=["instagram-dm","whatsapp-mockup","imessage-mockup"];
    const designs=["profile-picture","cover-generator","meme-studio","quote-card","product-kit","brand-kit"];
    const resolved=CONTROL_CONTRACTS[id]||CONTROL_CONTRACTS[kind]||(platformPosts.includes(id)?CONTROL_CONTRACTS["social-post"]:conversations.includes(id)?CONTROL_CONTRACTS.conversation:designs.includes(id)?CONTROL_CONTRACTS.design:[]);
    return Object.freeze([...(resolved||[])]);
  }

  function validateCatalog(catalog = []) {
    const known = new Set(Object.keys(CONTROL_CONTRACTS));
    const missing = catalog.filter((tool) => !tool?.id).map((tool) => tool?.id || "unknown");
    const duplicate = catalog.map((tool) => tool.id).filter((id, index, ids) => ids.indexOf(id) !== index);
    return { missing, duplicate, covered:catalog.filter((tool) => controlsFor(tool).length > 0).length, contracts:known.size };
  }

  root.HHSocialMediaInteractions = Object.freeze({ VERSION, CONTROL_CONTRACTS, controlsFor, validateCatalog });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialMediaInteractions;
})(typeof window !== "undefined" ? window : globalThis);
