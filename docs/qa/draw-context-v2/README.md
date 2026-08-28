# Draw Studio contextual workspace QA

Release checked: `v924` with `draw-studio.js?v=13` and `draw-studio.css?v=14`.

## Evidence

- `before-desktop.png` and `before-mobile.png`: last accepted Draw workspace from `draw-layout-v1`, used as the pre-contextual-inspector baseline.
- `after-desktop.png`: 1920 × 945 browser viewport. The application workspace fills the available width, Tool has three accordions, all four contextual tabs are mounted, and the canvas remains the primary surface.
- `after-mobile.png`: 390 × 844 touch viewport. Canvas width is 390 px, document width is 390 px, the inspector is an absolute bottom sheet, and no horizontal overflow is present.

## Interaction checks

- All 46 existing brush presets remain available in the Brush drawer.
- Brush drawer opens, moves focus to its close button, and closes without changing the canvas.
- Switching to Layer shows only the Layer contextual panel.
- Tool/Object/Layer/Document contain 9 accordions in total; Tool contains 3.
- Desktop and mobile runs completed without new page or console errors.
- Responsive sweep at 1366, 1440 and 2560 px retained all four tabs, three Tool accordions and zero document-level horizontal overflow.
