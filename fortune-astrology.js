(function fortuneAstrologyModule(scope, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneAstrology = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneAstrology() {
  "use strict";

  const VERSION = "1.0.0";
  const SIGNS = Object.freeze([
    ["Bạch Dương", "♈", "Lửa"], ["Kim Ngưu", "♉", "Đất"], ["Song Tử", "♊", "Khí"], ["Cự Giải", "♋", "Nước"],
    ["Sư Tử", "♌", "Lửa"], ["Xử Nữ", "♍", "Đất"], ["Thiên Bình", "♎", "Khí"], ["Bọ Cạp", "♏", "Nước"],
    ["Nhân Mã", "♐", "Lửa"], ["Ma Kết", "♑", "Đất"], ["Bảo Bình", "♒", "Khí"], ["Song Ngư", "♓", "Nước"]
  ]);
  const PLANETS = Object.freeze([
    ["Sun", "Mặt Trời", "☉"], ["Moon", "Mặt Trăng", "☽"], ["Mercury", "Sao Thủy", "☿"], ["Venus", "Sao Kim", "♀"], ["Mars", "Sao Hỏa", "♂"],
    ["Jupiter", "Sao Mộc", "♃"], ["Saturn", "Sao Thổ", "♄"], ["Uranus", "Thiên Vương", "♅"], ["Neptune", "Hải Vương", "♆"], ["Pluto", "Diêm Vương", "♇"]
  ]);
  const ASPECTS = Object.freeze([
    { name: "Đồng vị", angle: 0, orb: 8, symbol: "☌" }, { name: "Lục hợp", angle: 60, orb: 5, symbol: "⚹" }, { name: "Vuông", angle: 90, orb: 7, symbol: "□" },
    { name: "Tam hợp", angle: 120, orb: 7, symbol: "△" }, { name: "Đối đỉnh", angle: 180, orb: 8, symbol: "☍" }
  ]);

  function normalizeAngle(value) { return ((Number(value) % 360) + 360) % 360; }
  function signedAngle(value) { const angle = normalizeAngle(value); return angle > 180 ? angle - 360 : angle; }
  function signForLongitude(longitude) {
    const value = normalizeAngle(longitude);
    const index = Math.floor(value / 30);
    const sign = SIGNS[index];
    return { index, name: sign[0], symbol: sign[1], element: sign[2], degree: Number((value % 30).toFixed(2)), longitude: Number(value.toFixed(4)) };
  }
  function validateProfile(input) {
    const profile = input && typeof input === "object" ? input : {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(profile.date || "")) ? String(profile.date) : "";
    const time = /^\d{2}:\d{2}$/.test(String(profile.time || "")) ? String(profile.time) : "";
    const timezone = Number(profile.timezone);
    const latitude = Number(profile.latitude);
    const longitude = Number(profile.longitude);
    const errors = [];
    if (!date) errors.push("Thiếu ngày sinh hợp lệ.");
    if (!time) errors.push("Thiếu giờ sinh; không thể tính cung mọc và nhà.");
    if (!Number.isFinite(timezone) || timezone < -12 || timezone > 14) errors.push("Múi giờ phải từ UTC-12 đến UTC+14.");
    if (!Number.isFinite(latitude) || latitude < -66 || latitude > 66) errors.push("Vĩ độ hỗ trợ từ -66° đến 66° cho hệ nhà Equal House.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push("Kinh độ phải từ -180° đến 180°.");
    if (errors.length) return { ok: false, errors };
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const utcMs = Date.UTC(year, month - 1, day, hour, minute) - timezone * 3600000;
    const instant = new Date(utcMs);
    if (instant.getUTCFullYear() < 1600 || instant.getUTCFullYear() > 2400) errors.push("Bản đồ sao hỗ trợ năm 1600–2400.");
    return errors.length ? { ok: false, errors } : { ok: true, profile: { date, time, timezone, latitude, longitude, place: String(profile.place || "").trim().slice(0, 120) }, instant };
  }
  function meanObliquity(date) {
    const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000 / 36525;
    return 23.439291111 - (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600;
  }
  function calculateAscendant(date, latitude, longitude, astronomy) {
    const theta = normalizeAngle(astronomy.SiderealTime(date) * 15 + longitude) * Math.PI / 180;
    const epsilon = meanObliquity(date) * Math.PI / 180;
    const phi = latitude * Math.PI / 180;
    const numerator = Math.cos(theta);
    const denominator = -(Math.sin(theta) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon));
    return normalizeAngle(Math.atan2(numerator, denominator) * 180 / Math.PI);
  }
  function bodyLongitude(astronomy, bodyName, date) {
    const body = astronomy.Body[bodyName];
    const vector = astronomy.GeoVector(body, date, true);
    const ecliptic = astronomy.Ecliptic(vector);
    return { longitude: normalizeAngle(ecliptic.elon), latitude: Number(ecliptic.elat.toFixed(4)) };
  }
  function detectRetrograde(astronomy, bodyName, date) {
    if (["Sun", "Moon"].includes(bodyName)) return false;
    const before = bodyLongitude(astronomy, bodyName, new Date(date.getTime() - 43200000)).longitude;
    const after = bodyLongitude(astronomy, bodyName, new Date(date.getTime() + 43200000)).longitude;
    return signedAngle(after - before) < 0;
  }
  function houseForLongitude(longitude, ascendant) { return Math.floor(normalizeAngle(longitude - ascendant) / 30) + 1; }
  function calculateAspects(planets) {
    const output = [];
    for (let first = 0; first < planets.length; first += 1) {
      for (let second = first + 1; second < planets.length; second += 1) {
        const separation = Math.abs(signedAngle(planets[first].longitude - planets[second].longitude));
        for (const aspect of ASPECTS) {
          const delta = Math.abs(separation - aspect.angle);
          if (delta <= aspect.orb) output.push({ first: planets[first].name, second: planets[second].name, ...aspect, separation: Number(separation.toFixed(2)), exactness: Number(delta.toFixed(2)) });
        }
      }
    }
    return output.sort((a, b) => a.exactness - b.exactness).slice(0, 24);
  }
  function calculateBirthChart(input, astronomy) {
    const validation = validateProfile(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    if (!astronomy?.GeoVector || !astronomy?.Ecliptic || !astronomy?.SiderealTime || !astronomy?.Body) return { ok: false, errors: ["Astronomy Engine chưa được tải; không tạo dữ liệu thay thế."] };
    try {
      const { profile, instant } = validation;
      const ascendant = calculateAscendant(instant, profile.latitude, profile.longitude, astronomy);
      const planets = PLANETS.map(([body, name, symbol]) => {
        const position = bodyLongitude(astronomy, body, instant);
        return { body, name, symbol, ...position, sign: signForLongitude(position.longitude), house: houseForLongitude(position.longitude, ascendant), retrograde: detectRetrograde(astronomy, body, instant) };
      });
      const houses = Array.from({ length: 12 }, (_, index) => ({ house: index + 1, longitude: normalizeAngle(ascendant + index * 30), sign: signForLongitude(ascendant + index * 30) }));
      return {
        ok: true,
        instantUtc: instant.toISOString(),
        profile,
        ascendant: signForLongitude(ascendant),
        midheaven: signForLongitude(normalizeAngle(astronomy.SiderealTime(instant) * 15 + profile.longitude)),
        planets,
        houses,
        aspects: calculateAspects(planets),
        method: {
          ephemeris: "Astronomy Engine 2.1.19 · VSOP87/NOVAS · mục tiêu sai số vị trí hành tinh ±1 phút cung",
          houses: "Equal House: mỗi nhà 30°, bắt đầu tại cung mọc tính từ giờ địa phương, kinh/vĩ độ và thời gian sao.",
          interpretation: "Tên cung, nhà và góc hợp là lớp diễn giải chiêm tinh, không phải kết luận khoa học về con người."
        }
      };
    } catch (error) {
      return { ok: false, errors: [`Không thể tính bản đồ sao: ${String(error?.message || error).slice(0, 180)}`] };
    }
  }

  return Object.freeze({ VERSION, SIGNS, PLANETS, ASPECTS, normalizeAngle, signForLongitude, validateProfile, calculateAscendant, calculateAspects, calculateBirthChart });
});
