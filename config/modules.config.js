(function () {
  window.HH_PLATFORM_MODULES = window.HH_PLATFORM_MODULES || [];

  fetch("data/ai-super-platform-modules.json")
    .then((response) => {
      if (!response.ok) throw new Error("Module registry not found");
      return response.json();
    })
    .then((modules) => {
      window.HH_PLATFORM_MODULES = (Array.isArray(modules) ? modules : []).map((module, index) => ({
        ...module,
        order: index + 1,
        originalGroup: module.group,
        group: index < 25 ? "core" : "extension"
      }));
      window.dispatchEvent(new CustomEvent("hh:modules-ready", { detail: window.HH_PLATFORM_MODULES }));
    })
    .catch(() => {
      window.dispatchEvent(new CustomEvent("hh:modules-ready", { detail: [] }));
    });
})();
