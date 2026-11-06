---
name: dark-mode
description: Auto/Light/Dark theme toggle in Settings > Appearance, recoral-style, Duolingo dark palette
type: decision
---

*(as of 2026-11-06)* User asked for dark mode "how it's done on ../recoral": `.dark` class on <html>,
`@custom-variant dark`, localStorage preference (per device, not server, like recoral and like
accent which has no agent op either), inline script in index.html to avoid a flash.
- Toggle lives in Settings > Appearance with **Auto / Light / Dark**; **default is Auto**.
- Must look **Duolingo-styled** (Duolingo's own dark mode: bg #131f23, borders #37464f, light text).

Related: [[accent-color-setting]] [[duolingo-color-palette]]

*(2026-11-06, done)* Implemented: `.dark` tokens flip in app.css, `initTheme/setTheme/useTheme` in web/src/lib/theme.ts, key `halolesson:theme`, Theme card in AppearanceSettings.
