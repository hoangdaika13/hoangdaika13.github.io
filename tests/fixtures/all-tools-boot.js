"use strict";
function render() {
  window.qaTool = HHFeatureLab.mount(document.getElementById("host"), { toolId: location.hash.replace(/^#\/tools\/?/, "") || "global-search", onNavigate: id => { location.hash = "#/tools/" + id; } });
}
addEventListener("hashchange", render);
render();
