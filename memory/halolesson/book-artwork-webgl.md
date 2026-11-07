---
name: book-artwork-webgl
description: The spinning book in BookArtwork is three.js WebGL (book3d.ts, lazy-loaded); CSS 3D vanished edge-on
type: decision
---

*(as of 2026-11-07)* The open book in `web/src/components/BookArtwork.tsx` is rendered with
three.js (`web/src/components/book3d.ts`, dynamically imported so three stays out of the main
bundle). The old CSS 3D version (stacked flat slices) became invisible when seen edge-on. The
user said the WebGL version "looks 10x better".

- Base, halo and sparks are still flat CSS/SVG; the halo always draws in front of the book.
- Colors come from the CSS accent vars (resolved by painting a pixel), and update live via a
  MutationObserver on `<html>`.
- Possible follow-up: make the halo and the base 3D too, so the halo can pass behind the book.

Related: [[accent-color-setting]], [[branding]]
