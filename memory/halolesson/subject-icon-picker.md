---
name: subject-icon-picker
description: Creating a subject must let the user pick its icon (user found it annoying that it can't)
type: project
---

*(as of 2026-11-06)* User: "when you create a subject u have no way of choosing which icon will be
the subject, which is pretty annoying." Add an icon choice to the create-subject form (and keep the
agent create op able to set it too, per [[feature-parity-rule]]).

Related: [[library-organisation]]

*(2026-11-06, done)* Icon picker (Auto + all SUBJECT_ICONS) added to CreateSubjectForm. Server POST /api/subjects and the agent op already accepted `icon`.

*(as of 2026-11-07)* Bug fixed: Auto's no-keyword fallback was hashed from the name in the picker but from the subject id on the orbit, so the saved icon differed from the preview. Both now hash the name (`autoIcon(name, description)` in `web/src/lib/subjectIcons.ts`).
