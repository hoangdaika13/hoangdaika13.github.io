(function bootstrapEonWildLandscapeWorker(scope) {
  "use strict";

  const CORE_URL = "./hh-eonwild-landscape-core.js?v=1";
  const MAX_TRANSFER_BYTES = 32 * 1024 * 1024;
  const MAX_ERROR_LENGTH = 240;
  let cachedCore = null;
  let cachedCoreKey = "";

  function compactError(error) {
    return {
      name: String(error?.name || "Error").slice(0, 64),
      message: String(error?.message || error || "Landscape worker failed").slice(0, MAX_ERROR_LENGTH)
    };
  }

  function ensureCore() {
    if (scope.HHEonWildLandscapeCore) return scope.HHEonWildLandscapeCore;
    if (typeof scope.importScripts !== "function") throw new Error("importScripts is unavailable");
    scope.importScripts(CORE_URL);
    if (!scope.HHEonWildLandscapeCore) throw new Error("Landscape core did not initialize");
    return scope.HHEonWildLandscapeCore;
  }

  function transferList(value, output = [], seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return output;
    seen.add(value);
    if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) {
      if (!output.includes(value.buffer)) output.push(value.buffer);
      return output;
    }
    if (value instanceof ArrayBuffer) {
      if (!output.includes(value)) output.push(value);
      return output;
    }
    if (Array.isArray(value)) {
      for (const item of value) transferList(item, output, seen);
      return output;
    }
    for (const item of Object.values(value)) transferList(item, output, seen);
    return output;
  }

  function byteLengthOf(buffers) {
    return buffers.reduce((sum, buffer) => sum + Number(buffer?.byteLength || 0), 0);
  }

  function execute(coreApi, validation, fallbackJob) {
    const job = validation?.job || fallbackJob;
    if (typeof coreApi.createLandscapeCore !== "function" || !job?.address || !job?.config) return coreApi.executeWorkerJob(job);
    const key = JSON.stringify({ address: job.address, config: job.config });
    if (!cachedCore || key !== cachedCoreKey) {
      try { cachedCore?.dispose?.(); } catch { /* Replacing immutable world state is best effort. */ }
      cachedCore = coreApi.createLandscapeCore({ address: job.address, config: job.config });
      cachedCoreKey = key;
    }
    return cachedCore.executeWorkerJob(job);
  }

  scope.addEventListener("message", (event) => {
    const envelope = event?.data && typeof event.data === "object" ? event.data : {};
    const requestId = String(envelope.id || "").slice(0, 96);
    if (!requestId) return;
    try {
      const core = ensureCore();
      if (typeof core.validateWorkerJob !== "function" || typeof core.executeWorkerJob !== "function") {
        throw new Error("Landscape worker contract is incomplete");
      }
      const validation = core.validateWorkerJob(envelope.job);
      if (validation === false || validation?.ok === false || validation?.valid === false) {
        throw new Error(validation?.error || validation?.errors?.join?.("; ") || "Invalid landscape worker job");
      }
      const result = execute(core, validation, envelope.job);
      const transfers = transferList(result);
      if (byteLengthOf(transfers) > MAX_TRANSFER_BYTES) throw new Error("Landscape worker result exceeded its transfer budget");
      scope.postMessage({ id: requestId, ok: true, result }, transfers);
    } catch (error) {
      scope.postMessage({ id: requestId, ok: false, error: compactError(error) });
    }
  });
})(typeof self !== "undefined" ? self : globalThis);
