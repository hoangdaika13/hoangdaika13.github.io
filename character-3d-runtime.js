(async function bootstrapHHCharacter3DRuntime(global) {
  "use strict";

  if (global.HHCharacter3DRuntimeReady) return;
  const base = new URL("./", document.baseURI);
  const [THREE, loaderModule, dracoModule, ktxModule, meshoptModule] = await Promise.all([
    import(new URL("vendor/three.module.min.js", base)),
    import(new URL("vendor/addons/loaders/GLTFLoader.js", base)),
    import(new URL("vendor/addons/loaders/DRACOLoader.js", base)),
    import(new URL("vendor/addons/loaders/KTX2Loader.js", base)),
    import(new URL("vendor/addons/libs/meshopt_decoder.module.js", base))
  ]);

  const runtime = Object.freeze({
    THREE,
    GLTFLoader: loaderModule.GLTFLoader,
    DRACOLoader: dracoModule.DRACOLoader,
    KTX2Loader: ktxModule.KTX2Loader,
    MeshoptDecoder: meshoptModule.MeshoptDecoder
  });
  global.HHCharacter3DRuntime = runtime;
  global.HHCharacter3DRuntimeReady = true;
  global.dispatchEvent(new CustomEvent("hh:character-3d-runtime-ready", { detail: { revision: THREE.REVISION } }));
})(window).catch((error) => {
  window.HHCharacter3DRuntimeError = error;
  window.dispatchEvent(new CustomEvent("hh:character-3d-runtime-error", { detail: { message: String(error?.message || error) } }));
});
