const CACHE = "hh-identity-portal-v622";
// Compatibility aliases are kept as documentation for clients upgrading from the
// previous route loader. They are not fetched; RUNTIME_ASSETS below is canonical.
// Image Text Studio compatibility: ./image-text-studio.css?v=11 ./image-text-studio.js?v=11
// Compatibility from v370 and v395-v408: hh-identity-portal-v370 script.js?v=159 script.js?v=160 performance-loader.js?v=139 performance-loader.js?v=140 hh-identity-portal-v395 hh-identity-portal-v396 hh-identity-portal-v397 hh-identity-portal-v403 hh-identity-portal-v404 hh-identity-portal-v405 hh-identity-portal-v406 hh-identity-portal-v407 hh-identity-portal-v408
// script.js?v=141 script.js?v=145 performance-loader.js?v=51 performance-loader.js?v=52 performance-loader.js?v=57 performance-loader.js?v=58
// AI Video Remake upgrade compatibility: script.js?v=172 performance-loader.js?v=249 performance-loader.js?v=250 performance-loader.js?v=251 hh-identity-portal-v517 hh-identity-portal-v518 hh-identity-portal-v519 ai-video-remake-studio.css?v=1 ai-video-remake-studio.css?v=2 ai-video-remake-studio.js?v=1
// Graphic Design Universal compatibility aliases: graphic-design-universal.css?v=1 graphic-design-universal.js?v=1
// Entertainment v4 compatibility aliases: ./game-center.css?v=4 ./game-center.js?v=4
// Open Media upgrade compatibility: hh-identity-portal-v527 hh-identity-portal-v543 ./performance-loader.js?v=259 ./script.js?v=176 ./script.js?v=172 ./auth-neon-gateway.js?v=14 ./auth-h-galaxy.js?v=5 ./home-galaxy-command.js?v=8 ./open-music-hub.css?v=4 ./open-music-hub.js?v=3
// YouTube Batch compatibility: ./script.js?v=179 ./performance-loader.js?v=272 ./youtube-creator-galaxy.css?v=20 ./youtube-creator-galaxy.js?v=24 ./home-galaxy-command.css?v=9
// communication-suite.css?v=1 communication-suite.js?v=1 communication-command-center.css?v=1 communication-command-center.js?v=1 communication-messenger-next.css?v=1 communication-messenger-next.js?v=1 communication-channels-forum.css?v=1 communication-channels-forum.js?v=1 communication-live-room.css?v=1 communication-live-room.js?v=1 communication-canvas-automation.css?v=1 communication-canvas-automation.js?v=1 communication-intelligence.css?v=1 communication-intelligence.js?v=1
// HH School v1 replaces the former Learning OS bundle; legacy caches are removed during activation.
const RUNTIME_ASSETS = [
  "./",
  "./index.html",
  "./app-shell.css?v=54",
  "./app-theme-system.css?v=6",
  "./dashboard-aurora.css?v=4",
  "./home-galaxy-command.css?v=11",
  "./home-virtual-assistant.css?v=8",
  "./home-live-widgets.css?v=11",
  "./home-cosmic-os.css?v=3",
  "./home-galaxy-mission.css?v=8",
  "./home-galaxy-operations.css?v=2",
  "./home-galaxy-control-deck.css?v=3",
  "./command-center-pro.css?v=4",
  "./home-daily-command.css?v=4",
  "./home-command-search.css?v=2",
  "./home-widget-project-pulse.css?v=2",
  "./home-health-focus.css?v=2",
  "./professional-tools.css?v=3",
  "./dev-pro-suite.css?v=2",
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
  "./media-design-page.css?v=11",
  "./media-cosmos.css?v=2",
  "./media-professional-suite.css?v=1",
  "./media-next-suite.css?v=1",
  "./media-production-workflow.css?v=3",
  "./universal-media-project.css?v=1",
  "./media-design-advanced.css?v=3",
  "./media-design-publish.css?v=1",
  "./video-editor-studio.css?v=4",
  "./video-batch-factory.css?v=4",
  "./comic-motion-studio.css?v=6",
  "./comic-reader-hub.css?v=13",
  "./cinema-hub.css?v=5",
  "./open-music-hub.css?v=5",
  "./open-media-governance.css?v=1",
  "./video-editor-resolve.css?v=8",
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
  "./support-platform.css?v=10",
  "./vendor/pdf-lib.min.js?v=1.17.1",
  "./script.js?v=186",
  "./graphic-design-studio.css?v=6",
  "./graphic-design-universal.css?v=4",
  "./graphic-design-animation.js?v=1",
  "./graphic-design-3d.js?v=2",
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
  "./graphic-design-studio.js?v=7",
  "./vendor/three.module.min.js",
  "./vendor/three.core.min.js",
  "./character-3d-studio.css?v=1",
  "./character-3d-studio.js?v=4",
  "./character-3d-runtime.js?v=1",
  "./social-media-tools-v2.css?v=8",
  "./social-media-preview-runtime.css?v=6",
  "./social-media-tools-core.js?v=7",
  "./social-media-tools-workspaces.js?v=7",
  "./social-media-communication-engines.js?v=1",
  "./social-media-tool-contracts.js?v=7",
  "./social-media-local-engines.js?v=6",
  "./social-media-pipeline.js?v=6",
  "./social-media-tool-capabilities.js?v=7",
  "./social-media-preview-runtime.js?v=1",
  "./social-media-tools-v2.js?v=13",
  "./services/character3d/RightsRegistry.js?v=2",
  "./services/character3d/AssetLoader.js?v=3",
  "./services/character3d/AnimationController.js?v=2",
  "./services/character3d/ExpressionController.js?v=2",
  "./services/character3d/CharacterCustomizer.js?v=2",
  "./services/character3d/VoiceLipSync.js?v=2",
  "./services/character3d/ExportManager.js?v=3",
  "./services/character3d/AvatarRuntime.js?v=3",
  "./assets/character-3d/rights-registry.json",
  "./assets/character-3d/astra-h08/concept/astra-h08-character-sheet-v1.png",
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
  "./comic-motion-studio.js?v=10",
  "./comic-open-source-catalog.js?v=2",
  "./comic-reader-hub.js?v=19",
  "./utils/open-media-rights.js?v=4",
  "./cinema-hub.js?v=6",
  "./open-music-hub.js?v=4",
  "./open-media-governance.js?v=2",
  "./assets/open-media/curated-films-v1.json",
  "./assets/open-media/curated-music-v1.json",
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
  "./home-galaxy-command.js?v=11",
  "./services/virtualAssistantCore.js?v=3",
  "./services/virtualAssistantActions.js?v=1",
  "./services/virtualAssistantCommands.js?v=2",
  "./services/virtualAssistantVoice.js?v=2",
  "./services/virtualAssistantCharacter.js?v=3",
  "./home-virtual-assistant.js?v=23",
  "./assets/hikari-h/hikari-h-original-v1-alpha.webp",
  "./home-live-widgets.js?v=6",
  "./home-cosmic-os.js?v=11",
  "./home-galaxy-mission.js?v=10",
  "./home-galaxy-operations.js?v=5",
  "./home-galaxy-control-deck.js?v=3",
  "./command-center-pro.js?v=6",
  "./home-daily-command.js?v=6",
  "./home-command-search.js?v=4",
  "./home-widget-project-pulse.js?v=2",
  "./home-health-focus.js?v=2",
  "./extension-suite.css?v=1",
  "./auth-experience.css?v=6",
  "./auth-neon-gateway.css?v=9",
  "./auth-h-galaxy.css?v=9",
  "./auth-living-galaxy-3d.css?v=10",
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
  "./auth-cosmic-prism-interactions.css?v=2",
  "./auth-zoom-resilience.css?v=3",
  "./auth-typography-unified.css?v=2",
  "./assets/hh-neon-logo-v2.png?v=3",
  "./auth-platform.js?v=13",
  "./auth-experience.js?v=8",
  "./auth-neon-gateway.js?v=22",
  "./auth-h-galaxy.js?v=8",
  "./auth-living-galaxy-3d.js?v=14",
  "./auth-living-background.js?v=1",
  "./auth-spatial-aurora.js?v=1",
  "./auth-identity-constellation.js?v=2",
  "./auth-creative-universe.js?v=6",
  "./auth-universe-memory.js?v=3",
  "./auth-logo-motion.js?v=1",
  "./auth-emotional-logo.js?v=1",
  "./auth-form-motion.js?v=3",
  "./auth-transition-runtime.js?v=2",
  "./auth-quantum-flow.js?v=2",
  "./auth-trust-director.js?v=2",
  "./auth-cosmic-prism-background.js?v=2",
  "./auth-cosmic-prism-form.js?v=2",
  "./auth-cosmic-prism-interactions.js?v=2",
  "./auth-zoom-resilience.js?v=4",
  "./search-watch-center.css?v=5",
  "./search-watch-center.js?v=8",
  "./youtube-pip.html",
  "./communication-overview.css?v=1",
  "./communication-overview.js?v=2",
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
  "./app-theme-system.js?v=5",
  "./system-platform.css?v=3",
  "./system-platform.js?v=6",
  "./sidebar-navigation-pro.css?v=9",
  "./game-runtime.css?v=1",
  "./astral-realms.css?v=77",
  "./assets/astral-realms/astral-realms-panorama-v1.webp",
  "./assets/astral-realms/environment/astral-cinematic-panorama-v2.png",
  "./assets/astral-realms/environment/SOURCES.json",
  "./assets/astral-realms/environment/hdr/bell_park_dawn_1k.hdr",
  "./assets/astral-realms/environment/surfaces/ground037-color.webp",
  "./assets/astral-realms/environment/surfaces/ground037-normal-gl.webp",
  "./assets/astral-realms/environment/surfaces/ground037-roughness.webp",
  "./assets/astral-realms/environment/surfaces/ground037-height.webp",
  "./assets/astral-realms/environment/surfaces/ground037-ao.webp",
  "./assets/astral-realms/environment/pine_roots_web.glb",
  "./assets/astral-realms/environment/modular_fort_01_web.glb",
  "./assets/astral-realms/environment/free3d-cc0/SOURCES.json",
  "./assets/astral-realms/environment/free3d-cc0/free3d-tree-a.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-tree-b.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-tree-c.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-bush.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-flower.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-mushroom.glb",
  "./assets/astral-realms/environment/free3d-cc0/free3d-stone.glb",
  "./assets/astral-realms/astral-crew-atlas-v2.webp",
  "./assets/astral-realms/characters/manifest.json",
  "./assets/astral-realms/weapons/manifest.json",
  "./assets/astral-realms/monsters/manifest.json",
  "./assets/astral-realms/characters/SOURCES.json",
  "./assets/astral-realms/characters/default/valid-asian-f-1-casual.glb",
  "./assets/astral-realms/characters/default/valid-asian-m-1-casual.glb",
  "./assets/astral-realms/characters/default/valid-black-f-1-casual.glb",
  "./assets/astral-realms/characters/default/valid-white-m-1-casual.glb",
  "./assets/astral-realms/characters/default/valid-white-f-2-casual.glb",
  "./assets/astral-realms/characters/default/valid-hispanic-f-1-milit.glb",
  "./assets/astral-realms/characters/default/valid-aian-f-1-casual.glb",
  "./assets/astral-realms/characters/default/valid-mena-f-1-casual.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/miss-galaxy.glb?v=2",
  "./assets/astral-realms/characters/sketchfab-cc-by/game-character-girl.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/alina-ip.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/animated-female-fighter.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/animated-female-teacher.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/claudia-rigged.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/carla-rigged.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/mia-rigged.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/elizabeth.glb",
  "./assets/astral-realms/characters/sketchfab-cc-by/space-themed-character.glb",
  "./assets/astral-realms/kenney/nature/tree_oak.glb",
  "./assets/astral-realms/kenney/nature/tree_palmDetailedTall.glb",
  "./assets/astral-realms/kenney/nature/plant_bushDetailed.glb",
  "./assets/astral-realms/kenney/nature/path_stone.glb",
  "./assets/astral-realms/kenney/roads/road-straight.glb",
  "./assets/astral-realms/kenney/roads/road-bridge.glb",
  "./assets/astral-realms/kenney/roads/Textures/colormap.png",
  "./assets/astral-realms/kenney/suburban/building-type-a.glb",
  "./assets/astral-realms/kenney/suburban/Textures/colormap.png",
  "./assets/astral-realms/kenney/buildings/building-sample-tower-c.glb",
  "./assets/astral-realms/kenney/buildings/Textures/colormap.png",
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
  "./assets/astral-realms/hh-human-asteria-v1.glb",
  "./assets/astral-realms/hh-human-vanguard-v1.glb",
  "./assets/astral-realms/animations/hh-human-motion-v13.glb",
  "./assets/astral-realms/animations/motion-library-v13.json",
  "./space-explorer.css?v=4",
  "./game-center.css?v=6",
  "./astra-universe-expansion.css?v=4",
  "./game-arcade.css?v=5",
  "./cinematic-game-arcade.css?v=6",
  "./hh-school.css?v=3",
  "./english-learning.css?v=17",
  "./english-skill-graph.css?v=1",
  "./english-galaxy.css?v=1",
  "./english-learning-galaxy.css?v=6",
  "./english-vocabulary.css?v=1",
  "./english-for-everyone.css?v=1",
  "./english-voice-coach.css?v=4",
  "./japanese-learning.css?v=8",
  "./japanese-os-v3.css?v=4",
  "./japanese-os-v4.css?v=2",
  "./community-social-pro.css?v=3",
  "./community-social-pro.js?v=4",
  "./community-platform-v2.css?v=10",
  "./community-platform-v2.js?v=12",
  "./community-messenger-pro.css?v=1",
  "./community-calls.js?v=1",
  "./community-admin.css?v=10",
  "./community-admin.js?v=12",
  "./insights-pro.css?v=3",
  "./privacy-consent-center.css?v=3",
  "./auth-login-repair.css?v=4",
  "./motion-comfort.css?v=1",
  "./insights-pro.js?v=7",
  "./privacy-consent-center.js?v=2",
  "./creative-suite.js?v=7",
  "./creative-os.css?v=5",
  "./creative-galaxy.css?v=3",
  "./creative-galaxy.js?v=4",
  "./creative-star-map.css?v=2",
  "./creative-star-map.js?v=3",
  "./creative-os.js?v=11",
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
  "./dev-pro-suite.js?v=3",
  "./dev-delivery-workflow.js?v=2",
  "./media-design-studio.js?v=1",
  "./media-design-pro.js?v=2",
  "./media-design-advanced.js?v=3",
  "./media-design-publish.js?v=1",
  "./video-editor-studio.js?v=5",
  "./video-batch-factory.js?v=3",
  "./video-editor-resolve.js?v=10",
  "./davinci-resolve-hub.js?v=5",
  "./h-cosmic-web-studio.js?v=3",
  "./video-editor-auto.js?v=1",
  "./photo-editor-pro.js?v=3",
  "./universal-media-project.js?v=1",
  "./media-production-workflow.js?v=3",
  "./media-cosmos.js?v=2",
  "./media-professional-suite.js?v=3",
  "./vendor/vercel-blob-client.min.js?v=1",
  "./media-next-suite.js?v=2",
  "./editor-workflow-pro.js?v=2",
  "./support-platform.js?v=16",
  "./media-design-page.js?v=13",
  "./tool-manifests.js?v=1",
  "./tool-runtime.js?v=1",
  "./feature-lab.js?v=6",
  "./platform-tools.js?v=1",
  "./tool-workspace-pro.js?v=1",
  "./utility-lab-tools.js?v=9",
  "./feature-engines.js?v=2",
  "./game-platform-adapters.js?v=1",
  "./game-runtime.js?v=1",
  "./astral-realms.js?v=94",
  "./space-explorer.js?v=4",
  "./game-center.js?v=7",
  "./astra-universe-expansion.js?v=4",
  "./game-arcade.js?v=5",
  "./cinematic-game-arcade.js?v=3",
  "./hh-school-curriculum.js?v=3",
  "./hh-school-core.js?v=3",
  "./hh-school-offline.js?v=3",
  "./hh-school-sync.js?v=3",
  "./hh-school-search-worker.js?v=3",
  "./hh-school-code-worker.js?v=2",
  "./hh-school.js?v=4",
  "./english-curriculum.js?v=1",
  "./english-career-expansion.js?v=1",
  "./english-career-curriculum.js?v=2",
  "./english-galaxy.js?v=2",
  "./english-learning-galaxy.js?v=4",
  "./english-vocabulary.js?v=1",
  "./english-vocabulary-worker.js?v=1",
  "./english-for-everyone.js?v=2",
  "./assets/english-vocabulary/manifest.json",
  "./english-skill-graph.js?v=1",
  "./english-learning.js?v=24",
  "./japanese-vocabulary-packs.js?v=1",
  "./japanese-vocabulary-10k.js?v=1",
  "./japanese-vietnamese-pack.js?v=1",
  "./japanese-vocabulary-v4.js?v=2",
  "./japanese-sentence-bank-v5.js?v=1",
  "./japanese-kanjivg-v5.js?v=1",
  "./japanese-search-worker.js?v=1",
  "./japanese-learning.js?v=8",
  "./japanese-os-v3.js?v=2",
  "./japanese-os-v4.js?v=5",
  "./config.js?v=10",
  "./data/ai-super-platform-modules.json"
];
const CORE = [
  "./",
  "./index.html",
  "./app-shell.css?v=54",
  "./app-theme-system.css?v=6",
  "./sidebar-navigation-pro.css?v=9",
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
  "./app-theme-system.js?v=5",
  "./performance-loader.js?v=332",
  "./auth-platform.js?v=13",
  "./auth-neon-gateway.js?v=22",
  "./script.js?v=186"
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
async function updateHHSchoolQueue(db, item, remove = false) {
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HH_SCHOOL_QUEUE, "readwrite");
    const store = tx.objectStore(HH_SCHOOL_QUEUE);
    if (remove) store.delete(item.id);
    else store.put({ ...item, attempts: Number(item.attempts || 0) + 1, lastAttemptAt: Date.now() });
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await updateHHSchoolQueue(db, item, true);
        results.push({ id: item.id, ok: true });
      } catch (error) {
        await updateHHSchoolQueue(db, item, false);
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

  const isCharacterRelease = /\/assets\/character-3d\/astra-h08\/output\/ASTRA_H08\.(?:release\.json|glb)$/.test(url.pathname);
  if (isCharacterRelease) {
    // Manifest and GLB must be fetched as one current release pair. Returning a
    // stale manifest or binary first can create a false SHA-256 mismatch.
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || Response.error())));
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
