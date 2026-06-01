import { writeFile } from "node:fs/promises";
import { buildWeekPayload } from "../functions/_shared/notion.js";

const required = [
  "NOTION_API_KEY",
  "NOTION_MAIN_DATA_SOURCE_ID",
  "NOTION_FIXED_DATA_SOURCE_ID"
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const payload = await buildWeekPayload(process.env);
const text = `${JSON.stringify(payload, null, 2)}\n`;

await writeFile(new URL("../public/mock-week.json", import.meta.url), text, "utf8");

console.log("Synced public/mock-week.json from Notion");
