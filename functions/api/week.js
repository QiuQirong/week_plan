import { buildWeekPayload } from "../_shared/notion.js";

export async function onRequestGet(context) {
  try {
    const payload = await buildWeekPayload(context.env);
    return json(payload);
  } catch (error) {
    console.error(error);
    return json(
      {
        error: "WEEK_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
