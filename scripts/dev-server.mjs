import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeekPayload } from "../functions/_shared/notion.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = normalize(join(__dirname, ".."));
const publicDir = join(rootDir, "public");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === "/api/week") {
      await handleWeekApi(res);
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(publicDir, pathname));
    const contents = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(contents);
  } catch (error) {
    if (req.url?.startsWith("/api/week")) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "LOCAL_DEV_FAILED", message: String(error) }));
      return;
    }

    try {
      const fallback = await readFile(join(publicDir, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fallback);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  }
}).listen(port, () => {
  console.log(`Week planner dev server running at http://localhost:${port}`);
});

async function handleWeekApi(res) {
  const hasNotionEnv = process.env.NOTION_API_KEY && process.env.NOTION_MAIN_DATA_SOURCE_ID;

  if (!hasNotionEnv) {
    const mock = await readFile(join(publicDir, "mock-week.json"), "utf8");
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(mock);
    return;
  }

  const payload = await buildWeekPayload(process.env);
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}
