// Production Node server. Serves static assets from dist/client and delegates
// everything else (SSR pages + /api routes) to the TanStack Start fetch handler
// built into dist/server/server.js. Importing that handler also boots the
// in-process reminder scheduler (see src/server.ts).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import handler from "./dist/server/server.js";

const CLIENT_DIR = join(process.cwd(), "dist", "client");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".html": "text/html",
};

async function tryStatic(pathname) {
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^\/+/, "");
  const filePath = join(CLIENT_DIR, rel);
  if (!filePath.startsWith(CLIENT_DIR)) return null;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const body = await readFile(filePath);
    const ext = extname(filePath);
    const headers = { "content-type": MIME[ext] ?? "application/octet-stream" };
    // Hashed build assets never change; favicons/manifest get a one-day cache.
    headers["cache-control"] = rel.startsWith("assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=86400";
    return { body, headers };
  } catch {
    return null;
  }
}

function toWebRequest(req, url) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeWebResponse(res, webRes) {
  const headers = {};
  webRes.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webRes.status, headers);
  if (webRes.body) {
    const reader = webRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname !== "/") {
      const asset = await tryStatic(url.pathname);
      if (asset) {
        res.writeHead(200, asset.headers);
        res.end(req.method === "HEAD" ? undefined : asset.body);
        return;
      }
    }

    const webRes = await handler.fetch(toWebRequest(req, url));
    await writeWebResponse(res, webRes);
  } catch (err) {
    console.error("[server] request error:", err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.info(`[server] DiaTrack listening on :${PORT}`);
});
