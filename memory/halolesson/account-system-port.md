---
name: account-system-port
description: Decision to port recoral's full account system (setup, account, sessions, admin, settings, import/export) into haloLesson
type: decision
---

*(as of 2026-11-06)* User asked to take "all this stuff" from ../recoral's account flow as haloLesson's base: first-run setup (first user = admin), account page (username/email/password with current-password re-auth, 30-day username cooldown, accent hue, avatar, delete own account), sessions list + revoke, admin users/server settings (signup toggle, strong passwords, require email), and data import/export. Existing code was written by Kimi and is considered unreliable.

Related: [[recoral-reference]], [[halolesson-data-portability]], [[halolesson-next-steps]]
