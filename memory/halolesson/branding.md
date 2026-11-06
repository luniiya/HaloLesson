---
name: halolesson-branding
description: haloLesson visual identity and preferred 3D open-book hero artwork
type: decision
---

# haloLesson branding

*(as of 2026-11-05)*

- The user does not think haloLesson should have a character mascot. Preferred hero artwork: a **3D open book on a display plate**, slowly rotating, with a **yellow halo floating above it**.
- Desired finish: playful, dimensional Duolingo/Kurzgesagt-inspired styling. This should replace the current green character illustration during the UI phase.

Related: [[halolesson-vision]], [[halolesson-next-steps]]

*(2026-11-05, visual clarification)* The user supplied the green circular Duolingo book-level icon as the concrete perspective reference. The open book should sit on a **thick green circular skill-node base**, viewed more from above. This replaces the earlier neutral display-plate interpretation.
- 2026-11-06: book rebuilt as true CSS 3D (solid 6-face boxes, upright open book spinning on Y, thick Duolingo-button-style disc pedestal, halo above) in `web/src/components/BookArtwork.tsx`. User wants ALL art in this chunky 3D Duolingo style (solid ledges, flat colors, glossy top highlight). *(as of 2026-11-06)*
- 2026-11-06 (revised): base is now a flat copy of the subject-node button (grey ring + green oval face + ledge + gloss), NOT a 3D pedestal. Book floats above it, smaller, rounded corners, seen from above and tilted back. Halo is a flat SVG: two-tone yellow ring with a darker ledge and rounded white shine (same idea as the progress-bar gloss). *(as of 2026-11-06)*
- 2026-11-06: user said green is "very too much duolingo" → brand default accent changed to **violet `#7c5cff`** (my pick, user can change). Users can pick their own accent in Settings > Appearance; see [[accent-color-setting]]. *(as of 2026-11-06)*
