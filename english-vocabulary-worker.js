(() => {
  "use strict";
  const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9'-]+/g, " ").trim();
  let terms = [];
  const search = (query = "", limit = 160) => {
    const needle = normalize(query); const prefix = []; const contains = [];
    for (let index = 0; index < terms.length && prefix.length + contains.length < limit * 4; index += 1) {
      const term = terms[index];
      if (!needle || term.startsWith(needle)) prefix.push({ term, index });
      else if (term.includes(needle)) contains.push({ term, index });
      if (prefix.length >= limit) break;
    }
    return [...prefix, ...contains].slice(0, limit);
  };
  if (typeof self !== "undefined") self.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "init") { terms = Array.isArray(message.terms) ? message.terms.slice(0, 35_000).map(String) : []; self.postMessage({ type: "ready", count: terms.length }); return; }
    if (message.type === "search") self.postMessage({ type: "results", requestId: message.requestId, results: search(message.query, Math.max(1, Math.min(500, Number(message.limit) || 160))) });
  };
  if (typeof module !== "undefined" && module.exports) module.exports = { search: (rows, query, limit) => { terms = rows; return search(query, limit); } };
})();
