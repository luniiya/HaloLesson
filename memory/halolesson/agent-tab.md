---
name: agent-tab
description: Connect agent is a nav tab (/agent), not a popup
type: decision
---
*(as of 2026-11-07)* User: "the connect agent should be a tab rather than a popup". Now `routes/AgentPage.tsx` at `/agent`, in the sidebar and mobile nav; Settings > Sessions links to it. The popup component was removed.
Related: [[agent-connect-design]]

*(as of 2026-11-07)* User: remove Agent from the mobile bar and add a recoral-style overflow page, with the avatar labelled "Account" replacing Settings. Mobile bar is now Learn · Stats · Account (`/account`, `routes/AccountPage.tsx`: avatar, Connect agent, Archive, Trash, Settings, Log out). Desktop sidebar unchanged.
