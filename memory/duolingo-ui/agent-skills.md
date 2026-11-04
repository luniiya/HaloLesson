---
name: duolingo-agent-skills
description: Ready-made agent skills found online for Duolingo-style UI work
type: reference
---

# Duolingo Agent Skills Found Online

*(as of 2026-11-04)* — found while researching Duolingo-style UI (see [[duolingo-research-sources]]).

- **anubhavg-icpl/vibe `duolingo-design`** — Claude Code skill, security grade A (100/100, scanned 2026-09-08). Its SKILL.md is essentially the open-design DESIGN.md wrapped as a design-system "mode". Install: `npx -y skills add anubhavg-icpl/vibe --skill duolingo-design --agent claude-code` (installs into `.claude/skills`). License CC-BY-NC-SA-4.0. Listing: https://www.skillsdirectory.com/skills/anubhavg-icpl-duolingo-design
- **HKTITAN/duolingo** — skill router over 44 granular agent skills distilled from 750 Duolingo blog posts + the Duolingo Handbook (brand/product/culture, not just UI). Install: `npx skills add HKTITAN/duolingo`. https://github.com/HKTITAN/duolingo
- **open-design.ai skills directory** — 244 design skills for coding agents (UI, slides, motion, 3D), includes the Duolingo system: https://open-design.ai/skills/
- **Skillry "Duolingo Style OG Image"** — paid ($4.99) image-gen skill for Duolingo-style OG images: https://skillry.dev/skills/bs-duolingo-style-og

Note: the duolingo-design skill content duplicates what's already in [[duolingo-color-palette]] / [[duolingo-components]] / [[duolingo-spacing-motion]], so local memory already covers it without installing.
