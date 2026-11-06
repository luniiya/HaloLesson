---
name: dev-instance-settings
description: Server settings changed on the local dev instance (data/halolesson.sqlite)
type: fact
---
- Complex password requirement (`require_strong_passwords`) is OFF on the dev instance, at the user's request. *(as of 2026-11-06)*
- `halolesson` MCP server added to user-scope Claude config (~/.claude.json) pointing at http://localhost:7270/mcp, token stored there, at the user's request. Remove with `claude mcp remove halolesson -s user`. *(as of 2026-11-06)*
