# Astra H-08 reference views

Every PNG in this directory is a lossless crop from the project-owned character
sheet at `../concept/astra-h08-character-sheet-v1.png`.

- Source rectangle: x=6, y=72, width=310, height=724 pixels
- Output size: 310 × 724 pixels
- Purpose: local Blender topology, sculpt and silhouette reference only
- This crop is the only permitted visual input. No external 3D asset may be
  imported or used by the Astra generator.

The crop preserves the complete front-view character silhouette without
including the adjacent back, profile, detail, or expression panels.

Additional crops isolate the back, both profiles, three-quarter pose and face.
They contain no new generated pixels and exist only to make Blender reference
alignment deterministic.

`astra-h08-apose-turnaround-v1.png` is an AI-assisted 2D derivative generated
from the project-owned sheet to normalize the front/back/profile A-pose for
modeling. It is reference-only, may contain interpretation drift, and must not
override unique details visible in the original sheet.
