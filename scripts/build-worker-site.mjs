import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

const workerTemplate = await readFile(path.join(publicDir, "_worker.js"), "utf8");
const indexHtml = await readFile(path.join(publicDir, "index.html"), "utf8");
const stylesCss = await readFile(path.join(publicDir, "styles.css"), "utf8");
const appJs = await readFile(path.join(publicDir, "app.js"), "utf8");
const mockWeekJson = await readFile(path.join(publicDir, "mock-week.json"), "utf8");

const patchedWorker = workerTemplate.replace(
  "    return env.ASSETS.fetch(request);",
  "    return serveAsset(url.pathname);"
);

if (patchedWorker === workerTemplate) {
  throw new Error("Failed to patch asset handling in public/_worker.js");
}

const assetMap = [
  ["/", indexHtml, "text/html; charset=utf-8"],
  ["/index.html", indexHtml, "text/html; charset=utf-8"],
  ["/styles.css", stylesCss, "text/css; charset=utf-8"],
  ["/app.js", appJs, "application/javascript; charset=utf-8"],
  ["/mock-week.json", mockWeekJson, "application/json; charset=utf-8"]
];

const assetHelpers = `

const STATIC_ASSETS = new Map(${JSON.stringify(assetMap)});

function serveAsset(pathname) {
  const normalizedPath = normalizeAssetPath(pathname);
  const asset = STATIC_ASSETS.get(normalizedPath);

  if (!asset) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  const [_, body, contentType] = asset;
  const cacheControl =
    normalizedPath === "/mock-week.json"
      ? "no-store"
      : normalizedPath === "/"
        ? "no-store"
        : "public, max-age=300";

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl
    }
  });
}

function normalizeAssetPath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  if (pathname.endsWith("/") && pathname.length > 1) {
    return pathname.slice(0, -1);
  }

  return pathname;
}
`;

await mkdir(distDir, { recursive: true });
await writeFile(path.join(distDir, "worker-site.mjs"), `${patchedWorker}${assetHelpers}`, "utf8");

console.log("Built dist/worker-site.mjs");
