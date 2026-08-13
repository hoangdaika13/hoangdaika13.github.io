"use strict";
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
self.onmessage = (event) => {
  const { id, query, records = [] } = event.data || {};
  const term = normalize(query);
  const results = !term ? [] : records.filter((item) => normalize(`${item.title} ${item.subjectName} ${item.outcome}`).includes(term)).slice(0, 50);
  self.postMessage({ id, results });
};
