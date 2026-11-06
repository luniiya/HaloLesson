import { APP_VERSION, isSubjectIcon, MAX_AVATAR_LENGTH, SUBJECT_COLORS, type ItemKind, type Settings, type SubjectColor, type User } from "@halolesson/shared";
import { resolve, sep } from "node:path";
import {
  adminCreateUser,
  adminUpdateUser,
  clearSessionCookie,
  deleteOwnAccount,
  deleteUser,
  endSession,
  ForbiddenError,
  listSessions,
  listUsers,
  login,
  register,
  revokeOtherSessions,
  revokeSession,
  sessionCookie,
  tokenFromRequest,
  updateAccount,
  userCount,
  userFromRequest,
} from "./auth";
import { handleMcp } from "./agent/mcp";
import { AgentError, commit, readLibrary, readProgress, readSubject, report } from "./agent/ops";
import { buildAgentPrompt, buildAgentSpec } from "./agent/prompt";
import { agentFromRequest, createAgentToken, listAgentTokens, RateLimitError, revokeAgentToken, type AgentAuth } from "./agent/tokens";
import { buildExport, getExportStats, importSubjects, parseImport } from "./dataExport";
import { eventStream, libraryChanged } from "./events";
import { getPracticeSession, submitAttempt } from "./practice";
import { getSettings, updateSettings } from "./settings";
import { copySharedSubject, createShareLink, getShareLink, getSharedSubject, revokeShareLink } from "./shares";
import { createFolder, getLibrary, moveItem, purgeTrash, restoreItem, setArchived, trashItem, updateFolder } from "./library";
import { createSubject, getSubject, listSubjects, updateSubject } from "./subjects";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

class UnauthorizedError extends Error {}

function requireUser(req: Request): User {
  const user = userFromRequest(req);
  if (!user) throw new UnauthorizedError();
  return user;
}

function requireAdmin(req: Request): User {
  const user = requireUser(req);
  if (!user.isAdmin) throw new ForbiddenError("Admins only");
  return user;
}

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (error instanceof ForbiddenError) return Response.json({ error: error.message }, { status: 403 });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const message = error instanceof Error ? error.message : "Something went wrong";
  const status = message.endsWith("not found") ? 404 : 400;
  return Response.json({ error: message }, { status });
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const value: unknown = await req.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request body");
  return value as Record<string, unknown>;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function itemKind(value: unknown): ItemKind {
  if (value === "subject" || value === "folder") return value;
  throw new Error("kind must be subject or folder");
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function optionalColor(value: unknown): SubjectColor | undefined {
  return SUBJECT_COLORS.includes(value as SubjectColor) ? (value as SubjectColor) : undefined;
}

// A write to the library structure (folders, order, archive, trash): run it,
// then tell every open tab and agent that the whole library changed.
async function libraryWrite(req: Request, run: (userId: string, input: Record<string, unknown>) => unknown, status = 200) {
  try {
    const user = requireUser(req);
    const result = run(user.id, await body(req));
    libraryChanged(user.id, null);
    return Response.json(result ?? { ok: true }, { status });
  } catch (error) {
    return errorResponse(error);
  }
}

function downloadName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "subject";
  return `halolesson-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

function jsonDownload(data: unknown, filename: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}

// Where agents should reach this server: the browser's origin when a user is
// creating a token, else whatever host the request came in on.
function publicOrigin(req: Request): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") return origin;
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

async function agentRoute(req: Request, handler: (auth: AgentAuth) => unknown, status = 200) {
  try {
    const auth = agentFromRequest(req);
    if (!auth) {
      return Response.json(
        { error: "Missing or revoked token. Ask the user to copy a new agent prompt", code: "UNAUTHORIZED" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      );
    }
    return Response.json(await handler(auth), { status });
  } catch (error) {
    if (error instanceof AgentError) return Response.json({ error: error.message, code: error.code, ...error.extra }, { status: error.status });
    if (error instanceof RateLimitError) return Response.json({ error: error.message, code: "RATE_LIMITED" }, { status: 429 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body", code: "INVALID" }, { status: 400 });
    const message = error instanceof Error ? error.message : "Something went wrong";
    return Response.json({ error: message, code: message.endsWith("not found") ? "NOT_FOUND" : "INVALID" }, { status: message.endsWith("not found") ? 404 : 400 });
  }
}

const webRoot = resolve(import.meta.dir, "../../web/dist");

const server = Bun.serve({
  port: Number(process.env.PORT) || 7246,
  // Above the event stream's 15s ping, so idle SSE connections stay open.
  idleTimeout: 30,
  routes: {
    "/api/health": () => Response.json({ status: "ok", version: APP_VERSION }),
    "/api/auth/register": {
      POST: async (req) => {
        try {
          const input = await body(req);
          const { user, token } = await register(
            stringField(input.username),
            stringField(input.password),
            input.email === null ? null : stringField(input.email),
            req.headers.get("user-agent"),
          );
          return Response.json(user, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/auth/login": {
      POST: async (req) => {
        try {
          const input = await body(req);
          const { user, token } = await login(stringField(input.identifier), stringField(input.password), req.headers.get("user-agent"));
          return Response.json(user, { headers: { "Set-Cookie": sessionCookie(token) } });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/auth/logout": {
      POST: (req) => {
        endSession(req);
        return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
      },
    },
    "/api/auth/me": (req) => {
      const user = userFromRequest(req);
      return user ? Response.json(user) : Response.json({ error: "Not signed in" }, { status: 401 });
    },
    "/api/settings": () => Response.json(getSettings()),
    "/api/setup-status": () => Response.json({ needsSetup: userCount() === 0 }),
    "/api/account": {
      PATCH: async (req) => {
        try {
          const user = requireUser(req);
          const input = await body(req);
          const avatar = input.avatar === null ? null : optionalString(input.avatar);
          if (avatar && (avatar.length > MAX_AVATAR_LENGTH || !/^data:image\/(png|jpeg|webp);base64,/.test(avatar))) {
            throw new Error("Avatar must be a PNG, JPEG or WebP image under 400 KB");
          }
          return Response.json(await updateAccount(user.id, tokenFromRequest(req), {
            username: optionalString(input.username),
            email: input.email === null ? null : optionalString(input.email),
            password: optionalString(input.password) || undefined,
            avatar,
            accentColor: input.accentColor === null ? null : optionalString(input.accentColor),
            currentPassword: optionalString(input.currentPassword),
          }));
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async (req) => {
        try {
          const user = requireUser(req);
          const input = await body(req);
          await deleteOwnAccount(user.id, stringField(input.currentPassword));
          return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/account/sessions": {
      GET: (req) => {
        try {
          return Response.json(listSessions(requireUser(req).id, tokenFromRequest(req)));
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: (req) => {
        try {
          revokeOtherSessions(requireUser(req).id, tokenFromRequest(req));
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/account/sessions/:id": {
      DELETE: (req) => {
        try {
          revokeSession(requireUser(req).id, req.params.id);
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/export/stats": (req) => {
      try {
        return Response.json(getExportStats(requireUser(req).id));
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/export": (req) => {
      try {
        const user = requireUser(req);
        return jsonDownload(buildExport(user.id), `halolesson-backup-${new Date().toISOString().slice(0, 10)}.json`);
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/import": {
      POST: async (req) => {
        try {
          const user = requireUser(req);
          if (Number(req.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES) throw new Error("Import files must be 10 MB or smaller");
          const raw = await req.text();
          if (raw.length > MAX_IMPORT_BYTES) throw new Error("Import files must be 10 MB or smaller");
          const { folders, subjects } = parseImport(JSON.parse(raw));
          const result = importSubjects(user.id, subjects, folders);
          libraryChanged(user.id, null);
          return Response.json(result, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/admin/users": {
      GET: (req) => {
        try {
          requireAdmin(req);
          return Response.json(listUsers());
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: async (req) => {
        try {
          requireAdmin(req);
          const input = await body(req);
          const user = await adminCreateUser(
            stringField(input.username),
            stringField(input.password),
            stringField(input.email) || null,
            input.isAdmin === true,
          );
          return Response.json(user, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/admin/users/:id": {
      PATCH: async (req) => {
        try {
          const admin = requireAdmin(req);
          const input = await body(req);
          return Response.json(await adminUpdateUser(admin.id, req.params.id, {
            isAdmin: typeof input.isAdmin === "boolean" ? input.isAdmin : undefined,
            password: optionalString(input.password) || undefined,
          }));
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: (req) => {
        try {
          const admin = requireAdmin(req);
          if (req.params.id === admin.id) throw new Error("Delete your own account from Account settings");
          deleteUser(req.params.id);
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/admin/settings": {
      PATCH: async (req) => {
        try {
          requireAdmin(req);
          const input = await body(req);
          const updates: Partial<Settings> = {};
          for (const key of ["signupEnabled", "requireStrongPasswords", "requireEmail"] as const) {
            if (typeof input[key] === "boolean") updates[key] = input[key];
          }
          return Response.json(updateSettings(updates));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/events": (req) => {
      try {
        return eventStream(req, requireUser(req).id);
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/agent/tokens": {
      GET: (req) => {
        try {
          return Response.json(listAgentTokens(requireUser(req).id));
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: async (req) => {
        try {
          const user = requireUser(req);
          const input = await body(req);
          const topic = stringField(input.topic).trim().slice(0, 200);
          const { token, secret } = createAgentToken(user.id, stringField(input.name) || topic || "Agent");
          return Response.json({ token, secret, prompt: buildAgentPrompt(publicOrigin(req), secret, topic) }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/agent/tokens/:id": {
      DELETE: (req) => {
        try {
          revokeAgentToken(requireUser(req).id, req.params.id);
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/agent/spec": (req) => new Response(buildAgentSpec(publicOrigin(req)), { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
    "/api/agent/library": (req) => agentRoute(req, (auth) => readLibrary(auth.user.id)),
    "/api/agent/subjects/:id": (req) => agentRoute(req, (auth) => readSubject(auth.user.id, req.params.id)),
    "/api/agent/progress": (req) => agentRoute(req, (auth) => readProgress(auth.user.id, new URL(req.url).searchParams.get("subjectId") || undefined)),
    "/api/agent/commits": {
      POST: (req) => agentRoute(req, async (auth) => commit(auth.user.id, await req.json())),
    },
    "/api/agent/reports": {
      POST: (req) => agentRoute(req, async (auth) => report(auth.user.id, auth.tokenId, await req.json()), 201),
    },
    "/mcp": handleMcp,
    "/api/subjects": {
      GET: (req) => {
        try {
          return Response.json(listSubjects(requireUser(req).id));
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: async (req) => {
        try {
          const user = requireUser(req);
          const input = await body(req);
          const color = SUBJECT_COLORS.includes(input.color as SubjectColor) ? (input.color as SubjectColor) : "green";
          const subject = createSubject(
            user.id,
            stringField(input.name),
            stringField(input.description),
            color,
            stringField(input.gradientStart) || "#58cc02",
            stringField(input.gradientEnd) || "#1cb0f6",
            { icon: isSubjectIcon(input.icon) ? input.icon : null, folderId: optionalId(input.folderId) },
          );
          libraryChanged(user.id, subject.id);
          return Response.json(subject, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/subjects/:id": {
      GET: (req) => {
        try {
          return Response.json(getSubject(requireUser(req).id, req.params.id));
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: (req) =>
        libraryWrite(req, (userId, input) =>
          updateSubject(userId, req.params.id, {
            name: optionalString(input.name),
            description: optionalString(input.description),
            color: optionalColor(input.color),
            gradientStart: optionalString(input.gradientStart),
            gradientEnd: optionalString(input.gradientEnd),
            icon: input.icon === null ? null : isSubjectIcon(input.icon) ? input.icon : undefined,
          }),
        ),
    },
    "/api/library": {
      GET: (req) => {
        try {
          return Response.json(getLibrary(requireUser(req).id));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/folders": {
      POST: (req) => libraryWrite(req, (userId, input) => createFolder(userId, stringField(input.name), optionalString(input.color), optionalId(input.parentId)), 201),
    },
    "/api/folders/:id": {
      PATCH: (req) => libraryWrite(req, (userId, input) => updateFolder(userId, req.params.id, { name: optionalString(input.name), color: optionalString(input.color) })),
    },
    "/api/library/move": {
      POST: (req) =>
        libraryWrite(req, (userId, input) =>
          moveItem(userId, itemKind(input.kind), stringField(input.id), optionalId(input.parentId), typeof input.index === "number" ? input.index : undefined),
        ),
    },
    "/api/library/archive": {
      POST: (req) => libraryWrite(req, (userId, input) => setArchived(userId, itemKind(input.kind), stringField(input.id), input.archived !== false)),
    },
    // Trash and restore only: nothing here (or anywhere) deletes permanently.
    // The 30-day purge below is the only way trashed items are ever removed.
    "/api/library/trash": {
      POST: (req) => libraryWrite(req, (userId, input) => trashItem(userId, itemKind(input.kind), stringField(input.id))),
    },
    "/api/library/restore": {
      POST: (req) => libraryWrite(req, (userId, input) => restoreItem(userId, itemKind(input.kind), stringField(input.id))),
    },
    "/api/subjects/:id/export": (req) => {
      try {
        const file = buildExport(requireUser(req).id, req.params.id);
        return jsonDownload(file, downloadName(file.subjects[0]!.name));
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/subjects/:id/share": {
      GET: (req) => {
        try {
          return Response.json({ link: getShareLink(requireUser(req).id, req.params.id) });
        } catch (error) {
          return errorResponse(error);
        }
      },
      POST: (req) => {
        try {
          return Response.json({ link: createShareLink(requireUser(req).id, req.params.id) });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: (req) => {
        try {
          revokeShareLink(requireUser(req).id, req.params.id);
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/shared/:token": (req) => {
      try {
        return Response.json(getSharedSubject(requireUser(req).id, req.params.token));
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/shared/:token/copy": {
      POST: (req) => {
        try {
          const user = requireUser(req);
          const subject = copySharedSubject(user.id, req.params.token);
          libraryChanged(user.id, subject.id);
          return Response.json(subject, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    "/api/skills/:id/practice": (req) => {
      try {
        return Response.json(getPracticeSession(requireUser(req).id, req.params.id));
      } catch (error) {
        return errorResponse(error);
      }
    },
    "/api/exercises/:id/attempt": {
      POST: async (req) => {
        try {
          const input = await body(req);
          return Response.json(submitAttempt(requireUser(req).id, req.params.id, input.answer));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
  async fetch(req) {
    const pathname = decodeURIComponent(new URL(req.url).pathname);
    if (pathname.startsWith("/api/")) return Response.json({ error: "Not found" }, { status: 404 });

    if (pathname !== "/") {
      const path = resolve(webRoot, `.${pathname}`);
      if (!path.startsWith(`${webRoot}${sep}`)) return new Response("Forbidden", { status: 403 });
      const file = Bun.file(path);
      if (await file.exists()) return new Response(file);
    }
    const index = Bun.file(resolve(webRoot, "index.html"));
    if (await index.exists()) return new Response(index);
    return new Response("Web app not built. Run bun run build or use the Vite dev server.", { status: 503 });
  },
});

purgeTrash();
setInterval(() => purgeTrash(), 60 * 60 * 1000).unref();

console.log(`haloLesson server listening on http://localhost:${server.port}`);
