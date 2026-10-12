(function initToolManifests(globalScope) {
  "use strict";

  const manifest = (id, name, group, runtime, options = {}) => Object.freeze({
    id,
    name,
    group,
    runtime,
    description: options.description || "",
    permissions: Object.freeze([...(options.permissions || [])]),
    capabilities: Object.freeze([...(options.capabilities || [])]),
    actions: Object.freeze([...(options.actions || ["run", "cancel", "copy", "export"])]),
    inputs: Object.freeze([...(options.inputs || [])]),
    history: options.history !== false,
    offline: options.offline !== false,
    version: options.version || 1,
    endpoint: options.endpoint || (runtime === "browser" ? null : `/api/${runtime === "server" ? "tools/run" : runtime === "integration" ? "integrations" : runtime}`),
    tags: Object.freeze([runtime, ...(options.tags || [])])
  });

  const textInput = (required = true) => [{ id: "text", type: "string", required, maxLength: 100000 }];
  const fileInput = (accept) => [{ id: "file", type: "file", required: true, accept, maxBytes: 25 * 1024 * 1024 }];

  const TOOL_MANIFESTS = Object.freeze([
    manifest("global-search", "Global Search", "platform", "browser", { capabilities: ["indexedDB"], inputs: [{ id: "query", type: "string", required: true, minLength: 2, maxLength: 200 }], tags: ["search", "command"] }),
    manifest("command-palette", "Command Palette++", "platform", "browser", { actions: ["open", "execute", "cancel"], inputs: [{ id: "command", type: "string", required: true, maxLength: 200 }] }),
    manifest("dark-light-auto", "Dark Light Auto Mode", "platform", "browser", { actions: ["apply", "schedule", "reset"], inputs: [{ id: "mode", type: "enum", values: ["system", "light", "dark", "schedule"], required: true }] }),
    manifest("theme-switcher", "Theme Color Switcher", "platform", "browser", { actions: ["preview", "apply", "undo", "reset"], inputs: [{ id: "accent", type: "color", required: true }] }),
    manifest("realtime-notifications", "Realtime Notification", "platform", "integration", { permissions: ["notifications"], capabilities: ["notifications"], offline: false, inputs: [{ id: "priority", type: "enum", values: ["all", "priority", "mentions"], required: true }] }),
    manifest("loading-skeleton", "Loading Skeleton", "platform", "browser", { actions: ["preview", "measure", "reset"], inputs: [{ id: "route", type: "string", required: true, maxLength: 160 }] }),
    manifest("page-progress", "Page Progress Bar", "platform", "browser", { actions: ["start", "update", "complete", "reset"], inputs: [{ id: "progress", type: "number", min: 0, max: 100 }] }),
    manifest("fps-monitor", "FPS Monitor", "platform", "browser", { actions: ["start", "pause", "reset", "export"], capabilities: ["animationFrame"], inputs: [], tags: ["performance", "vitals"] }),
    manifest("history-manager", "History Manager", "platform", "browser", { capabilities: ["indexedDB"], actions: ["search", "restore", "remove", "export"] }),
    manifest("favorite-manager", "Favorite Manager", "platform", "browser", { capabilities: ["indexedDB"], actions: ["add", "move", "tag", "remove", "export"] }),
    manifest("export-data", "Export Data", "platform", "browser", { capabilities: ["download"], actions: ["preview", "export", "cancel"], inputs: [{ id: "format", type: "enum", values: ["json", "csv", "zip"], required: true }] }),
    manifest("import-data", "Import Data", "platform", "browser", { capabilities: ["fileReader"], actions: ["validate", "preview", "import", "cancel"], inputs: fileInput(".json,.csv,.zip") }),
    manifest("pwa", "PWA", "platform", "browser", { capabilities: ["serviceWorker"], actions: ["inspect", "update", "clear-cache"] }),
    manifest("offline-mode", "Offline Mode", "platform", "browser", { capabilities: ["serviceWorker", "indexedDB"], actions: ["inspect", "sync", "resolve-conflict", "cancel"] }),
    manifest("install-app", "Install App", "platform", "browser", { capabilities: ["pwaInstall"], actions: ["inspect", "install", "cancel"] }),
    manifest("keyboard-shortcuts", "Keyboard Shortcut System", "platform", "browser", { actions: ["assign", "validate", "reset", "export", "import"] }),
    manifest("settings-center", "Settings Center", "platform", "browser", { capabilities: ["indexedDB"], actions: ["search", "save", "sync", "reset"] }),

    manifest("voice-search", "Voice Search", "voice-ai", "browser", { permissions: ["microphone"], capabilities: ["speechRecognition"], actions: ["start", "stop", "confirm", "cancel"], offline: false }),
    manifest("speech-to-text", "Speech To Text", "voice-ai", "ai", { permissions: ["microphone"], capabilities: ["mediaRecorder"], actions: ["record", "transcribe", "cancel", "export"], inputs: fileInput("audio/*,video/*"), offline: false }),
    manifest("text-to-speech", "Text To Speech", "voice-ai", "browser", { capabilities: ["speechSynthesis"], actions: ["preview", "speak", "stop", "export"], inputs: textInput(true) }),
    manifest("ai-chat", "AI Chat Assistant", "voice-ai", "ai", { actions: ["send", "stop", "retry", "export"], inputs: [{ id: "prompt", type: "string", required: true, maxLength: 16000 }], offline: false }),
    manifest("prompt-library", "AI Prompt Library", "voice-ai", "browser", { capabilities: ["indexedDB"], actions: ["create", "version", "share", "remove", "export"] }),
    manifest("prompt-optimizer", "AI Prompt Optimizer", "voice-ai", "ai", { actions: ["optimize", "compare", "cancel", "export"], inputs: textInput(true), offline: false }),
    manifest("image-prompt-generator", "AI Image Prompt Generator", "voice-ai", "ai", { actions: ["generate", "variation", "cancel", "export"], inputs: textInput(true), offline: false }),

    manifest("workspace-tabs", "Workspace Tabs", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["open", "pin", "close", "restore"] }),
    manifest("drag-drop-dashboard", "Drag Drop Dashboard", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["move", "resize", "undo", "redo", "save"] }),
    manifest("widget-marketplace", "Widget Marketplace", "workspace-files", "browser", { actions: ["list", "install", "disable", "remove"], offline: true, description: "Widget cục bộ được duyệt: ghi chú, checklist, bộ đếm và đồng hồ." }),
    manifest("plugin-system", "Plugin System", "workspace-files", "browser", { actions: ["inspect", "install", "enable", "disable", "remove"], offline: true, tags: ["reviewed-local-engines"], description: "Engine văn bản được duyệt, không thực thi JavaScript từ manifest." }),
    manifest("auto-save", "Auto Save", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["save", "retry", "restore", "cancel"] }),
    manifest("version-history", "Version History", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["compare", "label", "restore", "branch", "export"] }),
    manifest("file-explorer", "File Explorer", "workspace-files", "browser", { capabilities: ["indexedDB", "opfs"], actions: ["open", "upload", "rename", "search", "remove", "export"] }),
    manifest("monaco-editor", "Monaco Code Editor", "workspace-files", "browser", { capabilities: ["worker"], actions: ["open", "format", "diagnose", "compare", "save"] }),
    manifest("ocr", "OCR", "workspace-files", "browser", { capabilities: ["fileReader", "worker"], actions: ["recognize", "cancel", "copy", "export"], inputs: fileInput("image/png,image/jpeg,image/webp"), offline: false, description: "Nhận dạng ảnh Việt/Anh cục bộ, tải engine và dữ liệu ngôn ngữ khi dùng." }),
    ...Object.entries({
      developer: ["Markdown Editor", "JSON Viewer", "API Tester", "Regex Playground", "Code Viewer", "Terminal Simulator", "Git Cheat Sheet", "GitHub Integration", "Console Log Viewer", "Error Monitor", "Dev Utilities", "Text Compare", "JSON Formatter", "UUID Generator", "Hash Generator", "Base64 Encoder", "Timestamp Converter"],
      productivity: ["Productivity Dashboard", "Notes", "Todo", "Kanban", "Pomodoro", "Stopwatch", "Countdown", "Calendar", "Reminder", "Calculator", "Unit Converter", "Lorem Ipsum", "Password Toolkit", "Clipboard Manager", "Clipboard History", "Activity Timeline", "Recent Files", "Pinned Tools", "Bookmark", "Floating Quick Actions", "Focus Mode", "User Preferences Center"],
      system: ["Multi-language", "Language Switcher", "Weather Widget", "Clock", "System Status", "Network Speed", "Memory Usage", "Storage Usage", "Analytics Dashboard", "Notification Center", "Smart Search", "Context Menu", "Floating Toolbar", "QR Scanner"]
    }).flatMap(([group, names]) => names.map(name => manifest(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, group, "browser", {
      actions: ["run", "copy", "export"],
      offline: !["API Tester", "GitHub Integration", "Weather Widget"].includes(name),
      history: !["Password Toolkit", "Clipboard Manager", "Clipboard History"].includes(name)
    })))
  ]);

  const api = Object.freeze({ TOOL_MANIFESTS, manifest });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHToolManifests = api;
})(typeof window !== "undefined" ? window : globalThis);
