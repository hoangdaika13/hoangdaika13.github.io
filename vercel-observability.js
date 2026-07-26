(() => {
  "use strict";

  const CONSENT_KEY = "hh-consent-preferences.v1";
  const LEGACY_KEY = "hh-tracking-consent";
  let loaded = false;

  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };

  function analyticsAllowed() {
    try {
      const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      if (consent?.preferences?.analytics === true) return true;
      return localStorage.getItem(LEGACY_KEY) === "yes";
    } catch {
      return false;
    }
  }

  function inject(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.append(script);
  }

  function loadVercelObservability() {
    if (loaded || !analyticsAllowed()) return;
    loaded = true;
    inject("hh-vercel-analytics", "/_vercel/insights/script.js");
    inject("hh-vercel-speed-insights", "/_vercel/speed-insights/script.js");
  }

  window.addEventListener("hh:privacy-changed", (event) => {
    if (event.detail?.analytics === true) loadVercelObservability();
  });

  loadVercelObservability();
})();
