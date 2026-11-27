const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/i;
const STATUSES = ["learning", "known"];
const DAY = 86_400_000;
export const REVIEW_SESSION_SIZE = 5;
const REVIEW_RESULTS = new Set(["correct", "incorrect", "skipped"]);
const REVIEW_LAUNCH = /^[1-9a-z][0-9a-z]{0,9}$/;
const validKey = (id) => typeof id === "string" && SLUG.test(id) && !Object.hasOwn(Object.prototype, id);
const empty = () => ({ version: 1, last: {}, lessons: {}, reviews: {}, sessions: {}, records: [], labels: false, twoD: false });

export function isReviewDue(review, now = Date.now()) {
  return Boolean(review && Number.isFinite(review.due) && review.due <= now &&
    (review.due > 0 || review.wrong > 0 || review.scheduled === true));
}

const validLaunch = (token) => typeof token === "string" && REVIEW_LAUNCH.test(token);

export function isNewReviewLaunch(session, token) {
  return validLaunch(token) && (!validLaunch(session?.launch) || parseInt(token, 36) > parseInt(session.launch, 36));
}

function validSession(session) {
  return Boolean(session && Array.isArray(session.ids) && session.ids.length <= REVIEW_SESSION_SIZE &&
    (session.ids.length > 0 || validLaunch(session.launch)) &&
    session.ids.every(validKey) && new Set(session.ids).size === session.ids.length &&
    Number.isInteger(session.index) && session.index >= 0 && session.index <= session.ids.length &&
    Array.isArray(session.results) && session.results.length === session.index &&
    session.results.every((result) => REVIEW_RESULTS.has(result)) && (session.group === "" || validKey(session.group)));
}

export function recordSessionResult(session, caseId, result) {
  if (!validKey(caseId) || !REVIEW_RESULTS.has(result) || !validSession(session) || session.ids[session.index] !== caseId) return false;
  session.results.push(result);
  session.index++;
  return true;
}

export function validRecord(record) {
  return record && typeof record.id === "string" && SLUG.test(record.id) &&
    typeof record.puzzle === "string" && SLUG.test(record.puzzle) &&
    Number.isFinite(record.ms) && record.ms >= 0 && record.ms <= DAY &&
    Number.isFinite(record.time) && record.time > 0 && record.time <= 8.64e15 &&
    typeof record.scramble === "string" && record.scramble.length <= 600 &&
    ["ok", "+2", "DNF"].includes(record.penalty);
}

export function mergeRecords(current, imported) {
  const records = new Map(current.map((row) => [row.id, row]));
  for (const row of imported.filter(validRecord)) {
    if (!records.has(row.id)) {
      records.set(row.id, { id: row.id, puzzle: row.puzzle, ms: row.ms, time: row.time, scramble: row.scramble, penalty: row.penalty });
    }
  }
  return [...records.values()].sort((a, b) => b.time - a.time).slice(0, 2000);
}

export function loadProgress(user, storage) {
  const scope = user?.guest ? "guest" : String(user?.id || user?._id || user?.newAccountId || user?.email || "guest").toLowerCase();
  const key = "hh.rubik.v1." + encodeURIComponent(scope);
  const value = empty();
  let persistent = true;
  try {
    storage ??= globalThis.localStorage;
    const raw = JSON.parse(storage.getItem(key));
    if (raw?.version === 1) {
      value.records = mergeRecords([], Array.isArray(raw.records) ? raw.records : []);
      for (const field of ["last", "lessons", "reviews"]) {
        const valid = Object.entries(raw[field] || {}).filter(([id]) => validKey(id));
        value[field] = Object.fromEntries(valid);
      }
      value.sessions = Object.fromEntries(Object.entries(raw.sessions || {})
        .filter(([id, session]) => validKey(id) && validSession(session))
        .map(([id, { ids, index, results, group, launch }]) => {
          const session = { ids, index, results, group };
          if (validLaunch(launch)) session.launch = launch;
          return [id, session];
        }));
      value.labels = raw.labels === true;
      value.twoD = raw.twoD === true;
    }
  } catch {
    persistent = false;
  }
  function save() {
    try {
      storage.setItem(key, JSON.stringify(value));
      persistent = true;
    } catch {
      persistent = false;
    }
    return persistent;
  }
  return { key, value, save, get persistent() { return persistent; } };
}

export function changeReview(state, id, change, now = Date.now()) {
  const entry = { correct: 0, wrong: 0, streak: 0, due: 0, ...(state.reviews[id] || {}) };
  if (typeof change.favorite === "boolean") entry.favorite = change.favorite;
  if ("status" in change) entry.status = STATUSES.includes(change.status) ? change.status : "";
  if (typeof change.correct === "boolean") {
    entry.last = now;
    delete entry.scheduled;
    if (change.correct) {
      entry.correct++;
      entry.streak++;
      entry.due = now + DAY * Math.min(32, 2 ** (entry.streak - 1));
    } else {
      entry.wrong++;
      entry.streak = 0;
      entry.due = now;
    }
  }
  if (change.schedule === true && !isReviewDue(entry, now)) {
    entry.due = now;
    entry.scheduled = true;
  }
  state.reviews[id] = entry;
  return entry;
}

export const solveScore = (item) => item.penalty === "DNF" ? Infinity : item.ms + (item.penalty === "+2" ? 2000 : 0);

export function averageOf(records, n) {
  if (records.length < n || n < 3) return null;
  const values = records.slice(0, n).map(solveScore).sort((a, b) => a - b);
  return values.slice(1, -1).reduce((sum, value) => sum + value, 0) / (n - 2);
}

export function formatTime(ms) {
  if (ms === Infinity) return "DNF";
  if (ms == null) return "—";
  const centis = Math.round(ms / 10);
  const seconds = (centis % 6000 / 100).toFixed(2).replace(".", ",");
  const mins = Math.floor(centis / 6000);
  return (mins ? mins + ":" + seconds.padStart(5, "0") : seconds) + " s";
}

export function inspectionPenalty(ms) {
  return ms >= 17000 ? "DNF" : ms >= 15000 ? "+2" : "ok";
}
