"use strict";

// Deliberately small JavaScript learning subset. It never calls eval/Function,
// exposes no browser globals and accepts only declarations plus console.log.
const safeText = (value) => String(value ?? "").slice(0, 4000);

function tokenize(expression) {
  const tokens = []; let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index); const space = rest.match(/^\s+/); if (space) { index += space[0].length; continue; }
    const string = rest.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
    if (string) { tokens.push({ type: "value", value: JSON.parse(string[0][0] === "'" ? `"${string[0].slice(1, -1).replace(/"/g, '\\"')}"` : string[0]) }); index += string[0].length; continue; }
    const number = rest.match(/^\d+(?:\.\d+)?/); if (number) { tokens.push({ type: "value", value: Number(number[0]) }); index += number[0].length; continue; }
    const name = rest.match(/^[A-Za-z_$][\w$]*/); if (name) { tokens.push({ type: "name", value: name[0] }); index += name[0].length; continue; }
    if ("+-*/%()".includes(rest[0])) { tokens.push({ type: rest[0] === "(" || rest[0] === ")" ? "paren" : "op", value: rest[0] }); index += 1; continue; }
    throw new Error(`Ký hiệu không được hỗ trợ: ${rest[0]}`);
  }
  return tokens;
}

function evaluate(expression, variables) {
  const output = []; const ops = []; const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  for (const token of tokenize(expression)) {
    if (token.type === "value") output.push(token);
    else if (token.type === "name") { if (!Object.hasOwn(variables, token.value)) throw new Error(`Biến chưa được khai báo: ${token.value}`); output.push({ type: "value", value: variables[token.value] }); }
    else if (token.value === "(") ops.push(token);
    else if (token.value === ")") { while (ops.length && ops.at(-1).value !== "(") output.push(ops.pop()); if (!ops.length) throw new Error("Thiếu dấu ngoặc mở."); ops.pop(); }
    else { while (ops.length && ops.at(-1).type === "op" && precedence[ops.at(-1).value] >= precedence[token.value]) output.push(ops.pop()); ops.push(token); }
  }
  while (ops.length) { const token = ops.pop(); if (token.type === "paren") throw new Error("Thiếu dấu ngoặc đóng."); output.push(token); }
  const stack = [];
  for (const token of output) {
    if (token.type === "value") stack.push(token.value);
    else { if (stack.length < 2) throw new Error("Biểu thức chưa đầy đủ."); const right = stack.pop(); const left = stack.pop(); if (token.value === "+") stack.push(left + right); else if (token.value === "-") stack.push(Number(left) - Number(right)); else if (token.value === "*") stack.push(Number(left) * Number(right)); else if (token.value === "/") stack.push(Number(left) / Number(right)); else stack.push(Number(left) % Number(right)); }
  }
  if (stack.length !== 1) throw new Error("Biểu thức không hợp lệ."); return stack[0];
}

self.onmessage = (event) => {
  const { id, code } = event.data || {}; const output = []; const variables = Object.create(null);
  try {
    const source = String(code || "").slice(0, 5000);
    if (/\b(fetch|XMLHttpRequest|WebSocket|importScripts|indexedDB|caches|navigator|location|postMessage|Worker|SharedWorker|self|globalThis|constructor|prototype|__proto__)\b/.test(source)) throw new Error("Sandbox chặn API mạng, lưu trữ và truy cập môi trường.");
    const statements = source.split(/;|\n/).map((line) => line.trim()).filter(Boolean);
    if (statements.length > 100) throw new Error("Chương trình vượt giới hạn 100 câu lệnh.");
    for (const statement of statements) {
      const declaration = statement.match(/^(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
      const print = statement.match(/^console\.log\((.*)\)$/);
      if (declaration) variables[declaration[1]] = evaluate(declaration[2], variables);
      else if (print) output.push(safeText(evaluate(print[1], variables)));
      else throw new Error("Chỉ hỗ trợ let/const và console.log với số, chuỗi, biến và phép toán cơ bản.");
    }
    self.postMessage({ id, ok: true, output: output.join("\n") || "(không có output)" });
  } catch (error) { self.postMessage({ id, ok: false, error: safeText(error?.message || error) }); }
};
