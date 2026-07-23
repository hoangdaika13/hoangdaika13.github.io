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
    manifest("widget-marketplace", "Widget Marketplace", "workspace-files", "server", { actions: ["list", "install", "disable", "remove", "rate"], offline: false }),
    manifest("plugin-system", "Plugin System", "workspace-files", "server", { actions: ["inspect", "install", "enable", "disable", "remove"], offline: false, tags: ["sandbox"] }),
    manifest("auto-save", "Auto Save", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["save", "retry", "restore", "cancel"] }),
    manifest("version-history", "Version History", "workspace-files", "browser", { capabilities: ["indexedDB"], actions: ["compare", "label", "restore", "branch", "export"] }),
    manifest("file-explorer", "File Explorer", "workspace-files", "browser", { capabilities: ["indexedDB", "opfs"], actions: ["open", "upload", "rename", "search", "remove", "export"] }),
    manifest("monaco-editor", "Monaco Code Editor", "workspace-files", "browser", { capabilities: ["worker"], actions: ["open", "format", "diagnose", "compare", "save"] }),
    manifest("ocr", "OCR", "workspace-files", "ai", { capabilities: ["fileReader"], actions: ["recognize", "cancel", "copy", "export"], inputs: fileInput("image/*,application/pdf"), offline: false })
  ]);

  const api = Object.freeze({ TOOL_MANIFESTS, manifest });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHToolManifests = api;
})(typeof window !== "undefined" ? window : globalThis);
