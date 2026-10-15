(() => {
  "use strict";
  // Original bounded adapter for the pinned polygon-clipping 0.15.7 engine.
  // All flattening happens AFTER the renderer's affine transform: tolerance is
  // expressed in document pixels, not in an unscaled shape's local space.
  const LIMITS = Object.freeze({ layers: 32, points: 3072, ringPoints: 1024, subpaths: 48, pairs: 1500000, coordinate: 1000000, outputPoints: 8192, pathChars: 100000, tolerance: 0.25, recursion: 18 });
  const MODES = Object.freeze({ union: "union", subtract: "difference", intersect: "intersection", exclude: "xor" });
  const EPS = 1e-8;
  const fail = (message) => { throw new Error(message); };
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const signedArea = (ring) => ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const segmentDistance = (point, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
    return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
  };
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function engine() {
    const value = globalThis.polygonClipping || (typeof require === "function" ? require("./vendor/polygon-clipping-0.15.7.umd.min.js") : null);
    if (!value?.union) fail("Engine Boolean nâng cao chưa tải. Bản gốc được giữ nguyên; hãy thử lại khi tải hoàn tất.");
    return value;
  }
  function checkedPoint(point) {
    if (!point.every(finite) || point.some((value) => Math.abs(value) > LIMITS.coordinate)) fail("Tọa độ Boolean phải hữu hạn và nằm trong ±1.000.000 px.");
    return point;
  }
  function transformFor(layer) {
    for (const key of ["x", "y", "width", "height"]) if (!finite(layer[key])) fail("Hình Boolean có kích thước hoặc tọa độ không hợp lệ.");
    if (layer.width <= 0 || layer.height <= 0) fail("Hình Boolean phải có chiều rộng và cao dương.");
    const rotation = layer.rotation ?? 0, skewX = layer.skewX ?? 0, skewY = layer.skewY ?? 0;
    const anchorX = layer.anchorX ?? 0.5, anchorY = layer.anchorY ?? 0.5;
    if (![rotation, skewX, skewY, anchorX, anchorY].every(finite) || Math.abs(skewX) >= 89 || Math.abs(skewY) >= 89) fail("Transform Boolean không hợp lệ hoặc skew quá lớn.");
    const ax = layer.x + layer.width * anchorX, ay = layer.y + layer.height * anchorY;
    const radians = rotation * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
    const tx = Math.tan(skewX * Math.PI / 180), ty = Math.tan(skewY * Math.PI / 180);
    // SVG rotate * translate(anchor) * skewX * skewY * translate(-anchor).
    return (point) => {
      const x = point[0] - ax, y = point[1] - ay;
      const sy = y + ty * x, sx = x + tx * sy;
      return checkedPoint([ax + cosine * sx - sine * sy, ay + sine * sx + cosine * sy]);
    };
  }
  function pushPoint(ring, point, budget) {
    checkedPoint(point);
    if (ring.length && same(ring.at(-1), point)) return;
    ring.push(point);
    budget.points += 1;
    if (ring.length > LIMITS.ringPoints || budget.points > LIMITS.points) fail("Hình quá phức tạp: Boolean tối đa 1.024 điểm mỗi contour và 3.072 điểm tổng. Hãy đơn giản hóa path.");
  }
  function cubic(ring, a, b, c, d, budget, depth = 0) {
    if (Math.max(segmentDistance(b, a, d), segmentDistance(c, a, d)) <= LIMITS.tolerance) return pushPoint(ring, d, budget);
    if (depth >= LIMITS.recursion) fail("Đường cong chưa đạt sai số 0,25 px trong giới hạn phân đoạn; bản gốc được giữ nguyên.");
    const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d), abc = midpoint(ab, bc), bcd = midpoint(bc, cd), center = midpoint(abc, bcd);
    cubic(ring, a, ab, abc, center, budget, depth + 1);
    cubic(ring, center, bcd, cd, d, budget, depth + 1);
  }
  function tokenizePath(pathData) {
    if (typeof pathData !== "string" || !pathData.trim() || pathData.length > LIMITS.pathChars) fail("Path Boolean thiếu dữ liệu hoặc dài quá 100.000 ký tự.");
    const tokens = [], matcher = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
    let end = 0, match;
    while ((match = matcher.exec(pathData))) {
      const separator = pathData.slice(end, match.index);
      if (!/^[\s,]*$/.test(separator) || (separator.match(/,/g) || []).length > 1 || (separator.includes(",") && (typeof tokens.at(-1) !== "number" || /^[a-z]$/i.test(match[0])))) fail("Cú pháp SVG path không hợp lệ.");
      const token = match[0];
      if (/^[a-z]$/i.test(token)) {
        if (!/^[MLHVCSQTZ]$/i.test(token)) fail(`Lệnh SVG ${token} chưa hỗ trợ Boolean; chuyển Arc sang Bézier trước. Bản gốc được giữ nguyên.`);
        tokens.push(token);
      } else {
        const value = Number(token);
        if (!finite(value) || Math.abs(value) > LIMITS.coordinate) fail("Số trong SVG path không hợp lệ hoặc vượt giới hạn.");
        tokens.push(value);
      }
      if (tokens.length > 16000) fail("SVG path có quá nhiều tham số.");
      end = matcher.lastIndex;
    }
    if (!/^\s*$/.test(pathData.slice(end))) fail("Cú pháp SVG path không hợp lệ.");
    return tokens;
  }
  function pathRings(pathData, transform, budget) {
    const tokens = tokenizePath(pathData), rings = [];
    let i = 0, command = "", current = [0, 0], origin = null, ring = null, previous = "", control = null;
    const read = (count) => {
      if (i + count > tokens.length || tokens.slice(i, i + count).some((value) => typeof value !== "number")) fail("SVG path thiếu tham số.");
      const values = tokens.slice(i, i + count); i += count; return values;
    };
    while (i < tokens.length) {
      if (typeof tokens[i] === "string") command = tokens[i++];
      else if (!command) fail("SVG path phải bắt đầu bằng lệnh.");
      const upper = command.toUpperCase(), relative = command !== upper;
      if (upper === "Z") {
        if (!ring || !origin) fail("Đóng SVG path khi chưa có contour.");
        if (ring.length > 1 && same(ring[0], ring.at(-1))) ring.pop();
        rings.push(ring); current = origin; origin = null; ring = null; command = ""; control = null; previous = "Z";
        if (rings.length > LIMITS.subpaths) fail("Path Boolean có quá nhiều contour.");
        continue;
      }
      const count = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 }[upper];
      const values = read(count);
      const pointAt = (index) => [values[index] + (relative ? current[0] : 0), values[index + 1] + (relative ? current[1] : 0)];
      if (upper === "M") {
        if (ring) fail("Boolean chỉ nhận contour đóng rõ ràng bằng Z; hãy đóng path trước.");
        current = pointAt(0); origin = current; ring = []; pushPoint(ring, transform(current), budget); control = null;
        command = relative ? "l" : "L";
      } else {
        if (!ring) fail("SVG path phải mở contour bằng M.");
        if (["L", "H", "V"].includes(upper)) {
          current = upper === "H" ? [values[0] + (relative ? current[0] : 0), current[1]] : upper === "V" ? [current[0], values[0] + (relative ? current[1] : 0)] : pointAt(0);
          pushPoint(ring, transform(current), budget); control = null;
        } else if (["C", "S"].includes(upper)) {
          const reflected = control && ["C", "S"].includes(previous) ? [2 * current[0] - control[0], 2 * current[1] - control[1]] : current;
          const c1 = upper === "C" ? pointAt(0) : reflected, c2 = pointAt(upper === "C" ? 2 : 0), end = pointAt(upper === "C" ? 4 : 2);
          cubic(ring, transform(current), transform(c1), transform(c2), transform(end), budget);
          current = end; control = c2;
        } else {
          const reflected = control && ["Q", "T"].includes(previous) ? [2 * current[0] - control[0], 2 * current[1] - control[1]] : current;
          const c = upper === "Q" ? pointAt(0) : reflected, end = pointAt(upper === "Q" ? 2 : 0);
          const c1 = [current[0] + (c[0] - current[0]) * 2 / 3, current[1] + (c[1] - current[1]) * 2 / 3];
          const c2 = [end[0] + (c[0] - end[0]) * 2 / 3, end[1] + (c[1] - end[1]) * 2 / 3];
          cubic(ring, transform(current), transform(c1), transform(c2), transform(end), budget);
          current = end; control = c;
        }
      }
      previous = upper;
    }
    if (ring || !rings.length) fail("Boolean chỉ nhận contour đóng rõ ràng bằng Z; hãy đóng path trước.");
    return rings;
  }
  function shapeRings(layer, budget) {
    const transform = transformFor(layer), ring = [], x = layer.x, y = layer.y, w = layer.width, h = layer.height;
    const add = (point) => pushPoint(ring, transform(point), budget);
    if (layer.type === "path") {
      let data = layer.pathData;
      if (!data && Array.isArray(layer.pathPoints) && layer.pathPoints.length) {
        if (!layer.pathClosed) fail("Hãy đóng path trước khi dùng Boolean.");
        const points = layer.pathPoints;
        data = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i += 1) {
          const previous = points[i - 1], point = points[i];
          data += ` C ${previous.x + (previous.outX || 0)} ${previous.y + (previous.outY || 0)} ${point.x + (point.inX || 0)} ${point.y + (point.inY || 0)} ${point.x} ${point.y}`;
        }
        data += " Z";
      }
      return pathRings(data, transform, budget);
    }
    if (layer.type === "ellipse") {
      const center = transform([x + w / 2, y + h / 2]), a = transform([x + w, y + h / 2]), b = transform([x + w / 2, y + h]);
      const radiusBound = Math.hypot(a[0] - center[0], a[1] - center[1]) + Math.hypot(b[0] - center[0], b[1] - center[1]);
      const segments = Math.max(16, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - LIMITS.tolerance / Math.max(radiusBound, LIMITS.tolerance)))));
      if (segments > LIMITS.ringPoints) fail("Ellipse quá lớn để đạt sai số 0,25 px trong giới hạn Boolean.");
      for (let i = 0; i < segments; i += 1) add([x + w / 2 + Math.cos(i * Math.PI * 2 / segments) * w / 2, y + h / 2 + Math.sin(i * Math.PI * 2 / segments) * h / 2]);
    } else if (["polygon", "star"].includes(layer.type)) {
      const count = layer.type === "star" ? Math.max(3, Math.min(24, layer.metadata?.points ?? 5)) : Math.max(3, Math.min(24, layer.metadata?.sides ?? 6));
      if (!Number.isInteger(count)) fail("Số cạnh hoặc cánh phải là số nguyên.");
      const ratio = layer.type === "star" ? Math.max(0.1, Math.min(0.9, layer.metadata?.innerRatio ?? 0.45)) : 1;
      const total = ratio < 1 ? count * 2 : count, radius = Math.min(w, h) / 2;
      for (let i = 0; i < total; i += 1) { const angle = -Math.PI / 2 + i * Math.PI * 2 / total, r = ratio < 1 && i % 2 ? radius * ratio : radius; add([x + w / 2 + Math.cos(angle) * r, y + h / 2 + Math.sin(angle) * r]); }
    } else if (layer.type === "rect") {
      const radius = Math.min(w / 2, h / 2, Math.max(0, layer.cornerRadius || 0));
      if (!radius) [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(add);
      else {
        // Circular corners use sagitta-bounded world-space sampling like ellipses.
        const center = transform([x, y]), ax = transform([x + radius, y]), ay = transform([x, y + radius]);
        const bound = Math.hypot(ax[0] - center[0], ax[1] - center[1]) + Math.hypot(ay[0] - center[0], ay[1] - center[1]);
        const steps = Math.max(2, Math.ceil(Math.PI / (2 * Math.acos(Math.max(-1, 1 - LIMITS.tolerance / Math.max(bound, LIMITS.tolerance))))));
        if (steps * 4 > LIMITS.ringPoints) fail("Góc bo quá lớn để đạt sai số Boolean trong giới hạn.");
        for (const [cx, cy, start] of [[x + w - radius, y + radius, -Math.PI / 2], [x + w - radius, y + h - radius, 0], [x + radius, y + h - radius, Math.PI / 2], [x + radius, y + radius, Math.PI]]) {
          for (let i = 0; i <= steps; i += 1) add([cx + Math.cos(start + i * Math.PI / (2 * steps)) * radius, cy + Math.sin(start + i * Math.PI / (2 * steps)) * radius]);
        }
      }
    } else fail("Boolean hỗ trợ rect, ellipse, polygon, star và path đóng; không hỗ trợ text, ảnh, group hoặc media.");
    return [ring];
  }
  function onSegment(point, a, b) { return Math.abs(cross(a, b, point)) < EPS && point[0] >= Math.min(a[0], b[0]) - EPS && point[0] <= Math.max(a[0], b[0]) + EPS && point[1] >= Math.min(a[1], b[1]) - EPS && point[1] <= Math.max(a[1], b[1]) + EPS; }
  function intersects(a, b, c, d) {
    const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
    return (abC * abD < 0 && cdA * cdB < 0) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
  }
  function contains(ring, point) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function ringsToMultiPolygon(rings, budget) {
    const entries = rings.map((ring) => {
      const clean = ring.length > 1 && same(ring[0], ring.at(-1)) ? ring.slice(0, -1) : ring;
      const area = signedArea(clean);
      if (clean.length < 3 || Math.abs(area) < EPS) fail("Contour Boolean không có diện tích hợp lệ.");
      return { ring: clean, area, parent: null, winding: 0, polygon: null };
    });
    // Reject self-crossing and crossing/touching compound contours rather than
    // guessing how SVG's nonzero winding should map onto GeoJSON hole arrays.
    for (let a = 0; a < entries.length; a += 1) for (let b = a; b < entries.length; b += 1) {
      const left = entries[a].ring, right = entries[b].ring;
      budget.pairs += a === b ? left.length * (left.length - 1) / 2 : left.length * right.length;
      if (budget.pairs > LIMITS.pairs) fail("Contour quá phức tạp để kiểm tra an toàn; hãy chia nhỏ hoặc đơn giản hóa path.");
      for (let i = 0; i < left.length; i += 1) for (let j = a === b ? i + 1 : 0; j < right.length; j += 1) {
        if (a === b && (j === i + 1 || (i === 0 && j === left.length - 1))) continue;
        if (intersects(left[i], left[(i + 1) % left.length], right[j], right[(j + 1) % right.length])) fail("Boolean không nhận contour tự cắt hoặc các subpath chạm/cắt nhau trong cùng path. Hãy tách chúng thành layer riêng.");
      }
    }
    const sorted = [...entries].sort((a, b) => Math.abs(b.area) - Math.abs(a.area)), polygons = [];
    for (const entry of sorted) {
      const containers = sorted.filter((candidate) => Math.abs(candidate.area) > Math.abs(entry.area) && contains(candidate.ring, entry.ring[0]));
      entry.parent = containers.sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0] || null;
      const before = entry.parent?.winding || 0;
      entry.winding = before + Math.sign(entry.area);
      if (before === 0 && entry.winding !== 0) {
        entry.polygon = [entry.ring]; polygons.push(entry.polygon);
      } else {
        let ancestor = entry.parent;
        while (ancestor && !ancestor.polygon) ancestor = ancestor.parent;
        if (before !== 0 && entry.winding === 0) ancestor?.polygon.push(entry.ring);
      }
    }
    return polygons;
  }
  function booleanLayers(layers, mode = "union") {
    if (!MODES[mode]) fail("Phép Boolean không hợp lệ.");
    if (!Array.isArray(layers) || layers.length < 2 || layers.length > LIMITS.layers) fail("Boolean cần 2–32 hình.");
    if (new Set(layers.map((layer) => layer.frameId)).size !== 1) fail("Chọn các hình trong cùng một frame.");
    const budget = { points: 0, pairs: 0 };
    const geometries = layers.map((layer) => {
      if (layer.locked) fail("Hãy mở khóa tất cả layer trước khi dùng Boolean.");
      if (layer.fill === "none") fail("Boolean làm việc trên vùng fill; path chỉ có stroke cần outline trước.");
      if (layer.masks?.some((mask) => mask.enabled) || layer.adjustments?.some((item) => item.enabled)) fail("Boolean chưa hỗ trợ mask hoặc hiệu ứng; bản gốc được giữ nguyên.");
      return ringsToMultiPolygon(shapeRings(layer, budget), budget);
    });
    let result;
    try { result = engine()[MODES[mode]](...geometries); }
    catch { fail("Engine không thể xử lý hình học này trong giới hạn an toàn. Bản gốc được giữ nguyên; hãy đơn giản hóa path."); }
    const points = result.flat(2);
    if (points.length > LIMITS.outputPoints) fail("Kết quả Boolean vượt 8.192 điểm; bản gốc được giữ nguyên.");
    points.forEach(checkedPoint);
    const approximate = layers.some((layer) => layer.type === "ellipse" || (layer.type === "rect" && layer.cornerRadius) || /[CQST]/i.test(layer.pathData || "") || layer.pathPoints?.some((point) => point.inX || point.inY || point.outX || point.outY));
    if (!points.length) return { empty: true, x: 0, y: 0, width: 0, height: 0, area: 0, pathData: "", approximate, tolerance: LIMITS.tolerance, engine: "polygon-clipping-0.15.7" };
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    const format = (value) => Number(value.toFixed(8));
    const pathData = result.flatMap((polygon) => polygon.map((ring) => `M ${ring.map((point) => `${format(point[0])} ${format(point[1])}`).join(" L ")} Z`)).join(" ");
    if (pathData.length > 200000) fail("Kết quả Boolean vượt dung lượng path; bản gốc được giữ nguyên.");
    const area = result.reduce((sum, polygon) => sum + Math.abs(signedArea(polygon[0])) - polygon.slice(1).reduce((holes, ring) => holes + Math.abs(signedArea(ring)), 0), 0);
    return { empty: false, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, area, pathData, approximate, tolerance: LIMITS.tolerance, engine: "polygon-clipping-0.15.7" };
  }
  const api = Object.freeze({ VERSION: 1, LIMITS, booleanLayers, shapeRings, transformFor, pathRings });
  globalThis.HHGraphicDesignGeometry = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
