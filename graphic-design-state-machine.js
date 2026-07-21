(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-state-machine";
  const STORAGE_KEY = "hh.graphic-state-machine.project.v1";
  const STYLE_ID = "hh-graphic-state-machine-style";
  const MAX_STATES = 40;
  const MAX_TRANSITIONS = 120;
  const MAX_PROPERTIES = 80;
  const MAX_BINDINGS = 100;
  const mounted = new WeakMap();

  const STATE_PRESETS = ["Idle", "Hover", "Pressed", "Loading", "Success", "Error"];
  const EVENTS = ["click", "hover", "drag", "scroll", "keyboard", "timer"];
  const PROPERTY_TYPES = ["boolean", "number", "string", "trigger"];
  const BINDING_TARGETS = ["text", "color", "position", "image", "state"];
  const BINDING_DIRECTIONS = ["source", "target", "bidirectional"];
  const OPERATORS = {
    boolean: ["equals", "not-equals"],
    number: ["equals", "not-equals", "greater", "greater-equal", "less", "less-equal"],
    string: ["equals", "not-equals", "contains", "starts-with", "ends-with"],
    trigger: ["triggered", "not-triggered"]
  };
  const CONVERTERS = ["none", "uppercase", "lowercase", "number", "boolean", "hex-color", "px", "url"];
  const STATE_ROLES = ["idle", "interactive", "pressed", "busy", "success", "error"];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function sanitizeText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 120);
  }

  function sanitizeIdentifier(value, fallback) {
    const safe = String(value == null ? "" : value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_$-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return safe || fallback || "item";
  }

  function typedValue(type, value) {
    if (type === "boolean") return value === true || value === "true" || value === 1 || value === "1";
    if (type === "number") return Number.isFinite(Number(value)) ? Number(value) : 0;
    if (type === "trigger") return Boolean(value);
    return sanitizeText(value, 500);
  }

  function propertyMap(project, overrides) {
    const map = {};
    project.properties.forEach((property) => { map[property.name] = typedValue(property.type, property.value); });
    if (overrides && typeof overrides === "object") {
      Object.keys(overrides).forEach((key) => {
        const property = project.properties.find((item) => item.name === key);
        if (property) map[key] = typedValue(property.type, overrides[key]);
      });
    }
    return map;
  }

  function defaultCondition(property, type, value) {
    return {
      id: uid("condition"),
      property: property || "enabled",
      type: PROPERTY_TYPES.includes(type) ? type : "boolean",
      operator: type === "trigger" ? "triggered" : "equals",
      value: value == null ? true : value
    };
  }

  function createDefaultProject() {
    const roles = ["idle", "interactive", "pressed", "busy", "success", "error"];
    const states = STATE_PRESETS.map((name, index) => ({
      id: name.toLowerCase(),
      name,
      x: 60 + (index % 3) * 250,
      y: 70 + Math.floor(index / 3) * 210,
      color: ["#67e8f9", "#a78bfa", "#f472b6", "#fbbf24", "#6ee7b7", "#fb7185"][index],
      description: ["Trạng thái mặc định", "Con trỏ đang ở trên", "Người dùng đang nhấn", "Đang xử lý dữ liệu", "Tác vụ hoàn tất", "Tác vụ thất bại"][index],
      role: roles[index],
      ariaLive: index >= 3 ? "polite" : "off",
      terminal: index >= 4
    }));
    return {
      format: FORMAT,
      version: VERSION,
      meta: { name: "Nút tương tác HH", updatedAt: new Date().toISOString() },
      initialStateId: "idle",
      states,
      transitions: [
        { id: "t-idle-hover", from: "idle", to: "hover", event: "hover", priority: 10, conditions: [], actions: [] },
        { id: "t-hover-press", from: "hover", to: "pressed", event: "click", priority: 10, conditions: [defaultCondition("enabled", "boolean", true)], actions: [] },
        { id: "t-press-load", from: "pressed", to: "loading", event: "timer", priority: 10, delay: 350, conditions: [], actions: [] },
        { id: "t-load-success", from: "loading", to: "success", event: "timer", priority: 20, delay: 900, conditions: [defaultCondition("hasError", "boolean", false)], actions: [{ property: "label", value: "Hoàn tất" }] },
        { id: "t-load-error", from: "loading", to: "error", event: "timer", priority: 10, delay: 900, conditions: [defaultCondition("hasError", "boolean", true)], actions: [{ property: "label", value: "Thử lại" }] },
        { id: "t-success-idle", from: "success", to: "idle", event: "click", priority: 10, conditions: [], actions: [{ property: "label", value: "Bắt đầu" }] },
        { id: "t-error-idle", from: "error", to: "idle", event: "click", priority: 10, conditions: [], actions: [{ property: "hasError", value: false }] }
      ],
      properties: [
        { id: "p-enabled", name: "enabled", type: "boolean", value: true },
        { id: "p-error", name: "hasError", type: "boolean", value: false },
        { id: "p-label", name: "label", type: "string", value: "Bắt đầu" },
        { id: "p-progress", name: "progress", type: "number", value: 0 },
        { id: "p-accent", name: "accent", type: "string", value: "#67e8f9" },
        { id: "p-submit", name: "submit", type: "trigger", value: false }
      ],
      bindings: [
        { id: "b-label", property: "label", target: "text", selector: "[data-hh-label]", direction: "source", converter: "none" },
        { id: "b-accent", property: "accent", target: "color", selector: ":host", direction: "source", converter: "hex-color" },
        { id: "b-state", property: "$state", target: "state", selector: ":host", direction: "source", converter: "none" }
      ]
    };
  }

  function normalizeCondition(raw, properties) {
    const fallback = properties[0] || { name: "enabled", type: "boolean", value: true };
    const property = properties.find((item) => item.name === raw?.property) || fallback;
    const type = PROPERTY_TYPES.includes(raw?.type) ? raw.type : property.type;
    const operators = OPERATORS[type];
    return {
      id: sanitizeIdentifier(raw?.id, uid("condition")),
      property: property.name,
      type,
      operator: operators.includes(raw?.operator) ? raw.operator : operators[0],
      value: typedValue(type, raw?.value)
    };
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    if (!raw || typeof raw !== "object") return fallback;
    const properties = Array.isArray(raw.properties) ? raw.properties.slice(0, MAX_PROPERTIES).map((item, index) => {
      const type = PROPERTY_TYPES.includes(item?.type) ? item.type : "string";
      return {
        id: sanitizeIdentifier(item?.id, `property-${index + 1}`),
        name: sanitizeIdentifier(item?.name, `property${index + 1}`),
        type,
        value: typedValue(type, item?.value)
      };
    }) : clone(fallback.properties);
    const uniquePropertyNames = new Set();
    const safeProperties = properties.filter((property) => {
      if (uniquePropertyNames.has(property.name)) return false;
      uniquePropertyNames.add(property.name);
      return true;
    });
    const states = Array.isArray(raw.states) ? raw.states.slice(0, MAX_STATES).map((state, index) => ({
      id: sanitizeIdentifier(state?.id, `state-${index + 1}`),
      name: sanitizeText(state?.name, 48) || `State ${index + 1}`,
      x: clamp(state?.x, 0, 1800),
      y: clamp(state?.y, 0, 1000),
      color: /^#[0-9a-f]{6}$/i.test(state?.color || "") ? state.color : "#67e8f9",
      description: sanitizeText(state?.description, 160),
      role: STATE_ROLES.includes(state?.role) ? state.role : (STATE_ROLES[index] || "interactive"),
      ariaLive: ["off", "polite", "assertive"].includes(state?.ariaLive) ? state.ariaLive : "off",
      terminal: state?.terminal === true
    })) : clone(fallback.states);
    const uniqueStateIds = new Set();
    const safeStates = states.filter((state) => {
      if (uniqueStateIds.has(state.id)) state.id = `${state.id}-${uniqueStateIds.size + 1}`;
      uniqueStateIds.add(state.id);
      return true;
    });
    if (!safeStates.length) safeStates.push(...clone(fallback.states));
    const stateIds = new Set(safeStates.map((state) => state.id));
    const transitions = Array.isArray(raw.transitions) ? raw.transitions.slice(0, MAX_TRANSITIONS).map((transition, index) => ({
      id: sanitizeIdentifier(transition?.id, `transition-${index + 1}`),
      from: stateIds.has(transition?.from) ? transition.from : safeStates[0].id,
      to: stateIds.has(transition?.to) ? transition.to : safeStates[Math.min(1, safeStates.length - 1)].id,
      event: EVENTS.includes(transition?.event) ? transition.event : "click",
      priority: clamp(transition?.priority == null ? 10 : transition.priority, -100, 100),
      delay: clamp(transition?.delay, 0, 600000),
      cooldown: clamp(transition?.cooldown, 0, 600000),
      once: transition?.once === true,
      preventDefault: transition?.preventDefault === true,
      key: sanitizeText(transition?.key, 32),
      conditions: Array.isArray(transition?.conditions) ? transition.conditions.slice(0, 12).map((condition) => normalizeCondition(condition, safeProperties)) : [],
      actions: Array.isArray(transition?.actions) ? transition.actions.slice(0, 12).map((action) => ({
        property: safeProperties.some((item) => item.name === action?.property) ? action.property : safeProperties[0]?.name || "enabled",
        value: sanitizeText(action?.value, 500)
      })) : []
    })) : clone(fallback.transitions);
    const bindings = Array.isArray(raw.bindings) ? raw.bindings.slice(0, MAX_BINDINGS).map((binding, index) => ({
      id: sanitizeIdentifier(binding?.id, `binding-${index + 1}`),
      property: binding?.property === "$state" || safeProperties.some((item) => item.name === binding?.property) ? binding.property : safeProperties[0]?.name || "$state",
      target: BINDING_TARGETS.includes(binding?.target) ? binding.target : "text",
      selector: sanitizeText(binding?.selector, 120) || "[data-hh-label]",
      direction: BINDING_DIRECTIONS.includes(binding?.direction) ? binding.direction : "source",
      converter: CONVERTERS.includes(binding?.converter) ? binding.converter : "none"
    })) : clone(fallback.bindings);
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: sanitizeText(raw.meta?.name, 80) || fallback.meta.name,
        updatedAt: new Date().toISOString()
      },
      initialStateId: stateIds.has(raw.initialStateId) ? raw.initialStateId : safeStates[0].id,
      states: safeStates,
      transitions,
      properties: safeProperties.length ? safeProperties : clone(fallback.properties),
      bindings
    };
  }

  function evaluateCondition(condition, values, eventPayload) {
    const actual = condition.type === "trigger" && condition.property === "$event"
      ? Boolean(eventPayload?.triggered)
      : typedValue(condition.type, values?.[condition.property]);
    const expected = typedValue(condition.type, condition.value);
    switch (condition.operator) {
      case "equals": return actual === expected;
      case "not-equals": return actual !== expected;
      case "greater": return Number(actual) > Number(expected);
      case "greater-equal": return Number(actual) >= Number(expected);
      case "less": return Number(actual) < Number(expected);
      case "less-equal": return Number(actual) <= Number(expected);
      case "contains": return String(actual).includes(String(expected));
      case "starts-with": return String(actual).startsWith(String(expected));
      case "ends-with": return String(actual).endsWith(String(expected));
      case "triggered": return actual === true;
      case "not-triggered": return actual !== true;
      default: return false;
    }
  }

  function selectTransition(projectInput, stateId, eventName, values, eventPayload) {
    const project = normalizeProject(projectInput);
    const candidates = project.transitions
      .filter((transition) => transition.from === stateId && transition.event === eventName)
      .filter((transition) => eventName !== "keyboard" || !transition.key || transition.key.toLowerCase() === String(eventPayload?.key || "").toLowerCase())
      .filter((transition) => transition.conditions.every((condition) => evaluateCondition(condition, values, eventPayload)))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    return candidates[0] || null;
  }

  function getStateSemantics(projectInput, stateId) {
    const project = normalizeProject(projectInput);
    const state = project.states.find((item) => item.id === stateId) || project.states[0];
    return {
      id: state.id,
      role: state.role,
      busy: state.role === "busy",
      terminal: state.terminal === true,
      success: state.role === "success",
      error: state.role === "error",
      ariaLive: state.ariaLive
    };
  }

  function validateProject(projectInput) {
    const project = normalizeProject(projectInput);
    const errors = [];
    const warnings = [];
    const reachable = new Set([project.initialStateId]);
    const queue = [project.initialStateId];
    while (queue.length) {
      const current = queue.shift();
      project.transitions.filter((item) => item.from === current).forEach((transition) => {
        if (!reachable.has(transition.to)) { reachable.add(transition.to); queue.push(transition.to); }
      });
    }
    project.states.forEach((state) => {
      if (!reachable.has(state.id)) warnings.push({ type: "unreachable-state", stateId: state.id });
      if (!state.terminal && !project.transitions.some((transition) => transition.from === state.id)) warnings.push({ type: "dead-end", stateId: state.id });
    });
    const signatures = new Map();
    project.transitions.forEach((transition) => {
      const signature = `${transition.from}|${transition.event}|${transition.priority}|${JSON.stringify(transition.conditions)}`;
      if (signatures.has(signature)) warnings.push({ type: "ambiguous-transition", transitionIds: [signatures.get(signature), transition.id] });
      else signatures.set(signature, transition.id);
      if (transition.event === "timer" && transition.delay === 0) warnings.push({ type: "immediate-timer", transitionId: transition.id });
      if (transition.from === transition.to && transition.event === "timer" && transition.delay === 0) errors.push({ type: "timer-loop", transitionId: transition.id });
    });
    return { valid: errors.length === 0, errors, warnings, reachable: [...reachable] };
  }

  function selectRuntimeTransition(project, runtime, eventName, payload, metadata) {
    const timestamp = payload?.timestamp == null ? Date.now() : Number(payload.timestamp);
    const used = metadata?.used || new Set();
    const lastRun = metadata?.lastRun || new Map();
    return project.transitions
      .filter((transition) => transition.from === runtime.stateId && transition.event === eventName)
      .filter((transition) => eventName !== "keyboard" || !transition.key || transition.key.toLowerCase() === String(payload?.key || "").toLowerCase())
      .filter((transition) => transition.conditions.every((condition) => evaluateCondition(condition, runtime.properties, payload || {})))
      .filter((transition) => !transition.once || !used.has(transition.id))
      .filter((transition) => !transition.cooldown || timestamp - (lastRun.has(transition.id) ? lastRun.get(transition.id) : -Infinity) >= transition.cooldown)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] || null;
  }

  function applyTransition(project, runtime, transition, timestamp) {
    if (!transition) return runtime;
    const properties = { ...runtime.properties };
    transition.actions.forEach((action) => {
      const definition = project.properties.find((item) => item.name === action.property);
      if (definition) properties[action.property] = typedValue(definition.type, action.value);
    });
    const entry = { from: runtime.stateId, to: transition.to, event: transition.event, transitionId: transition.id, at: timestamp == null ? Date.now() : timestamp };
    return { stateId: transition.to, properties, history: [...runtime.history, entry].slice(-100) };
  }

  function createSimulator(projectInput, initialValues, options) {
    const project = normalizeProject(projectInput);
    const clock = typeof options?.now === "function" ? options.now : () => Date.now();
    const listeners = new Set();
    const used = new Set();
    const lastRun = new Map();
    let enteredAt = clock();
    let runtime = { stateId: project.initialStateId, properties: propertyMap(project, initialValues), history: [] };
    const notify = (detail) => listeners.forEach((listener) => { try { listener(clone(detail)); } catch (_) { /* subscriber isolation */ } });
    function dispatch(eventName, payload) {
      if (!EVENTS.includes(eventName)) return { matched: false, transition: null, runtime: clone(runtime), reason: "unsupported-event" };
      const timestamp = payload?.timestamp == null ? clock() : Number(payload.timestamp);
      const transition = selectRuntimeTransition(project, runtime, eventName, { ...(payload || {}), timestamp }, { used, lastRun });
      if (!transition) return { matched: false, transition: null, runtime: clone(runtime), reason: "no-transition" };
      runtime = applyTransition(project, runtime, transition, timestamp);
      enteredAt = timestamp;
      if (transition.once) used.add(transition.id);
      lastRun.set(transition.id, timestamp);
      const result = { matched: true, transition: clone(transition), runtime: clone(runtime), semantics: getStateSemantics(project, runtime.stateId) };
      notify(result);
      return result;
    }
    return {
      dispatch,
      tick(timestamp) {
        const now = timestamp == null ? clock() : Number(timestamp);
        const due = project.transitions.filter((item) => item.from === runtime.stateId && item.event === "timer" && now - enteredAt >= item.delay);
        return due.length ? dispatch("timer", { timestamp: now }) : { matched: false, transition: null, runtime: clone(runtime), reason: "timer-not-due" };
      },
      setProperty(name, value) {
        const definition = project.properties.find((item) => item.name === name);
        if (!definition) return false;
        runtime.properties[name] = typedValue(definition.type, value);
        notify({ type: "property", name, value: runtime.properties[name], runtime: clone(runtime) });
        return true;
      },
      getAvailableEvents() {
        return [...new Set(project.transitions.filter((item) => item.from === runtime.stateId).map((item) => item.event))];
      },
      subscribe(listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
      getState: () => clone(runtime),
      reset(values) { runtime = { stateId: project.initialStateId, properties: propertyMap(project, values), history: [] }; enteredAt = clock(); used.clear(); lastRun.clear(); notify({ type: "reset", runtime: clone(runtime) }); return clone(runtime); },
      destroy() { listeners.clear(); used.clear(); lastRun.clear(); }
    };
  }

  function safeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  }

  function getCapabilities(scope) {
    const runtime = scope || globalScope;
    let localPersistence = false;
    try { localPersistence = Boolean(runtime.localStorage && typeof runtime.localStorage.setItem === "function"); } catch (_) { localPersistence = false; }
    return {
      deterministicRuntime: true,
      webComponentExport: true,
      localPersistence,
      externalData: false,
      realtimeCollaboration: false,
      note: "State Machine runs locally. External data and realtime require an explicit adapter."
    };
  }

  function exportProject(project) {
    return JSON.stringify(normalizeProject(project), null, 2);
  }

  function exportWebComponent(projectInput) {
    const project = normalizeProject(projectInput);
    const tag = `hh-${sanitizeIdentifier(project.meta.name, "interaction").toLowerCase()}`;
    const data = safeJsonForScript(project);
    return `<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(project.meta.name)}</title>
<${tag}></${tag}>
<script>
(() => {
  const project = ${data};
  const cast = (type, value) => type === "number" ? Number(value) || 0 : type === "boolean" || type === "trigger" ? value === true || value === "true" : String(value == null ? "" : value);
  const convert = (kind, value) => kind === "uppercase" ? String(value).toUpperCase() : kind === "lowercase" ? String(value).toLowerCase() : kind === "number" ? Number(value) || 0 : kind === "boolean" ? Boolean(value) : kind === "hex-color" ? (/^#[0-9a-f]{6}$/i.test(String(value)) ? value : "#67e8f9") : kind === "px" ? (Number(value) || 0) + "px" : kind === "url" ? (/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(String(value)) ? value : "") : value;
  const test = (condition, values, payload) => { const a = condition.type === "trigger" && condition.property === "$event" ? Boolean(payload&&payload.triggered) : cast(condition.type, values[condition.property]); const b = cast(condition.type, condition.value); const op = condition.operator; return op === "equals" ? a === b : op === "not-equals" ? a !== b : op === "greater" ? a > b : op === "greater-equal" ? a >= b : op === "less" ? a < b : op === "less-equal" ? a <= b : op === "contains" ? String(a).includes(String(b)) : op === "starts-with" ? String(a).startsWith(String(b)) : op === "ends-with" ? String(a).endsWith(String(b)) : op === "triggered" ? a === true : op === "not-triggered" ? a !== true : false; };
  class HHInteraction extends HTMLElement {
    constructor() { super(); this.attachShadow({mode:"open"}); this.timer=0; this.used=new Set(); this.lastRun=new Map(); this.reset(); }
    connectedCallback() { this.render(); this.scheduleTimer(); ["click","pointerenter","pointermove","scroll","keydown"].forEach(type => this.addEventListener(type, event => { const map={pointerenter:"hover",pointermove:"drag",keydown:"keyboard"}; this.trigger(map[type]||type,{key:event.key}); })); }
    disconnectedCallback() { clearTimeout(this.timer); }
    trigger(eventName, payload={}) { const now=Date.now(); const options=project.transitions.filter(t=>t.from===this.stateId&&t.event===eventName&&(!t.key||String(t.key).toLowerCase()===String(payload.key||"").toLowerCase())&&t.conditions.every(c=>test(c,this.values,payload))&&(!t.once||!this.used.has(t.id))&&(!t.cooldown||now-(this.lastRun.has(t.id)?this.lastRun.get(t.id):-Infinity)>=t.cooldown)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)); const transition=options[0]; if(!transition) return false; transition.actions.forEach(a=>{ const p=project.properties.find(item=>item.name===a.property); if(p)this.values[a.property]=cast(p.type,a.value); }); if(transition.once)this.used.add(transition.id); this.lastRun.set(transition.id,now); this.stateId=transition.to; this.history.push({from:transition.from,to:transition.to,event:eventName,at:now}); this.render(); this.scheduleTimer(); this.dispatchEvent(new CustomEvent("hh-state-change",{detail:{state:this.stateId,transition:transition.id},bubbles:true})); return true; }
    setProperty(name,value) { const p=project.properties.find(item=>item.name===name); if(!p)return false; this.values[name]=cast(p.type,value); this.render(); return true; }
    getProperty(name) { return this.values[name]; }
    getState() { return this.stateId; }
    reset() { this.stateId=project.initialStateId; this.values=Object.fromEntries(project.properties.map(p=>[p.name,cast(p.type,p.value)])); this.history=[]; this.used&&this.used.clear(); this.lastRun&&this.lastRun.clear(); if(this.isConnected){this.render();this.scheduleTimer();} }
    scheduleTimer() { clearTimeout(this.timer); const timers=project.transitions.filter(t=>t.from===this.stateId&&t.event==="timer").sort((a,b)=>(a.delay||0)-(b.delay||0)||b.priority-a.priority); if(timers[0])this.timer=setTimeout(()=>this.trigger("timer"),timers[0].delay||0); }
    applyBindings() { project.bindings.forEach(binding=>{ let element; try{element=binding.selector===":host"?this:this.shadowRoot.querySelector(binding.selector);}catch(_){return;} if(!element)return; const raw=binding.property==="$state"?this.stateId:this.values[binding.property]; const value=convert(binding.converter,raw); if(binding.direction!=="target"){ if(binding.target==="text")element.textContent=String(value); if(binding.target==="color")element.style.setProperty("--accent",String(value)); if(binding.target==="position")element.style.transform=\`translateX(\${value})\`; if(binding.target==="image"&&"src" in element)element.src=String(value); if(binding.target==="state")element.dataset.state=String(value); } if(binding.direction!=="source"&&element!==this&&binding.property!=="$state"){ const sync=()=>this.setProperty(binding.property,"value" in element?element.value:element.textContent); element.addEventListener("input",sync); element.addEventListener("change",sync); } }); }
    render() { const state=project.states.find(s=>s.id===this.stateId)||project.states[0]; const label=String(this.values.label||state.name); const color=convert("hex-color",this.values.accent||state.color); const busy=state.role==="busy"; this.setAttribute("aria-busy",String(busy)); this.setAttribute("aria-live",state.ariaLive||"off"); this.dataset.state=this.stateId; this.shadowRoot.innerHTML=\`<style>:host{display:inline-block;--accent:\${color};font:600 16px system-ui}button{border:1px solid color-mix(in srgb,var(--accent),white 25%);border-radius:12px;background:color-mix(in srgb,var(--accent),#08111d 82%);box-shadow:0 10px 36px color-mix(in srgb,var(--accent),transparent 72%);color:white;cursor:pointer;padding:14px 22px;transition:transform .18s ease}button:hover{transform:translateY(-2px)}@media(prefers-reduced-motion:reduce){button{transition:none}}</style><button type="button" data-hh-label></button>\`; const button=this.shadowRoot.querySelector("button"); button.textContent=label; button.setAttribute("aria-label",label); button.disabled=busy||this.values.enabled===false; this.applyBindings(); }
  }
  customElements.define("${tag}", HHInteraction);
})();
<\/script></html>`;
  }

  const styles = `
  .hhsm{--sm-bg:#070b14;--sm-panel:#0d1420;--sm-panel2:#111b2a;--sm-line:#27374b;--sm-text:#edf5ff;--sm-muted:#8fa0b6;--sm-cyan:#67e8f9;--sm-pink:#f472b6;--sm-lime:#bef264;color:var(--sm-text);background:radial-gradient(circle at 8% 0%,rgba(244,114,182,.14),transparent 28%),radial-gradient(circle at 90% 8%,rgba(103,232,249,.12),transparent 30%),var(--sm-bg);border:1px solid rgba(103,232,249,.22);border-radius:16px;min-height:760px;overflow:hidden;font:500 12px/1.45 Inter,ui-sans-serif,system-ui,"Segoe UI",sans-serif;position:relative}.hhsm *{box-sizing:border-box}.hhsm button,.hhsm input,.hhsm select{font:inherit}.hhsm button{background:#111b29;border:1px solid var(--sm-line);border-radius:8px;color:var(--sm-text);cursor:pointer;min-height:32px;padding:6px 10px;transition:transform .16s ease,border-color .16s ease,background .16s ease}.hhsm button:hover{background:#17263a;border-color:var(--sm-cyan);transform:translateY(-1px)}.hhsm button:focus-visible,.hhsm input:focus-visible,.hhsm select:focus-visible{outline:2px solid var(--sm-cyan);outline-offset:2px}.hhsm button[data-primary]{background:linear-gradient(115deg,var(--sm-cyan),#83a8ff);border-color:transparent;color:#07121e;font-weight:800}.hhsm button[data-danger]{color:#fda4c8}.hhsm-top{align-items:center;background:rgba(8,13,22,.92);border-bottom:1px solid var(--sm-line);display:flex;gap:8px;min-height:58px;padding:10px 12px}.hhsm-brand{align-items:center;display:flex;gap:9px;margin-right:auto}.hhsm-logo{background:linear-gradient(135deg,var(--sm-pink),var(--sm-cyan));border-radius:10px;color:#06101a;display:grid;font-weight:900;height:34px;place-items:center;width:34px}.hhsm-brand strong,.hhsm-brand small{display:block}.hhsm-brand small{color:var(--sm-muted);font-size:9px;text-transform:uppercase}.hhsm-actions{display:flex;gap:6px}.hhsm-layout{display:grid;grid-template-columns:232px minmax(520px,1fr) 300px;min-height:660px}.hhsm-panel{background:rgba(8,13,22,.74);border-right:1px solid var(--sm-line);min-width:0;padding:12px}.hhsm-panel:last-child{border-left:1px solid var(--sm-line);border-right:0}.hhsm-section{border-top:1px solid rgba(39,55,75,.76);margin-top:14px;padding-top:12px}.hhsm-section:first-child{border-top:0;margin-top:0;padding-top:0}.hhsm-heading{align-items:center;display:flex;justify-content:space-between;margin-bottom:8px}.hhsm-heading strong{font-size:10px;text-transform:uppercase}.hhsm-heading span{color:var(--sm-cyan);font-size:10px}.hhsm-list{display:grid;gap:6px}.hhsm-state-row,.hhsm-property-row,.hhsm-binding-row{align-items:center;background:#0b131f;border:1px solid transparent;border-radius:8px;display:grid;gap:6px;padding:7px}.hhsm-state-row{grid-template-columns:10px 1fr auto}.hhsm-state-row.is-active{border-color:var(--sm-cyan);background:rgba(103,232,249,.08)}.hhsm-dot{border-radius:50%;height:8px;width:8px}.hhsm-state-row small,.hhsm-property-row small,.hhsm-binding-row small{color:var(--sm-muted)}.hhsm-property-row{grid-template-columns:minmax(0,1fr) 72px}.hhsm-binding-row{grid-template-columns:1fr auto}.hhsm-input,.hhsm-select{background:#09111c;border:1px solid var(--sm-line);border-radius:7px;color:var(--sm-text);min-height:32px;padding:6px 8px;width:100%}.hhsm-field{display:grid;gap:4px;margin-bottom:9px}.hhsm-field label{color:var(--sm-muted);font-size:9px;text-transform:uppercase}.hhsm-grid2{display:grid;gap:7px;grid-template-columns:1fr 1fr}.hhsm-work{display:grid;grid-template-rows:42px minmax(430px,1fr) 180px;min-width:0}.hhsm-canvasbar{align-items:center;background:#0a111c;border-bottom:1px solid var(--sm-line);display:flex;gap:7px;padding:6px 10px}.hhsm-canvasbar span{color:var(--sm-muted);margin-left:auto}.hhsm-canvas{background-color:#080f19;background-image:linear-gradient(rgba(103,232,249,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(103,232,249,.055) 1px,transparent 1px);background-size:24px 24px;min-height:430px;overflow:auto;position:relative}.hhsm-board{height:650px;min-width:900px;position:relative;width:100%}.hhsm-links{height:100%;inset:0;overflow:visible;pointer-events:none;position:absolute;width:100%}.hhsm-link{fill:none;stroke:#64748b;stroke-width:2}.hhsm-link.is-active{filter:drop-shadow(0 0 5px var(--sm-cyan));stroke:var(--sm-cyan);stroke-width:3}.hhsm-link-hit{fill:none;pointer-events:stroke;stroke:transparent;stroke-width:16}.hhsm-node{background:linear-gradient(145deg,#111d2c,#0b121d);border:1px solid var(--node-color);border-radius:11px;box-shadow:0 12px 35px rgba(0,0,0,.32);cursor:grab;min-height:88px;padding:10px;position:absolute;width:180px}.hhsm-node:active{cursor:grabbing}.hhsm-node.is-current{box-shadow:0 0 0 3px color-mix(in srgb,var(--node-color),transparent 72%),0 0 30px color-mix(in srgb,var(--node-color),transparent 68%)}.hhsm-node.is-selected{outline:2px solid white;outline-offset:2px}.hhsm-node-head{align-items:center;display:flex;gap:7px}.hhsm-node-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hhsm-node small{color:var(--sm-muted);display:block;margin-top:7px}.hhsm-port{background:var(--node-color);border:2px solid #07101a;border-radius:50%;height:12px;position:absolute;top:38px;width:12px}.hhsm-port.in{left:-7px}.hhsm-port.out{right:-7px}.hhsm-node-actions{display:flex;gap:4px;margin-top:8px}.hhsm-node-actions button{font-size:9px;min-height:24px;padding:2px 6px}.hhsm-simulator{background:#090f19;border-top:1px solid var(--sm-line);display:grid;grid-template-columns:190px 1fr 230px;min-height:0}.hhsm-sim-status,.hhsm-events,.hhsm-history{min-width:0;padding:11px}.hhsm-events{border-left:1px solid var(--sm-line);border-right:1px solid var(--sm-line)}.hhsm-event-grid{display:grid;gap:6px;grid-template-columns:repeat(3,1fr)}.hhsm-sim-state{align-items:center;background:linear-gradient(115deg,rgba(103,232,249,.13),rgba(244,114,182,.09));border:1px solid rgba(103,232,249,.3);border-radius:10px;display:flex;font-size:16px;font-weight:800;gap:8px;padding:10px}.hhsm-history-list{color:var(--sm-muted);display:grid;font-size:10px;gap:5px;max-height:115px;overflow:auto}.hhsm-history-list strong{color:var(--sm-text)}.hhsm-condition{background:#0a1320;border:1px solid var(--sm-line);border-radius:8px;display:grid;gap:5px;margin-bottom:7px;padding:7px}.hhsm-condition-grid{display:grid;gap:5px;grid-template-columns:1fr 1fr}.hhsm-empty{border:1px dashed var(--sm-line);border-radius:9px;color:var(--sm-muted);padding:14px;text-align:center}.hhsm-status{align-items:center;background:#080d16;border-top:1px solid var(--sm-line);color:var(--sm-muted);display:flex;gap:10px;min-height:34px;padding:6px 12px}.hhsm-status span:last-child{margin-left:auto}.hhsm-sr{clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px}.hhsm-file{display:none}.hhsm-toast{background:#112337;border:1px solid var(--sm-cyan);border-radius:8px;bottom:45px;box-shadow:0 14px 38px rgba(0,0,0,.42);padding:9px 12px;position:absolute;right:16px;z-index:10}
  @media(max-width:1120px){.hhsm-layout{grid-template-columns:200px minmax(430px,1fr) 260px}.hhsm-actions button:nth-child(n+4){display:none}.hhsm-simulator{grid-template-columns:160px 1fr 190px}}
  @media(max-width:820px){.hhsm{border-radius:10px}.hhsm-top{align-items:flex-start;flex-wrap:wrap}.hhsm-brand{width:100%}.hhsm-actions{width:100%}.hhsm-actions button{display:block!important;flex:1;font-size:10px;padding:4px}.hhsm-layout{grid-template-columns:1fr}.hhsm-panel{border-bottom:1px solid var(--sm-line);border-right:0}.hhsm-panel:last-child{border-left:0}.hhsm-work{grid-row:1}.hhsm-simulator{grid-template-columns:1fr}.hhsm-events{border:0;border-bottom:1px solid var(--sm-line);border-top:1px solid var(--sm-line)}.hhsm-board{min-width:760px}.hhsm-state-row{grid-template-columns:10px 1fr auto}.hhsm-grid2{grid-template-columns:1fr 1fr}}
  @media(max-width:520px){.hhsm-actions{display:grid;grid-template-columns:repeat(3,1fr)}.hhsm-layout{display:flex;flex-direction:column}.hhsm-work{order:-1}.hhsm-canvasbar span{display:none}.hhsm-event-grid{grid-template-columns:repeat(2,1fr)}.hhsm-grid2{grid-template-columns:1fr}}
  @media(prefers-reduced-motion:reduce){.hhsm *{animation-duration:.01ms!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
  `;

  function injectStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = styles;
    doc.head.appendChild(style);
  }

  function downloadText(doc, filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function mount(target, options) {
    const doc = target?.ownerDocument || globalScope.document;
    if (!doc) return null;
    const root = typeof target === "string" ? doc.querySelector(target) : target || doc.querySelector("[data-graphic-state-machine]");
    if (!root) return null;
    if (mounted.has(root)) return mounted.get(root).api;
    injectStyles(doc);
    let storage = options?.storage;
    if (!storage) { try { storage = globalScope.localStorage; } catch (_) { storage = null; } }
    let project = createDefaultProject();
    try { project = normalizeProject(JSON.parse(storage?.getItem(STORAGE_KEY) || "null")); } catch (_) { project = createDefaultProject(); }
    let selectedStateId = project.initialStateId;
    let selectedTransitionId = project.transitions[0]?.id || "";
    let selectedBindingId = "";
    let connectFrom = "";
    let simulator = createSimulator(project);
    let runtime = simulator.getState();
    let drag = null;
    let toastTimer = 0;
    let saveTimer = 0;
    const listeners = [];

    const on = (node, type, handler, config) => {
      if (!node) return;
      node.addEventListener(type, handler, config);
      listeners.push(() => node.removeEventListener(type, handler, config));
    };
    const persist = () => {
      project.meta.updatedAt = new Date().toISOString();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { try { storage?.setItem(STORAGE_KEY, exportProject(project)); } catch (_) { /* local-only fallback */ } }, 120);
    };
    const toast = (message) => {
      root.querySelector(".hhsm-toast")?.remove();
      const node = doc.createElement("div");
      node.className = "hhsm-toast";
      node.setAttribute("role", "status");
      node.textContent = message;
      root.appendChild(node);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => node.remove(), 2200);
    };
    const selectedTransition = () => project.transitions.find((item) => item.id === selectedTransitionId) || null;
    const selectedBinding = () => project.bindings.find((item) => item.id === selectedBindingId) || null;
    const selectedState = () => project.states.find((item) => item.id === selectedStateId) || project.states[0];

    function transitionPath(transition) {
      const from = project.states.find((item) => item.id === transition.from);
      const to = project.states.find((item) => item.id === transition.to);
      if (!from || !to) return "";
      const x1 = from.x + 180;
      const y1 = from.y + 44;
      const x2 = to.x;
      const y2 = to.y + 44;
      const bend = Math.max(70, Math.abs(x2 - x1) * 0.48);
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    }

    function renderGraph() {
      const board = root.querySelector("[data-sm-board]");
      if (!board) return;
      board.innerHTML = `
        <svg class="hhsm-links" aria-hidden="true"><defs><marker id="hhsm-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#67e8f9"/></marker></defs>${project.transitions.map((transition) => `<path class="hhsm-link ${transition.id === selectedTransitionId ? "is-active" : ""}" d="${transitionPath(transition)}" marker-end="url(#hhsm-arrow)"/><path class="hhsm-link-hit" data-sm-transition="${escapeHtml(transition.id)}" d="${transitionPath(transition)}"/>`).join("")}</svg>
        ${project.states.map((state) => `<article class="hhsm-node ${state.id === runtime.stateId ? "is-current" : ""} ${state.id === selectedStateId ? "is-selected" : ""}" style="left:${state.x}px;top:${state.y}px;--node-color:${state.color}" data-sm-node="${escapeHtml(state.id)}" tabindex="0" aria-label="State ${escapeHtml(state.name)}"><span class="hhsm-port in"></span><span class="hhsm-port out"></span><div class="hhsm-node-head"><span class="hhsm-dot" style="background:${state.color}"></span><strong>${escapeHtml(state.name)}</strong></div><small>${escapeHtml(state.description || "State tương tác")}</small><div class="hhsm-node-actions"><button type="button" data-sm-connect="${escapeHtml(state.id)}">${connectFrom === state.id ? "Chọn đích..." : "Nối"}</button><button type="button" data-sm-set-initial="${escapeHtml(state.id)}">${project.initialStateId === state.id ? "Khởi đầu" : "Đặt đầu"}</button></div></article>`).join("")}`;
    }

    function renderStateList() {
      const node = root.querySelector("[data-sm-state-list]");
      if (!node) return;
      node.innerHTML = project.states.map((state) => `<button type="button" class="hhsm-state-row ${state.id === selectedStateId ? "is-active" : ""}" data-sm-select-state="${escapeHtml(state.id)}"><span class="hhsm-dot" style="background:${state.color}"></span><span><strong>${escapeHtml(state.name)}</strong><small>${project.transitions.filter((item) => item.from === state.id).length} transition</small></span><small>${project.initialStateId === state.id ? "START" : ""}</small></button>`).join("");
    }

    function renderProperties() {
      const node = root.querySelector("[data-sm-property-list]");
      if (!node) return;
      node.innerHTML = project.properties.map((property) => `<div class="hhsm-property-row"><span><strong>${escapeHtml(property.name)}</strong><small>${escapeHtml(property.type)}</small></span>${property.type === "boolean" || property.type === "trigger" ? `<select class="hhsm-select" data-sm-property-value="${escapeHtml(property.id)}"><option value="true" ${property.value === true ? "selected" : ""}>true</option><option value="false" ${property.value === false ? "selected" : ""}>false</option></select>` : `<input class="hhsm-input" data-sm-property-value="${escapeHtml(property.id)}" type="${property.type === "number" ? "number" : "text"}" value="${escapeHtml(property.value)}">`}</div>`).join("");
    }

    function renderBindings() {
      const node = root.querySelector("[data-sm-binding-list]");
      if (!node) return;
      node.innerHTML = project.bindings.map((binding) => `<button type="button" class="hhsm-binding-row ${binding.id === selectedBindingId ? "is-active" : ""}" data-sm-select-binding="${escapeHtml(binding.id)}"><span><strong>${escapeHtml(binding.property)} → ${escapeHtml(binding.target)}</strong><small>${escapeHtml(binding.selector)} · ${escapeHtml(binding.direction)}</small></span><small>${escapeHtml(binding.converter)}</small></button>`).join("") || `<div class="hhsm-empty">Chưa có binding.</div>`;
    }

    function renderInspector() {
      const node = root.querySelector("[data-sm-inspector]");
      if (!node) return;
      const binding = selectedBinding();
      if (binding) {
        node.innerHTML = `<div class="hhsm-heading"><strong>Data Binding</strong><span>${escapeHtml(binding.id)}</span></div>
          <div class="hhsm-field"><label>View Model property</label><select class="hhsm-select" data-sm-binding-property><option value="$state" ${binding.property === "$state" ? "selected" : ""}>$state</option>${project.properties.map((property) => `<option value="${escapeHtml(property.name)}" ${binding.property === property.name ? "selected" : ""}>${escapeHtml(property.name)}</option>`).join("")}</select></div>
          <div class="hhsm-grid2"><div class="hhsm-field"><label>Đích</label><select class="hhsm-select" data-sm-binding-target>${BINDING_TARGETS.map((target) => `<option value="${target}" ${binding.target === target ? "selected" : ""}>${target}</option>`).join("")}</select></div><div class="hhsm-field"><label>Hướng</label><select class="hhsm-select" data-sm-binding-direction>${BINDING_DIRECTIONS.map((direction) => `<option value="${direction}" ${binding.direction === direction ? "selected" : ""}>${direction}</option>`).join("")}</select></div></div>
          <div class="hhsm-field"><label>CSS selector</label><input class="hhsm-input" data-sm-binding-selector value="${escapeHtml(binding.selector)}"></div>
          <div class="hhsm-field"><label>Converter</label><select class="hhsm-select" data-sm-binding-converter>${CONVERTERS.map((converter) => `<option value="${converter}" ${binding.converter === converter ? "selected" : ""}>${converter}</option>`).join("")}</select></div>
          <button type="button" data-sm-delete-binding data-danger>Xóa binding</button>`;
        return;
      }
      const transition = selectedTransition();
      if (!transition) {
        const state = selectedState();
        node.innerHTML = `<div class="hhsm-heading"><strong>Thuộc tính state</strong><span>${escapeHtml(state.id)}</span></div><div class="hhsm-field"><label>Tên state</label><input class="hhsm-input" data-sm-state-name value="${escapeHtml(state.name)}"></div><div class="hhsm-field"><label>Mô tả</label><input class="hhsm-input" data-sm-state-description value="${escapeHtml(state.description)}"></div><div class="hhsm-grid2"><div class="hhsm-field"><label>Vai trò</label><select class="hhsm-select" data-sm-state-role>${STATE_ROLES.map((role) => `<option value="${role}" ${state.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></div><div class="hhsm-field"><label>ARIA live</label><select class="hhsm-select" data-sm-state-live>${["off", "polite", "assertive"].map((mode) => `<option value="${mode}" ${state.ariaLive === mode ? "selected" : ""}>${mode}</option>`).join("")}</select></div></div><label class="hhsm-field"><span><input type="checkbox" data-sm-state-terminal ${state.terminal ? "checked" : ""}> Trạng thái kết thúc</span></label><div class="hhsm-field"><label>Màu</label><input class="hhsm-input" data-sm-state-color type="color" value="${escapeHtml(state.color)}"></div><button type="button" data-sm-delete-state data-danger>Xóa state</button>`;
        return;
      }
      node.innerHTML = `<div class="hhsm-heading"><strong>Transition</strong><span>${escapeHtml(transition.from)} → ${escapeHtml(transition.to)}</span></div>
        <div class="hhsm-grid2"><div class="hhsm-field"><label>Sự kiện</label><select class="hhsm-select" data-sm-transition-event>${EVENTS.map((event) => `<option ${transition.event === event ? "selected" : ""}>${event}</option>`).join("")}</select></div><div class="hhsm-field"><label>Ưu tiên</label><input class="hhsm-input" data-sm-transition-priority type="number" min="-100" max="100" value="${transition.priority}"></div></div>
        ${transition.event === "timer" ? `<div class="hhsm-field"><label>Độ trễ (ms)</label><input class="hhsm-input" data-sm-transition-delay type="number" min="0" max="600000" value="${transition.delay || 0}"></div>` : ""}
        ${transition.event === "keyboard" ? `<div class="hhsm-field"><label>Phím</label><input class="hhsm-input" data-sm-transition-key value="${escapeHtml(transition.key || "Enter")}"></div>` : ""}
        <div class="hhsm-grid2"><div class="hhsm-field"><label>Cooldown (ms)</label><input class="hhsm-input" data-sm-transition-cooldown type="number" min="0" max="600000" value="${transition.cooldown || 0}"></div><div class="hhsm-field"><label>Tùy chọn</label><label><input type="checkbox" data-sm-transition-once ${transition.once ? "checked" : ""}> Chỉ chạy một lần</label><label><input type="checkbox" data-sm-transition-prevent ${transition.preventDefault ? "checked" : ""}> Chặn mặc định</label></div></div>
        <div class="hhsm-heading"><strong>Điều kiện</strong><button type="button" data-sm-add-condition>+ Điều kiện</button></div>
        ${transition.conditions.map((condition) => `<div class="hhsm-condition" data-sm-condition="${escapeHtml(condition.id)}"><div class="hhsm-condition-grid"><select class="hhsm-select" data-sm-condition-property>${project.properties.map((property) => `<option value="${escapeHtml(property.name)}" ${property.name === condition.property ? "selected" : ""}>${escapeHtml(property.name)}</option>`).join("")}</select><select class="hhsm-select" data-sm-condition-operator>${OPERATORS[condition.type].map((operator) => `<option value="${operator}" ${operator === condition.operator ? "selected" : ""}>${operator}</option>`).join("")}</select></div><div class="hhsm-condition-grid"><input class="hhsm-input" data-sm-condition-value value="${escapeHtml(condition.value)}"><button type="button" data-sm-remove-condition="${escapeHtml(condition.id)}" data-danger>Xóa</button></div></div>`).join("") || `<div class="hhsm-empty">Luôn chuyển khi nhận đúng event.</div>`}
        <div class="hhsm-grid2"><button type="button" data-sm-test-transition data-primary>Test transition</button><button type="button" data-sm-delete-transition data-danger>Xóa transition</button></div>`;
    }

    function renderSimulator() {
      const state = project.states.find((item) => item.id === runtime.stateId) || project.states[0];
      const status = root.querySelector("[data-sm-sim-status]");
      const history = root.querySelector("[data-sm-history]");
      if (status) status.innerHTML = `<div class="hhsm-heading"><strong>Simulator</strong><span>LIVE</span></div><div class="hhsm-sim-state"><span class="hhsm-dot" style="background:${state.color}"></span>${escapeHtml(state.name)}</div><button type="button" data-sm-reset-sim style="width:100%;margin-top:7px">Reset mẫu</button>`;
      if (history) history.innerHTML = `<div class="hhsm-heading"><strong>Lịch sử state</strong><span>${runtime.history.length}</span></div><div class="hhsm-history-list">${runtime.history.slice().reverse().map((entry) => `<span><strong>${escapeHtml(entry.event)}</strong> ${escapeHtml(entry.from)} → ${escapeHtml(entry.to)}</span>`).join("") || "Chưa phát event."}</div>`;
      root.querySelectorAll("[data-sm-node]").forEach((node) => node.classList.toggle("is-current", node.dataset.smNode === runtime.stateId));
    }

    function render() {
      root.className = `${root.className.replace(/\bhhsm\b/g, "").trim()} hhsm`.trim();
      root.setAttribute("data-graphic-state-machine", "");
      root.innerHTML = `<header class="hhsm-top"><div class="hhsm-brand"><span class="hhsm-logo">SM</span><span><strong>State Machine & Data Binding</strong><small>HH Creative Engine · deterministic runtime</small></span></div><div class="hhsm-actions"><button type="button" data-sm-new-state>+ State</button><button type="button" data-sm-import>Nhập JSON</button><button type="button" data-sm-export-project>Xuất project</button><button type="button" data-sm-copy-component>Sao chép Web Component</button><button type="button" data-sm-download-component data-primary>Tải component</button></div><input class="hhsm-file" type="file" accept="application/json" data-sm-file><span class="hhsm-sr" aria-live="polite" data-sm-live></span></header>
        <main class="hhsm-layout"><aside class="hhsm-panel"><section class="hhsm-section"><div class="hhsm-heading"><strong>States</strong><span>${project.states.length}</span></div><div class="hhsm-list" data-sm-state-list></div></section><section class="hhsm-section"><div class="hhsm-heading"><strong>View Model</strong><button type="button" data-sm-add-property>+ Thuộc tính</button></div><div class="hhsm-list" data-sm-property-list></div></section><section class="hhsm-section"><div class="hhsm-heading"><strong>Data Binding</strong><button type="button" data-sm-add-binding>+ Binding</button></div><div class="hhsm-list" data-sm-binding-list></div></section></aside>
        <section class="hhsm-work"><div class="hhsm-canvasbar"><button type="button" data-sm-fit>Vừa khung</button><button type="button" data-sm-auto-layout>Tự sắp xếp</button><button type="button" data-sm-clear-selection>Bỏ chọn</button><span>Kéo state · Bấm Nối rồi chọn state đích</span></div><div class="hhsm-canvas" data-sm-canvas tabindex="0" aria-label="Node graph State Machine"><div class="hhsm-board" data-sm-board></div></div><div class="hhsm-simulator"><div class="hhsm-sim-status" data-sm-sim-status></div><div class="hhsm-events"><div class="hhsm-heading"><strong>Phát sự kiện mẫu</strong><span>DEMO DATA</span></div><div class="hhsm-event-grid">${EVENTS.map((event) => `<button type="button" data-sm-dispatch="${event}">${event}</button>`).join("")}</div></div><div class="hhsm-history" data-sm-history></div></div></section>
        <aside class="hhsm-panel"><section class="hhsm-section" data-sm-inspector></section><section class="hhsm-section"><div class="hhsm-heading"><strong>Hướng binding</strong><span>API</span></div><p style="color:var(--sm-muted);margin:0 0 8px">Source: dữ liệu → giao diện. Target: giao diện → dữ liệu. Bidirectional: đồng bộ hai chiều.</p><div class="hhsm-grid2"><button type="button" data-sm-sample-data>Nạp dữ liệu mẫu</button><button type="button" data-sm-copy-json>Copy JSON</button></div></section></aside></main><footer class="hhsm-status"><span>● Local-first · autosave</span><span>${project.transitions.length} transition · ${project.bindings.length} binding</span><span data-sm-save-status>Đã lưu</span></footer>`;
      renderStateList(); renderProperties(); renderBindings(); renderGraph(); renderInspector(); renderSimulator();
    }

    function commit(message) {
      project = normalizeProject(project);
      simulator = createSimulator(project, runtime.properties);
      runtime = simulator.getState();
      persist();
      render();
      if (message) toast(message);
    }

    function dispatch(eventName, payload) {
      const result = simulator.dispatch(eventName, { key: payload?.key || (eventName === "keyboard" ? "Enter" : ""), timestamp: Date.now(), triggered: true });
      runtime = result.runtime;
      renderSimulator();
      renderGraph();
      toast(result.matched ? `Đã chuyển sang ${runtime.stateId}.` : `Không có transition phù hợp cho ${eventName}.`);
      return result;
    }

    on(root, "click", async (event) => {
      const targetNode = event.target.closest("button,[data-sm-transition]");
      if (!targetNode) return;
      if (targetNode.dataset.smSelectState) { selectedStateId = targetNode.dataset.smSelectState; selectedTransitionId = ""; selectedBindingId = ""; renderStateList(); renderBindings(); renderGraph(); renderInspector(); return; }
      if (targetNode.dataset.smTransition) { selectedTransitionId = targetNode.dataset.smTransition; selectedStateId = ""; selectedBindingId = ""; renderBindings(); renderGraph(); renderInspector(); return; }
      if (targetNode.dataset.smSelectBinding) { selectedBindingId = targetNode.dataset.smSelectBinding; selectedTransitionId = ""; selectedStateId = ""; renderStateList(); renderBindings(); renderGraph(); renderInspector(); return; }
      if (targetNode.dataset.smConnect) {
        const id = targetNode.dataset.smConnect;
        if (!connectFrom) { connectFrom = id; toast("Chọn state đích để tạo transition."); renderGraph(); }
        else if (connectFrom !== id) { project.transitions.push({ id: uid("transition"), from: connectFrom, to: id, event: "click", priority: 10, delay: 0, key: "", conditions: [], actions: [] }); selectedTransitionId = project.transitions.at(-1).id; connectFrom = ""; commit("Đã tạo transition."); }
        return;
      }
      if (targetNode.dataset.smSetInitial) { project.initialStateId = targetNode.dataset.smSetInitial; commit("Đã đổi state khởi đầu."); return; }
      if (targetNode.dataset.smDispatch) { dispatch(targetNode.dataset.smDispatch); return; }
      if (targetNode.hasAttribute("data-sm-new-state")) { const id = sanitizeIdentifier(`state-${project.states.length + 1}`); project.states.push({ id, name: `State ${project.states.length + 1}`, x: 120 + project.states.length * 24, y: 120 + project.states.length * 18, color: "#67e8f9", description: "State mới" }); selectedStateId = id; selectedTransitionId = ""; commit("Đã thêm state."); return; }
      if (targetNode.hasAttribute("data-sm-add-property")) { project.properties.push({ id: uid("property"), name: `value${project.properties.length + 1}`, type: "string", value: "" }); commit("Đã thêm View Model property."); return; }
      if (targetNode.hasAttribute("data-sm-add-binding")) { project.bindings.push({ id: uid("binding"), property: project.properties[0].name, target: "text", selector: "[data-hh-label]", direction: "source", converter: "none" }); selectedBindingId = project.bindings.at(-1).id; selectedTransitionId = ""; selectedStateId = ""; commit("Đã thêm binding."); return; }
      if (targetNode.hasAttribute("data-sm-delete-binding")) { project.bindings = project.bindings.filter((item) => item.id !== selectedBindingId); selectedBindingId = ""; selectedStateId = project.initialStateId; commit("Đã xóa binding."); return; }
      if (targetNode.hasAttribute("data-sm-add-condition")) { const transition = selectedTransition(); if (transition) transition.conditions.push(defaultCondition(project.properties[0].name, project.properties[0].type, project.properties[0].value)); commit("Đã thêm điều kiện."); return; }
      if (targetNode.dataset.smRemoveCondition) { const transition = selectedTransition(); if (transition) transition.conditions = transition.conditions.filter((item) => item.id !== targetNode.dataset.smRemoveCondition); commit("Đã xóa điều kiện."); return; }
      if (targetNode.hasAttribute("data-sm-delete-transition")) { project.transitions = project.transitions.filter((item) => item.id !== selectedTransitionId); selectedTransitionId = project.transitions[0]?.id || ""; commit("Đã xóa transition."); return; }
      if (targetNode.hasAttribute("data-sm-delete-state")) { if (project.states.length <= 1) return toast("Cần giữ ít nhất một state."); const id = selectedState().id; project.states = project.states.filter((item) => item.id !== id); project.transitions = project.transitions.filter((item) => item.from !== id && item.to !== id); project.initialStateId = project.states[0].id; selectedStateId = project.states[0].id; selectedTransitionId = ""; commit("Đã xóa state."); return; }
      if (targetNode.hasAttribute("data-sm-test-transition")) { const transition = selectedTransition(); if (!transition) return; runtime.stateId = transition.from; simulator = createSimulator(project, runtime.properties); while (simulator.getState().stateId !== transition.from && simulator.getState().history.length < 1) break; const values = propertyMap(project, runtime.properties); const matched = transition.conditions.every((condition) => evaluateCondition(condition, values, { triggered: true })); toast(matched ? "Điều kiện đang hợp lệ." : "Điều kiện chưa thỏa mãn."); return; }
      if (targetNode.hasAttribute("data-sm-reset-sim")) { simulator = createSimulator(project); runtime = simulator.getState(); renderSimulator(); renderGraph(); return; }
      if (targetNode.hasAttribute("data-sm-sample-data")) { simulator = createSimulator(project, { enabled: true, hasError: false, progress: 72, label: "Dữ liệu mẫu" }); runtime = simulator.getState(); renderSimulator(); toast("Đã nạp dữ liệu mô phỏng."); return; }
      if (targetNode.hasAttribute("data-sm-auto-layout")) { project.states.forEach((state, index) => { state.x = 70 + (index % 3) * 270; state.y = 70 + Math.floor(index / 3) * 190; }); commit("Đã tự sắp xếp node."); return; }
      if (targetNode.hasAttribute("data-sm-fit")) { root.querySelector("[data-sm-canvas]")?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); return; }
      if (targetNode.hasAttribute("data-sm-clear-selection")) { selectedTransitionId = ""; selectedStateId = project.initialStateId; connectFrom = ""; renderGraph(); renderInspector(); return; }
      if (targetNode.hasAttribute("data-sm-import")) { root.querySelector("[data-sm-file]")?.click(); return; }
      if (targetNode.hasAttribute("data-sm-export-project")) { downloadText(doc, `${sanitizeIdentifier(project.meta.name, "state-machine")}.json`, exportProject(project), "application/json"); return; }
      if (targetNode.hasAttribute("data-sm-download-component")) { downloadText(doc, `${sanitizeIdentifier(project.meta.name, "hh-component")}.html`, exportWebComponent(project), "text/html"); return; }
      if (targetNode.hasAttribute("data-sm-copy-component")) { await globalScope.navigator?.clipboard?.writeText(exportWebComponent(project)); toast("Đã sao chép Web Component."); return; }
      if (targetNode.hasAttribute("data-sm-copy-json")) { await globalScope.navigator?.clipboard?.writeText(exportProject(project)); toast("Đã sao chép project JSON."); }
    });

    on(root, "change", (event) => {
      const targetNode = event.target;
      const transition = selectedTransition();
      if (targetNode.dataset.smPropertyValue) { const property = project.properties.find((item) => item.id === targetNode.dataset.smPropertyValue); if (property) { property.value = typedValue(property.type, targetNode.value); commit(); } return; }
      if (targetNode.hasAttribute("data-sm-transition-event") && transition) { transition.event = targetNode.value; commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-priority") && transition) { transition.priority = clamp(targetNode.value, -100, 100); commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-delay") && transition) { transition.delay = clamp(targetNode.value, 0, 600000); commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-cooldown") && transition) { transition.cooldown = clamp(targetNode.value, 0, 600000); commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-once") && transition) { transition.once = targetNode.checked; commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-prevent") && transition) { transition.preventDefault = targetNode.checked; commit(); return; }
      if (targetNode.hasAttribute("data-sm-transition-key") && transition) { transition.key = sanitizeText(targetNode.value, 32); commit(); return; }
      const conditionNode = targetNode.closest("[data-sm-condition]");
      const condition = transition?.conditions.find((item) => item.id === conditionNode?.dataset.smCondition);
      if (condition && targetNode.hasAttribute("data-sm-condition-property")) { const property = project.properties.find((item) => item.name === targetNode.value); condition.property = property.name; condition.type = property.type; condition.operator = OPERATORS[property.type][0]; condition.value = property.value; commit(); return; }
      if (condition && targetNode.hasAttribute("data-sm-condition-operator")) { condition.operator = targetNode.value; commit(); return; }
      if (condition && targetNode.hasAttribute("data-sm-condition-value")) { condition.value = typedValue(condition.type, targetNode.value); commit(); return; }
      const binding = selectedBinding();
      if (binding && targetNode.hasAttribute("data-sm-binding-property")) { binding.property = targetNode.value; commit(); return; }
      if (binding && targetNode.hasAttribute("data-sm-binding-target")) { binding.target = targetNode.value; commit(); return; }
      if (binding && targetNode.hasAttribute("data-sm-binding-direction")) { binding.direction = targetNode.value; commit(); return; }
      if (binding && targetNode.hasAttribute("data-sm-binding-selector")) { binding.selector = sanitizeText(targetNode.value, 120); commit(); return; }
      if (binding && targetNode.hasAttribute("data-sm-binding-converter")) { binding.converter = targetNode.value; commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-name")) { selectedState().name = sanitizeText(targetNode.value, 48); commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-description")) { selectedState().description = sanitizeText(targetNode.value, 160); commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-role")) { selectedState().role = STATE_ROLES.includes(targetNode.value) ? targetNode.value : "interactive"; commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-live")) { selectedState().ariaLive = ["off", "polite", "assertive"].includes(targetNode.value) ? targetNode.value : "off"; commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-terminal")) { selectedState().terminal = targetNode.checked; commit(); return; }
      if (targetNode.hasAttribute("data-sm-state-color")) { selectedState().color = targetNode.value; commit(); }
    });

    on(root, "pointerdown", (event) => {
      const node = event.target.closest("[data-sm-node]");
      if (!node || event.target.closest("button")) return;
      const state = project.states.find((item) => item.id === node.dataset.smNode);
      if (!state) return;
      drag = { state, node, startX: event.clientX, startY: event.clientY, x: state.x, y: state.y };
      node.setPointerCapture?.(event.pointerId);
      selectedStateId = state.id;
      selectedTransitionId = "";
    });
    on(root, "pointermove", (event) => {
      if (!drag) return;
      drag.state.x = clamp(drag.x + event.clientX - drag.startX, 0, 1800);
      drag.state.y = clamp(drag.y + event.clientY - drag.startY, 0, 1000);
      drag.node.style.left = `${drag.state.x}px`;
      drag.node.style.top = `${drag.state.y}px`;
      root.querySelectorAll(".hhsm-link,.hhsm-link-hit").forEach((path, index) => path.setAttribute("d", transitionPath(project.transitions[Math.floor(index / 2)])));
    });
    on(root, "pointerup", () => { if (drag) { drag = null; persist(); renderStateList(); renderInspector(); } });
    on(root, "keydown", (event) => {
      if (event.key === "Escape") { connectFrom = ""; renderGraph(); }
      if (EVENTS.includes(event.key)) dispatch(event.key);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persist(); toast("Đã lưu project."); }
    });
    on(root, "change", (event) => {
      if (!event.target.hasAttribute("data-sm-file")) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { project = normalizeProject(JSON.parse(String(reader.result || ""))); selectedStateId = project.initialStateId; selectedTransitionId = project.transitions[0]?.id || ""; simulator = createSimulator(project); runtime = simulator.getState(); persist(); render(); toast("Đã nhập project."); }
        catch (_) { toast("Project JSON không hợp lệ."); }
      };
      reader.readAsText(file);
      event.target.value = "";
    });

    render();
    const api = {
      getProject: () => clone(project),
      setProject(next) { project = normalizeProject(next); simulator = createSimulator(project); runtime = simulator.getState(); persist(); render(); },
      dispatch,
      getRuntime: () => clone(runtime),
      exportProject: () => exportProject(project),
      exportWebComponent: () => exportWebComponent(project)
    };
    mounted.set(root, { api, cleanup: () => { clearTimeout(saveTimer); clearTimeout(toastTimer); listeners.splice(0).forEach((off) => off()); } });
    return api;
  }

  function unmount(target) {
    const root = typeof target === "string" ? globalScope.document?.querySelector(target) : target;
    const instance = root && mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    root.classList.remove("hhsm");
    root.removeAttribute("data-graphic-state-machine");
    root.innerHTML = "";
    return true;
  }

  const api = {
    VERSION, FORMAT, STORAGE_KEY, STATE_PRESETS, EVENTS, PROPERTY_TYPES, BINDING_TARGETS, BINDING_DIRECTIONS, OPERATORS, CONVERTERS, STATE_ROLES,
    sanitizeText, sanitizeIdentifier, typedValue, createDefaultProject, normalizeProject, evaluateCondition, selectTransition, applyTransition,
    getStateSemantics, validateProject, selectRuntimeTransition, createSimulator, getCapabilities,
    exportProject, exportWebComponent, mount, unmount
  };
  globalScope.HHGraphicStateMachine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
