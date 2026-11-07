---
name: start-flag
description: The map's start is a flag node (not a skill), linkable to any skill, in the subject's accent color, halo-style shading
type: decision
---

*(as of 2026-11-07)* User: "the flag should be the starting point not a skill, and the flag should be a node and it should be able to connect to link to anything"; "the color of the starting flag should be the accent color of the subject"; "it should have shading just like the halo".
Built:
- Storage: links to the flag reuse `skills.is_start`; the flag's position is `subjects.start_x/start_y`, laid out by `ensureLayout` as one more force-layout node (LAYOUT_VERSION 5), in the region of its first start skill.
- id `START_NODE = "start"` (shared) works in `linkSkills` and `unlinkSkills`: web `PUT/DELETE /api/skills/start/links/:id`, agent `linkSkills a:"start"`. `SubjectDetail.start` = {x,y} | null.
- Web: `StartFlag.tsx` is an SVG flag on an oval base. It is drawn in `gradientStart` with ledges in the darker shade (mixed 25% with black) and white shines, like the BookArtwork halo. The pole knob is gold.
- Its links are drawn in the subject color, dashed when no start skill is marked (it implicitly links to the first skill).
- Editing the flag: in edit mode, select the flag to get a FlagEditor panel (start skills plus link mode). A skill's links list shows a "Start flag" chip. The start checkbox and the skill-start pill are removed.

*(as of 2026-11-07)* User: "make the start flag taller and remove the platform". The oval base is gone; the pole is taller (viewBox -14.5 0 100 150, centred on the pole). Its foot is the map point (FLAG_ANCHOR 123px), and a small selection ring sits at the foot.

*(as of 2026-11-07)* User wanted map links to stop at the outer circle of a button, like the main menu, instead of showing inside it. SkillMap `trimmed()` now ends each link 62px from a skill's centre (58px ring radius plus 4px stroke cap). Flag links start right at the pole's foot.

*(as of 2026-11-07)* User: hovering shouldn't lift the flag ("it would fall"). It no longer moves up; instead the cloth (`.start-flag-cloth`) waves from the pole on hover with a `flag-wave` keyframe, which is off under reduced motion.

*(as of 2026-11-07)* Links still showed a little through the ring's top gap, so NODE_EDGE is now 58+4+6 = 68px, leaving a small gap before the ring.
