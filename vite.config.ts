import {
  readdirSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  createReadStream,
  createWriteStream,
} from "node:fs";
import { join, extname, resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";
import { mergeComics } from "./src/lib/comics/sync.ts";
import {
  readComicsFromDisk,
  atomicWriteJsonSync,
  DEFAULT_STORAGE_PATH,
} from "./src/lib/comics/sync-node.ts";
import type { Comic } from "./src/lib/comics/types.ts";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

function parseJsonBody<T>(req: NodeJS.ReadableStream): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer | string) => {
      data += chunk;
      if (data.length > 50 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as T) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function inkframeSyncPlugin(): Plugin {
  return {
    name: "app-builder:inkframe-sync",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const pathOnly = rawUrl.split("?", 1)[0] ?? "";
        const method = (req.method ?? "GET").toUpperCase();

        const assetPrefix = "/__inkframe/assets/";
        if (pathOnly.startsWith(assetPrefix)) {
          const assetId = pathOnly.slice(assetPrefix.length);
          if (!assetId || assetId.includes("..") || assetId.includes("/")) {
            res.statusCode = 400;
            res.end("Invalid asset ID");
            return;
          }

          const assetsDir = resolve(process.cwd(), ".inkframe/assets");

          try {
            if (method === "GET") {
              if (!existsSync(assetsDir)) {
                res.statusCode = 404;
                res.end("Not Found");
                return;
              }
              const files = readdirSync(assetsDir);
              const matched = files.find((f) => f === assetId || f.startsWith(`${assetId}.`));
              if (!matched) {
                res.statusCode = 404;
                res.end("Not Found");
                return;
              }
              const filePath = join(assetsDir, matched);
              const ext = extname(matched).toLowerCase();
              const mimeMap: Record<string, string> = {
                ".webp": "image/webp",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
              };
              res.statusCode = 200;
              res.setHeader("content-type", mimeMap[ext] ?? "image/webp");
              res.setHeader("cache-control", "public, max-age=31536000, immutable");
              createReadStream(filePath).pipe(res);
              return;
            }

            if (method === "PUT") {
              mkdirSync(assetsDir, { recursive: true });
              const contentType = String(req.headers["content-type"] ?? "image/webp");
              const extMap: Record<string, string> = {
                "image/webp": ".webp",
                "image/png": ".png",
                "image/jpeg": ".jpg",
                "image/jpg": ".jpg",
                "image/gif": ".gif",
                "image/svg+xml": ".svg",
              };
              const ext = extMap[contentType.toLowerCase()] ?? ".webp";
              const filePath = join(assetsDir, `${assetId}${ext}`);
              const ws = createWriteStream(filePath);
              req.pipe(ws);
              ws.on("finish", () => {
                res.statusCode = 200;
                res.setHeader("content-type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ ok: true, id: assetId, path: `asset:${assetId}` }));
              });
              ws.on("error", (err) => {
                console.error("[inkframe-sync] Asset write error:", err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end("Write failed");
                }
              });
              return;
            }

            if (method === "DELETE") {
              if (existsSync(assetsDir)) {
                const files = readdirSync(assetsDir);
                for (const f of files) {
                  if (f === assetId || f.startsWith(`${assetId}.`)) {
                    unlinkSync(join(assetsDir, f));
                  }
                }
              }
              res.statusCode = 200;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          } catch (err) {
            console.error("[inkframe-sync] Asset handler error:", err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end("Internal Error");
            }
            return;
          }
        }

        if (pathOnly !== "/__inkframe/comics") {
          next();
          return;
        }

        try {
          if (method === "GET") {
            const comics = readComicsFromDisk();
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(JSON.stringify({ comics, deletedIds: [] }));
            return;
          }

          if (method === "PUT") {
            const body = await parseJsonBody<{ comics?: Comic[]; deletedIds?: string[] }>(req);
            const diskComics = readComicsFromDisk();
            const incomingComics = Array.isArray(body.comics) ? body.comics : [];
            const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];

            const { merged } = mergeComics(diskComics, incomingComics, deletedIds);
            atomicWriteJsonSync(DEFAULT_STORAGE_PATH, merged);

            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(JSON.stringify({ ok: true, comics: merged }));
            return;
          }

          res.statusCode = 405;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Method Not Allowed");
        } catch (err) {
          console.error("[inkframe-sync] Error handling /__inkframe/comics:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Sync error" }));
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only two-way sync for MCP and browser.
    inkframeSyncPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
