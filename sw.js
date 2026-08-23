const CACHE = "hh-identity-portal-v847";
// Compatibility marker retained for Dharma v6 clients: hh-identity-portal-v842.
// Shell compatibility assertions for modules released against the stable cache:
// hh-identity-portal-v822 ./performance-loader.js?v=474 ./script.js?v=232 ./script.js?v=241 ./app-shell.css?v=64
// Compatibility URLs retained for clients upgrading from the first HH Chinese release: ./hh-chinese.css?v=1 ./hh-chinese.js?v=1 ./hh-chinese.css?v=11 ./hh-chinese.js?v=11 ./japanese-os-v4.css?v=2 ./japanese-os-v4.js?v=7 ./japanese-os-v4.js?v=8
// Social Media loader compatibility: social-media-tools-v2.js?v=13 remains an
// upgrade marker for older tabs; v14 below is the canonical current asset.
// Compatibility from the previous worker: hh-identity-portal-v625 hh-identity-portal-v626 hh-identity-portal-v627 hh-identity-portal-v628 hh-identity-portal-v629 hh-identity-portal-v630 hh-identity-portal-v631 hh-identity-portal-v632 hh-identity-portal-v633.
// Compatibility aliases are kept as documentation for clients upgrading from the
// previous route loader. They are not fetched; RUNTIME_ASSETS below is canonical.
// Image Text Studio compatibility: ./image-text-studio.css?v=11 ./image-text-studio.js?v=11
// Compatibility from v370 and v395-v408: hh-identity-portal-v370 script.js?v=159 script.js?v=160 performance-loader.js?v=139 performance-loader.js?v=140 hh-identity-portal-v395 hh-identity-portal-v396 hh-identity-portal-v397 hh-identity-portal-v403 hh-identity-portal-v404 hh-identity-portal-v405 hh-identity-portal-v406 hh-identity-portal-v407 hh-identity-portal-v408
// script.js?v=141 script.js?v=145 performance-loader.js?v=51 performance-loader.js?v=52 performance-loader.js?v=57 performance-loader.js?v=58
// AI Video Remake upgrade compatibility: script.js?v=172 performance-loader.js?v=249 performance-loader.js?v=250 performance-loader.js?v=251 hh-identity-portal-v517 hh-identity-portal-v518 hh-identity-portal-v519 ai-video-remake-studio.css?v=1 ai-video-remake-studio.css?v=2 ai-video-remake-studio.js?v=1
// Graphic Design Universal compatibility aliases: graphic-design-universal.css?v=1 graphic-design-universal.js?v=1
// Open Media upgrade compatibility: hh-identity-portal-v527 hh-identity-portal-v543 ./performance-loader.js?v=259 ./script.js?v=176 ./script.js?v=172 ./auth-neon-gateway.js?v=14 ./auth-h-galaxy.js?v=5 ./home-galaxy-command.js?v=8 ./open-music-hub.css?v=4 ./open-music-hub.js?v=3
// YouTube Batch compatibility: ./script.js?v=179 ./performance-loader.js?v=272 ./youtube-creator-galaxy.css?v=20 ./youtube-creator-galaxy.js?v=24 ./home-galaxy-command.css?v=9
// communication-suite.css?v=1 communication-suite.js?v=1 communication-command-center.css?v=1 communication-command-center.js?v=1 communication-messenger-next.css?v=1 communication-messenger-next.js?v=1 communication-channels-forum.css?v=1 communication-channels-forum.js?v=1 communication-live-room.css?v=1 communication-live-room.js?v=1 communication-canvas-automation.css?v=1 communication-canvas-automation.js?v=1 communication-intelligence.css?v=1 communication-intelligence.js?v=1
// HH School v1 replaces the former Learning OS bundle; legacy caches are removed during activation.
// HH English compatibility: english-learning.js?v=22 english-learning.js?v=24 english-learning.js?v=28 english-learning-os.js?v=7 english-learning-os.css?v=3 english-vocabulary.css?v=1 english-vocabulary.js?v=2; current language cockpit loads the versioned Learning OS bundle below.
const RUNTIME_ASSETS = [
  "./",
  "./index.html",
  "./app-shell.css?v=65",
  "./workspace-feature-explorer.css?v=2",
  "./app-theme-system.css?v=9",
  "./dashboard-aurora.css?v=4",
  "./home-galaxy-command.css?v=13",
  "./home-capability-atlas.css?v=1",
  "./home-live-widgets.css?v=12",
  "./home-cosmic-os.css?v=3",
  "./home-galaxy-mission.css?v=9",
  "./home-galaxy-operations.css?v=3",
  "./home-galaxy-control-deck.css?v=3",
  "./command-center-pro.css?v=4",
  "./home-daily-command.css?v=4",
  "./home-command-search.css?v=2",
  "./home-widget-project-pulse.css?v=2",
  "./home-health-focus.css?v=2",
  "./professional-tools.css?v=3",
  "./dev-pro-suite.css?v=3",
  "./dev-delivery-workflow.css?v=2",
  "./dev-smart-recipe.css?v=1",
  "./dev-api-studio.css?v=1",
  "./dev-data-security.css?v=1",
  "./dev-regex-database.css?v=1",
  "./dev-code-git.css?v=1",
  "./dev-diagnostics-ai.css?v=1",
  "./feature-lab.css?v=5",
  "./platform-tools.css?v=1",
  "./tool-workspace-pro.css?v=1",
  "./utility-lab-tools.css?v=9",
  "./media-design-pro.css?v=1",
  "./media-design-page.css?v=22",
  "./media-cosmos.css?v=3",
  "./media-audio-studio.css?v=6",
  "./media-tool-experience.css?v=2",
  "./media-project-photo-studio.css?v=5",
  "./media-production-universe.css?v=5",
  "./media-professional-suite.css?v=1",
  "./media-next-suite.css?v=1",
  "./media-production-workflow.css?v=3",
  "./universal-media-project.css?v=3",
  "./media-design-advanced.css?v=3",
  "./media-design-publish.css?v=1",
  "./video-editor-studio.css?v=4",
  "./video-batch-factory.css?v=4",
  "./comic-motion-studio.css?v=7",
  "./comic-reader-hub.css?v=14",
  "./cinema-hub.css?v=5",
  "./open-music-hub.css?v=5",
  "./open-media-governance.css?v=1",
  "./video-editor-resolve.css?v=10",
  "./davinci-resolve-hub.css?v=4",
  "./h-cosmic-web-studio.css?v=2",
  "./video-editor-auto.css?v=1",
  "./youtube-creator-galaxy.css?v=22",
  "./image-text-studio.css?v=12",
  "./facebook-page-command-center.css?v=4",
  "./tiktok-creator-galaxy.css?v=2",
  "./ai-video-remake-studio.css?v=3",
  "./photo-editor-pro.css?v=4",
  "./editor-workflow-pro.css?v=2",
  "./support-platform.css?v=14",
  "./fortune-hub.css?v=3",
  "./fortune-hub-v3.css?v=2",
  "./fortune-hub-v4.css?v=8",
  "./fortune-hub-v5.css?v=26",
  "./draw-studio.css?v=8",
  "./remote-hub.css?v=4",
  "./chat-ai-hub.css?v=17",
  "./account-center.css?v=2",
  "./account-center.js?v=2",
  "./settings-studio.css?v=7",
  "./settings-studio.js?v=8",
  "./vendor/pdf-lib.min.js?v=1.17.1",
  "./script.js?v=243",
  "./graphic-design-studio.css?v=9",
  "./graphic-design-universal.css?v=4",
  "./graphic-design-animation.js?v=1",
  "./graphic-design-3d.js?v=4",
  "./graphic-design-prototype.js?v=1",
  "./graphic-design-motion.js?v=1",
  "./graphic-design-quick-motion.js?v=1",
  "./graphic-design-mockup.js?v=1",
  "./graphic-design-character.js?v=1",
  "./graphic-design-vector-core.js?v=2",
  "./graphic-design-state-machine.js?v=2",
  "./graphic-design-adaptive.js?v=2",
  "./graphic-design-project-store.js?v=2",
  "./graphic-design-collaboration.js?v=2",
  "./graphic-design-dev-ai.js?v=2",
  "./graphic-design-composer.js?v=2",
  "./graphic-design-nondestructive.js?v=1",
  "./graphic-design-typography-pro.js?v=1",
  "./graphic-design-node-effects.js?v=1",
  "./graphic-design-character-pro.js?v=1",
  "./graphic-design-simulation.js?v=1",
  "./graphic-design-data-driven.js?v=1",
  "./graphic-design-components.js?v=2",
  "./graphic-design-color-pro.js?v=1",
  "./graphic-design-export-center.js?v=2",
  "./graphic-design-plugins.js?v=1",
  "./graphic-design-review.js?v=2",
  "./graphic-design-performance.js?v=1",
  "./graphic-design-workflow.js?v=2",
  "./graphic-design-universal.js?v=5",
  "./graphic-design-studio.js?v=8",
  "./vendor/three.module.min.js",
  "./vendor/three.core.min.js",
  "./social-media-tools-v2.css?v=9",
  "./social-media-preview-runtime.css?v=6",
  "./social-media-tools-core.js?v=7",
  "./social-media-tools-workspaces.js?v=8",
  "./social-media-communication-engines.js?v=1",
  "./social-media-tool-contracts.js?v=7",
  "./social-media-local-engines.js?v=6",
  "./social-media-pipeline.js?v=6",
  "./social-media-tool-capabilities.js?v=7",
  "./social-media-preview-runtime.js?v=1",
  "./social-media-interactions.js?v=1",
  "./social-media-tools-v2.js?v=15",
  "./music-ai-studio.css?v=6",
  "./music-autopilot.css?v=2",
  "./music-ai-apps.css?v=2",
  "./youtube-publisher.css?v=4",
  "./youtube-publisher.js?v=9",
  "./music-autopilot-core.js?v=2",
  "./music-autopilot.js?v=2",
  "./youtube-creator-galaxy.js?v=27",
  "./image-text-studio.js?v=12",
  "./facebook-page-command-center.js?v=4",
  "./services/tiktokCreatorCore.js?v=2",
  "./services/tiktokCreatorConnections.js?v=2",
  "./services/tiktokCreatorPublishing.js?v=2",
  "./services/tiktokCreatorAnalytics.js?v=2",
  "./tiktok-creator-galaxy.js?v=2",
  "./ai-video-remake-studio.js?v=2",
  "./services/comicLibraryBridge.js?v=1",
  "./comic-motion-studio.js?v=11",
  "./comic-open-source-catalog.js?v=2",
  "./comic-reader-hub.js?v=20",
  "./utils/open-media-rights.js?v=4",
  "./cinema-hub.js?v=6",
  "./open-music-hub.js?v=4",
  "./open-media-governance.js?v=2",
  "./assets/open-media/curated-films-v1.json",
  "./assets/open-media/curated-music-v1.json",
  "./assets/open-media/curated-films-expansion-v1.json",
  "./assets/open-media/curated-music-expansion-v1.json",
  "./assets/open-media/rights-registry-v2.json",
  "./vendor/jszip.min.js?v=3.10.1",
  "./vendor/tesseract.min.js?v=6.0.1",
  "./vendor/tesseract-worker.min.js?v=6.0.1",
  "./vendor/tesseract-core-simd-lstm.wasm.js?v=6.0.0",
  "./vendor/tessdata/vie.traineddata.gz",
  "./vendor/tessdata/eng.traineddata.gz",
  "./vendor/tessdata/jpn.traineddata.gz",
  "./vendor/tessdata/chi_sim.traineddata.gz",
  "./vendor/pdf.min.mjs?v=4.10.38",
  "./vendor/pdf.worker.min.mjs?v=4.10.38",
  "./music-production-suite.css?v=5",
  "./music-daw-workspace.css?v=1",
  "./music-composer-lyrics.css?v=1",
  "./music-audio-labs.css?v=1",
  "./music-mix-master.css?v=1",
  "./music-visual-studio.css?v=1",
  "./music-publishing-rights.css?v=1",
  "./music-intelligence-engine.css?v=1",
  "./music-generative-arrangement.css?v=1",
  "./music-adaptive-library.css?v=1",
  "./music-mix-performance.css?v=1",
  "./music-project-governance.css?v=1",
  "./music-daw-workspace.js?v=1",
  "./music-composer-lyrics.js?v=1",
  "./music-audio-labs.js?v=1",
  "./music-mix-master.js?v=1",
  "./music-visual-studio.js?v=2",
  "./music-publishing-rights.js?v=1",
  "./music-intelligence-engine.js?v=1",
  "./music-generative-arrangement.js?v=1",
  "./music-adaptive-library.js?v=1",
  "./music-mix-performance.js?v=1",
  "./music-project-governance.js?v=1",
  "./music-production-suite.js?v=7",
  "./music-ai-apps.js?v=3",
  "./music-ai-studio.js?v=9",
  "./dashboard-aurora.js?v=5",
  "./home-galaxy-command.js?v=15",
  "./home-capability-atlas.js?v=3",
  "./home-live-widgets.js?v=8",
  "./home-cosmic-os.js?v=13",
  "./home-galaxy-mission.js?v=12",
  "./home-galaxy-operations.js?v=7",
  "./home-galaxy-control-deck.js?v=3",
  "./command-center-pro.js?v=6",
  "./home-daily-command.js?v=6",
  "./home-command-search.js?v=4",
  "./home-widget-project-pulse.js?v=2",
  "./home-health-focus.js?v=2",
  "./extension-suite.css?v=1",
  "./auth-experience.css?v=6",
  "./auth-neon-gateway.css?v=9",
  "./auth-h-galaxy.css?v=12",
  "./auth-living-galaxy-3d.css?v=11",
  "./auth-living-background.css?v=1",
  "./auth-spatial-aurora.css?v=1",
  "./auth-identity-constellation.css?v=1",
  "./auth-creative-universe.css?v=5",
  "./auth-universe-memory.css?v=1",
  "./auth-logo-motion.css?v=1",
  "./auth-emotional-logo.css?v=1",
  "./auth-form-motion.css?v=4",
  "./auth-quantum-flow.css?v=1",
  "./auth-transition-runtime.css?v=2",
  "./auth-trust-director.css?v=1",
  "./auth-cosmic-prism-background.css?v=2",
  "./auth-cosmic-prism-form.css?v=2",
  "./auth-cosmic-prism-interactions.css?v=3",
  "./auth-zoom-resilience.css?v=3",
  "./auth-typography-unified.css?v=2",
  "./assets/hh-neon-logo-v2.png?v=3",
  "./auth-platform.js?v=18",
  "./auth-experience.js?v=8",
  "./auth-neon-gateway.js?v=29",
  "./auth-h-galaxy.js?v=14",
  "./auth-living-galaxy-3d.js?v=16",
  "./auth-living-background.js?v=1",
  "./auth-spatial-aurora.js?v=1",
  "./auth-identity-constellation.js?v=2",
  "./auth-creative-universe.js?v=8",
  "./auth-universe-memory.js?v=4",
  "./auth-logo-motion.js?v=1",
  "./auth-emotional-logo.js?v=1",
  "./auth-form-motion.js?v=3",
  "./auth-transition-runtime.js?v=2",
  "./auth-quantum-flow.js?v=2",
  "./auth-trust-director.js?v=2",
  "./auth-cosmic-prism-background.js?v=3",
  "./auth-cosmic-prism-form.js?v=3",
  "./auth-cosmic-prism-interactions.js?v=3",
  "./auth-zoom-resilience.js?v=4",
  "./search-platform-core.js?v=3",
  "./search-quick-overlay.css?v=1",
  "./search-quick-overlay.js?v=1",
  "./google-hub.css?v=4",
  "./google-hub.js?v=1",
  "./google-hub-pro.css?v=3",
  "./google-hub-pro.js?v=3",
  "./youtube-hub.css?v=5",
  "./youtube-hub.js?v=1",
  "./youtube-hub-pro.css?v=4",
  "./youtube-hub-pro.js?v=5",
  "./youtube-pip.html",
  "./discord-hub.css?v=2",
  "./discord-hub.js?v=2",
  "./communication-overview.css?v=1",
  "./communication-overview.js?v=3",
  "./communication-suite.css?v=2",
  "./communication-workspace-fix.css?v=1",
  "./communication-suite.js?v=2",
  "./communication-command-center.css?v=1",
  "./communication-command-center.js?v=2",
  "./communication-messenger-next.css?v=2",
  "./communication-messenger-next.js?v=2",
  "./communication-channels-forum.css?v=1",
  "./communication-channels-forum.js?v=2",
  "./communication-live-room.css?v=1",
  "./communication-live-room.js?v=1",
  "./communication-canvas-automation.css?v=1",
  "./communication-canvas-automation.js?v=1",
  "./communication-intelligence.css?v=3",
  "./communication-intelligence.js?v=3",
  "./work-center.css?v=4",
  "./work-center.js?v=5",
  "./download-center-pro.css?v=1",
  "./team-collaboration-pro.css?v=2",
  "./team-collaboration-pro.js?v=2",
  "./creative-suite.css?v=6",
  "./ai-center-pro.css?v=1",
  "./ai-center-advanced.css?v=1",
  "./ai-center-advanced.js?v=2",
  "./platform-p0.css?v=1",
  "./platform-p0.js?v=1",
  "./platform-orchestrator.js?v=2",
  "./platform-module-bridge.js?v=2",
  "./app-theme-system.js?v=9",
  "./system-platform.css?v=3",
  "./system-platform.js?v=7",
  "./sidebar-navigation-pro.css?v=29",
  "./vendor/three.webgpu.min.js",
  "./vendor/addons/loaders/GLTFLoader.js",
  "./vendor/addons/loaders/DRACOLoader.js",
  "./vendor/addons/loaders/KTX2Loader.js",
  "./vendor/addons/loaders/HDRLoader.js",
  "./vendor/addons/libs/meshopt_decoder.module.js",
  "./vendor/addons/libs/ktx-parse.module.js",
  "./vendor/addons/libs/zstddec.module.js",
  "./vendor/addons/libs/basis/basis_transcoder.js",
  "./vendor/addons/libs/basis/basis_transcoder.wasm",
  "./vendor/addons/libs/draco/gltf/draco_decoder.js",
  "./vendor/addons/libs/draco/gltf/draco_decoder.wasm",
  "./vendor/addons/libs/draco/gltf/draco_wasm_wrapper.js",
  "./vendor/addons/math/ColorSpaces.js",
  "./vendor/addons/utils/WorkerPool.js",
  "./vendor/addons/utils/BufferGeometryUtils.js",
  "./vendor/addons/utils/SkeletonUtils.js",
  "./hh-school.css?v=4",
  "./english-learning.css?v=17",
  "./language-learning-cockpit.css?v=1",
  "./english-skill-graph.css?v=1",
  "./english-learning-os.css?v=4",
  "./english-galaxy.css?v=1",
  "./english-learning-galaxy.css?v=6",
  "./english-vocabulary.css?v=2",
  "./english-for-everyone.css?v=1",
  "./english-voice-coach.css?v=4",
  "./japanese-learning.css?v=8",
  "./japanese-os-v3.css?v=4",
  "./japanese-os-v4.css?v=3",
  "./hh-chinese.css?v=12",
  "./phat-phap.css?v=18",
  "./hh-play.css?v=5&build=2",
  "./hh-play-audio-worklet.js?build=2",
  "./assets/phat-phap/duc-phat-hao-quang-v1.webp",
  "./assets/chinese/NOTICE.md",
  "./community-social-pro.css?v=3",
  "./community-social-pro.js?v=4",
  "./community-platform-v2.css?v=10",
  "./community-platform-v2.js?v=12",
  "./community-messenger-pro.css?v=1",
  "./community-calls.js?v=1",
  "./community-admin.css?v=12",
  "./community-admin.js?v=14",
  "./insights-pro.css?v=3",
  "./privacy-consent-center.css?v=3",
  "./auth-login-repair.css?v=4",
  "./motion-comfort.css?v=1",
  "./insights-pro.js?v=7",
  "./privacy-consent-center.js?v=2",
  "./creative-suite.js?v=7",
  "./creative-os.css?v=7",
  "./creative-galaxy.css?v=3",
  "./creative-galaxy.js?v=4",
  "./creative-star-map.css?v=2",
  "./creative-star-map.js?v=3",
  "./creative-os.js?v=13",
  "./creative-os-core.js?v=4",
  "./creative-command-center.css?v=2",
  "./creative-command-center.js?v=2",
  "./creative-preproduction.css?v=1",
  "./creative-preproduction.js?v=1",
  "./creative-ai-workflow.css?v=3",
  "./creative-ai-workflow.js?v=3",
  "./creative-production-lab.css?v=1",
  "./creative-production-lab.js?v=1",
  "./creative-collaboration-os.css?v=1",
  "./creative-collaboration-os.js?v=1",
  "./creative-publishing.css?v=1",
  "./creative-publishing.js?v=1",
  "./creative-marketplace.css?v=1",
  "./creative-marketplace.js?v=1",
  "./extension-suite.js?v=2",
  "./professional-tools.js?v=4",
  "./dev-smart-recipe.js?v=1",
  "./dev-api-studio.js?v=1",
  "./dev-data-security.js?v=1",
  "./dev-regex-database.js?v=1",
  "./dev-code-git.js?v=1",
  "./dev-diagnostics-ai.js?v=1",
  "./dev-pro-suite.js?v=4",
  "./dev-delivery-workflow.js?v=2",
  "./media-design-studio.js?v=2",
  "./media-design-pro.js?v=2",
  "./media-design-advanced.js?v=3",
  "./media-design-publish.js?v=1",
  "./video-editor-studio.js?v=5",
  "./video-batch-factory.js?v=3",
  "./video-editor-resolve.js?v=12",
  "./davinci-resolve-hub.js?v=5",
  "./h-cosmic-web-studio.js?v=3",
  "./video-editor-auto.js?v=1",
  "./photo-editor-pro.js?v=3",
  "./universal-media-project.js?v=3",
  "./media-production-workflow.js?v=3",
  "./media-cosmos.js?v=3",
  "./media-audio-studio.js?v=4",
  "./media-professional-suite.js?v=3",
  "./vendor/vercel-blob-client.min.js?v=1",
  "./media-next-suite.js?v=2",
  "./media-tool-experience.js?v=2",
  "./media-project-photo-studio.js?v=4",
  "./media-production-universe.js?v=4",
  "./editor-workflow-pro.js?v=2",
  "./support-platform.js?v=21",
  "./vendor/astronomy-engine-2.1.19.min.js?v=1",
  "./vendor/iztro-2.6.0.min.js?v=2.6.0",
  "./fortune-iching-64.js?v=1",
  "./fortune-accuracy-lab.js?v=1",
  "./fortune-suite-v4.js?v=4",
  "./fortune-astrology.js?v=1",
  "./fortune-astrology-v4.js?v=2",
  "./fortune-moon-3d.js?v=1",
  "./fortune-extended-tools.js?v=2",
  "./fortune-hub.js?v=28",
  "./draw-studio.js?v=9",
  "./remote-hub.js?v=4",
  "./draw-studio-worker.js?v=5",
  "./assets/fortune/lenormand/game-of-hope/spiel-der-hoffnung-36.webp",
  "./assets/fortune/moon/nasa-lro/lroc-color-2k.jpg",
  "./assets/fortune/moon/nasa-lro/lroc-height-1k.jpg",
  "./chat-ai-hub.js?v=17",
  "./media-design-page.js?v=23",
  "./tool-manifests.js?v=1",
  "./tool-runtime.js?v=1",
  "./feature-lab.js?v=6",
  "./platform-tools.js?v=1",
  "./tool-workspace-pro.js?v=1",
  "./utility-lab-tools.js?v=9",
  "./feature-engines.js?v=2",
  "./hh-school-curriculum.js?v=3",
  "./hh-school-core.js?v=4",
  "./hh-school-offline.js?v=4",
  "./hh-school-sync.js?v=4",
  "./hh-school-search-worker.js?v=3",
  "./hh-school-code-worker.js?v=2",
  "./hh-school.js?v=5",
  "./english-curriculum.js?v=1",
  "./language-learning-cockpit.js?v=1",
  "./english-career-expansion.js?v=1",
  "./english-career-curriculum.js?v=2",
  "./english-galaxy.js?v=2",
  "./english-learning-galaxy.js?v=5",
  "./english-vocabulary.js?v=3",
  "./english-vocabulary-worker.js?v=1",
  "./english-for-everyone.js?v=2",
  "./assets/english-vocabulary/manifest.json",
  "./english-skill-graph.js?v=1",
  "./english-learning-os.js?v=8",
  "./english-learning.js?v=29",
  "./japanese-vocabulary-packs.js?v=1",
  "./japanese-vocabulary-10k.js?v=1",
  "./japanese-vietnamese-pack.js?v=1",
  "./japanese-vocabulary-v4.js?v=2",
  "./japanese-sentence-bank-v5.js?v=1",
  "./japanese-kanjivg-v5.js?v=1",
  "./japanese-search-worker.js?v=1",
  "./japanese-learning.js?v=8",
  "./japanese-os-v3.js?v=2",
  "./japanese-os-v4.js?v=9",
  "./hh-chinese.js?v=12",
  "./phat-phap.js?v=15",
  "./hh-play.js?v=4&build=2",
  "./config.js?v=10",
  "./data/ai-super-platform-modules.json"
];
const CORE = [
  "./",
  "./index.html",
  "./app-shell.css?v=65",
  "./app-theme-system.css?v=9",
  "./sidebar-navigation-pro.css?v=29",
  "./auth-experience.css?v=6",
  "./auth-neon-gateway.css?v=9",
  "./auth-zoom-resilience.css?v=3",
  "./auth-typography-unified.css?v=2",
  "./privacy-consent-center.css?v=3",
  "./motion-comfort.css?v=1",
  "./assets/hh-neon-logo-v2.png?v=3",
  "./config.js?v=10",
  "./platform-orchestrator.js?v=2",
  "./platform-module-bridge.js?v=2",
  "./app-theme-system.js?v=9",
  "./performance-loader.js?v=498",
  "./auth-platform.js?v=18",
  "./auth-neon-gateway.js?v=29",
  "./script.js?v=243"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE))));
self.addEventListener("message", event => {
  if (event.data?.type === "HH_APPLY_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));

const HH_SCHOOL_DB = "hh-school-offline-v1";
const HH_SCHOOL_QUEUE = "syncQueue";
function openHHSchoolQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HH_SCHOOL_DB, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles", { keyPath: "key" });
      if (!db.objectStoreNames.contains("curriculumPacks")) db.createObjectStore("curriculumPacks", { keyPath: "key" });
      if (!db.objectStoreNames.contains("curriculumHistory")) db.createObjectStore("curriculumHistory", { keyPath: "key" });
      if (!db.objectStoreNames.contains("submissionFiles")) db.createObjectStore("submissionFiles", { keyPath: "key" });
      if (!db.objectStoreNames.contains(HH_SCHOOL_QUEUE)) {
        const queue = db.createObjectStore(HH_SCHOOL_QUEUE, { keyPath: "id" });
        queue.createIndex("createdAt", "createdAt");
        queue.createIndex("ownerProfile", "ownerProfile");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("HH School offline database unavailable"));
  });
}
function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function updateHHSchoolQueue(db, item, options = {}) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HH_SCHOOL_QUEUE, "readwrite");
    const store = tx.objectStore(HH_SCHOOL_QUEUE);
    if (options.remove) store.delete(item.id);
    else store.put({ ...item, attempts: options.conflict ? Number(item.attempts || 0) : Number(item.attempts || 0) + 1, syncStatus: options.conflict ? "needs-resolution" : "queued", conflict: options.conflictData || item.conflict || null, lastError: options.error || item.lastError || "", lastAttemptAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("HH School queue transaction aborted"));
  });
}
async function flushHHSchoolQueue() {
  const db = await openHHSchoolQueue();
  const results = [];
  try {
    const items = await idbRequest(db.transaction(HH_SCHOOL_QUEUE).objectStore(HH_SCHOOL_QUEUE).getAll());
    for (const item of items) {
      if (item.syncStatus === "needs-resolution") { results.push({ id: item.id, ok: false, conflict: true, conflictData: item.conflict || null, error: item.lastError || "Conflict needs resolution" }); continue; }
      try {
        if (Number(item.attempts || 0) >= Number(item.maxAttempts || 5)) { results.push({ id: item.id, ok: false, terminal: true, error: "Retry limit reached" }); continue; }
        const queued = item.request || {};
        const target = new URL(String(queued.url || ""), self.location.origin);
        if (target.origin !== self.location.origin || !target.pathname.startsWith("/api/education/")) throw new Error("Unsafe HH School sync target");
        const response = await fetch(target.href, {
          method: queued.method || "PUT",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: typeof queued.body === "string" ? queued.body : JSON.stringify(queued.body || {})
        });
        if (response.status === 409) {
          const data = await response.json().catch(() => ({}));
          await updateHHSchoolQueue(db, item, { conflict: true, conflictData: data.conflict || null, error: data.error || "HTTP 409" });
          results.push({ id: item.id, ok: false, conflict: true, conflictData: data.conflict || null, error: data.error || "HTTP 409" });
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await updateHHSchoolQueue(db, item, { remove: true });
        results.push({ id: item.id, ok: true });
      } catch (error) {
        await updateHHSchoolQueue(db, item, { error: String(error?.message || error) });
        results.push({ id: item.id, ok: false, error: String(error?.message || error) });
      }
    }
  } finally {
    db.close();
  }
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: "HH_SCHOOL_SYNC_RESULT", results }));
  return results;
}
self.addEventListener("sync", event => {
  if (event.tag === "hh-school-progress") event.waitUntil(flushHHSchoolQueue());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isPrivateRequest = url.pathname.startsWith("/api/") || request.headers.has("authorization");
  if (url.origin !== self.location.origin || isPrivateRequest) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put("./index.html", copy)));
      }
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const refresh = fetch(request).then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    });
    if (cached) {
      event.waitUntil(refresh.catch(() => undefined));
      return cached;
    }
    return refresh.catch(() => Response.error());
  }));
});
