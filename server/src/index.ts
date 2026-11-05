import { APP_VERSION, SUBJECT_COLORS, type SubjectColor, type User } from "@halolesson/shared";
import { resolve, sep } from "node:path";
import { clearSessionCookie, endSession, login, register, sessionCookie, userFromRequest } from "./auth";
import { getPracticeSession, submitAttempt } from "./practice";
import { createSubject, getSubject, listSubjects } from "./subjects";

class UnauthorizedError extends Error {}

function requireUser(req: Request): User {
  const user = userFromRequest(req);
  if (!user) throw new UnauthorizedError();
  return user;
}

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  const message = error instanceof Error ? error.message : "Something went wrong";
  const status = message === "Subject not found" ? 404 : 400;
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

const webRoot = resolve(import.meta.dir, "../../web/dist");

const server = Bun.serve({
  port: Number(process.env.PORT) || 7246,
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
          const { user, token } = await login(stringField(input.identifier), stringField(input.password));
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
          return Response.json(
            createSubject(
              user.id,
              stringField(input.name),
              stringField(input.description),
              color,
              stringField(input.gradientStart) || "#58cc02",
              stringField(input.gradientEnd) || "#1cb0f6",
            ),
            { status: 201 },
          );
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

console.log(`haloLesson server listening on http://localhost:${server.port}`);
