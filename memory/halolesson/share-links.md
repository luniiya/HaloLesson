---
name: share-links
description: How subject sharing works — revocable live link + preview page, or export file
type: decision
---

*(as of 2026-11-06)* User chose "Preview + add copy" for share links.
- Backend: `subject_shares` table (one token per subject), `server/src/shares.ts`, routes `/api/subjects/:id/share` (GET/POST/DELETE), `/api/shared/:token`, `/api/shared/:token/copy`. Tests in `server/test/subjects/share.test.ts`.
- Web: Share button on the subject page opens `ShareDialog` (create/copy/stop sharing a link, or download export file). `/shared/:token` (`SharedPage`) shows the outline (no answers/progress) with "Add to my library"; viewers must be logged in, and the login redirect returns them to the link.
- Link always shows the owner's latest version; copies never include the owner's progress.
