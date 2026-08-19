"use strict";

importScripts("./draw-studio.js?v=8");

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type !== "render-layers" || !self.HHDrawStudio) return;
  try {
    const project = self.HHDrawStudio.normalizeProject(message.project || {});
    const rendered = [];
    const transfer = [];
    for (const layer of project.layers) {
      if (!layer.visible) continue;
      const canvas = self.HHDrawStudio.renderLayerBitmap(layer, project.settings, message.pixelWidth, message.pixelHeight, message.ratio, message.quality);
      if (!canvas?.transferToImageBitmap) continue;
      const bitmap = canvas.transferToImageBitmap();
      rendered.push({ id: layer.id, revision: layer.revision, bitmap });
      transfer.push(bitmap);
    }
    self.postMessage({ type: "render-layers-complete", requestId: message.requestId, layers: rendered }, transfer);
  } catch (error) {
    self.postMessage({ type: "render-layers-error", requestId: message.requestId, message: String(error?.message || error) });
  }
};
