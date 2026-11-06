# haloLesson

## Base

- [x] Recall the product vision and local Duolingo references
- [x] Define the Bun workspaces, React, and shared-types structure
- [x] Install dependencies and validate the workspace configuration
- [x] Add SQLite schema for users, sessions, subjects, units, skills, exercises, attempts, and mastery
- [x] Add multi-user registration, login, logout, and persistent cookie sessions
- [x] Add per-user subject list, creation, and detail APIs
- [x] Add React routing, auth guards, and session restoration
- [x] Add the responsive application shell and navigation
- [x] Add working subject library, subject creation, and subject detail screens
- [x] Verify production build and TypeScript checks
- [x] Verify the full flow with real HTTP requests: register, create subject, restore session, log out, log in, and confirm user data isolation

## UI phase

- [ ] Reopen the local Duolingo screenshots and clone before screen work
- [ ] Establish the final color, typography, spacing, border, and motion tokens
- [x] Replace the character mascot with a slowly rotating 3D open book on a thick green circular level base, with a floating yellow halo and a top-down Duolingo/Kurzgesagt-inspired finish
- [x] Build the Duolingo-inspired login and registration experience
- [x] Build the subject dashboard and empty states
- [x] Turn the subjects page into an orbital layout around the rotating 3D book, with an animated transition into the selected subject
- [x] Build circular skill nodes with subject-specific shapes and symbols
- [x] Add customizable per-subject gradients that distribute colors across the skill path
- [x] Add mastery stars and a distinctive gold state for fully perfected skills
- [x] Build the practice player with progress, multiple-choice and free-text exercises, hidden corrections, and result feedback
- [x] Add the future AI lesson-generation entry point and copy-prompt interaction placeholder
- [x] Use Tabler icons for interface icons instead of ASCII arrows or ad-hoc glyphs
- [x] Rebuild subject and skill nodes as shared chunky 3D Duolingo level buttons (straight-sided ledge, gloss, hover lift, mastery progress ring)
- [x] Clean the subjects page: remove extra labels and "Made by you", center the orbit, anchor stats at the bottom
- [x] Add the glossy Duolingo stripe to the practice progress bar
- [x] Subject page: wave skill path, Share button in the title row, full-width description
- [x] Share links backend: revocable per-subject link, outline preview, "copy to my library" route, tests in `server/test/subjects`
- [x] Appearance settings: per-user accent color (presets + custom) recoloring buttons, highlights, logo and the 3D book; brand default moved off green to violet `#7c5cff`
- [x] Subjects orbit: true-circle orbit with rings centered on it, white ring fill hiding the dashes, names moved to a hover/focus tooltip
- [x] Share choice dialog on the subject page (link with copy/revoke, or export file)
- [x] `/shared/:token` preview page with "Add to my library"
- [ ] Make the subject page more Duolingo: skill popover with START under the node, bouncing START on the next skill, 3D unit banner icon, name-based subject icons
- [ ] Add responsive behavior for desktop, tablet, and mobile web
- [ ] Add loading, error, empty, hover, focus, pressed, and disabled states
- [ ] Add reduced-motion support and keyboard accessibility
- [ ] Run the final build, type checks, and end-to-end user flow after UI changes

## Library management (main page)

Every item below needs BOTH the web UI and the agent interface (REST commit ops + MCP + prompt), per the parity rule.

- [x] Edit button on the main page, top right next to "New subject": turns on edit mode
- [x] Edit mode: rename subjects, change their colors, reorganise them (drag / move up and down)
- [x] Folders: create, rename, recolor, reorder, and move subjects in and out; folders can contain folders (nested)
- [x] Change a subject's icon (pick from a set) in edit mode
- [x] Archive: hide a subject (and folders) from the main page, view the archive, unarchive
- [x] Trash: "delete" only moves to the trash; trash can be viewed and restored
- [x] Trash auto-purge: items are permanently deleted automatically 30 days after trashing; users and agents can never permanently delete by hand
- [x] Agent ops + MCP tools + prompt for all of the above (rename, recolor, reorder, folders, archive, trash, restore)
- [x] Tests in `server/test/subjects` (and `agent`) covering archive, trash, restore, 30-day purge, folders and ordering
- [x] Removed the Log out button from the left sidebar (still in Settings > Account)

## After UI

- [x] Clarify the dingcad-inspired agent generation flow
- [x] Implement AI-assisted lesson generation and import
- [ ] Add adaptive practice selection based on recency and performance
- [ ] Tune mastery and three-star progression using real practice behavior
