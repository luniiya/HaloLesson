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
- [ ] Add responsive behavior for desktop, tablet, and mobile web
- [ ] Add loading, error, empty, hover, focus, pressed, and disabled states
- [ ] Add reduced-motion support and keyboard accessibility
- [ ] Capture bwl screenshots of every major screen at desktop and mobile sizes on exposed port 7270
- [ ] Visually review each screen against the local Duolingo references
- [ ] Fix spacing, hierarchy, alignment, overflow, and interaction issues found by each review
- [ ] Repeat screenshot review after every visual fix until no material issues remain
- [ ] Run the final build, type checks, and end-to-end user flow after UI changes

## After UI

- [ ] Clarify the dingcad-inspired agent generation flow
- [ ] Implement AI-assisted lesson generation and import
- [ ] Add adaptive practice selection based on recency and performance
- [ ] Tune mastery and three-star progression using real practice behavior
