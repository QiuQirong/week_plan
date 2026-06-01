import {
  combineDateAndClock,
  dateKeyInTimeZone,
  formatClockLabel,
  formatDateTimeLabel,
  formatWeekLabel,
  getWeekWindow,
  minutesIntoDay,
  normalizeClock
} from "./time.js";

const NOTION_VERSION = "2026-03-11";

const TYPE_MAP = {
  学校课程: "course",
  国网备考: "gridPrep",
  国网参考: "gridPrep",
  学校考试: "exam",
  健身: "fitness",
  社交: "social",
  项目任务: "project",
  项目固定块: "project",
  生活杂务: "life",
  休息: "rest"
};

const LEGEND = [
  { key: "course", label: "学校课程", color: "#6aa9ff" },
  { key: "gridPrep", label: "国网备考", color: "#f3a64f" },
  { key: "exam", label: "学校考试", color: "#ea7373" },
  { key: "fitness", label: "健身", color: "#7bc363" },
  { key: "social", label: "社交", color: "#dcb22c" },
  { key: "project", label: "项目任务 / 项目固定块", color: "#a27ae8" },
  { key: "life", label: "生活杂务", color: "#9f9488" },
  { key: "rest", label: "休息", color: "#8f6a43" }
];

export async function buildWeekPayload(env, options = {}) {
  const timeZone = env.TIMEZONE || "Asia/Shanghai";
  const now = options.now ? new Date(options.now) : new Date();
  const week = getWeekWindow(now, timeZone);
  const notion = createNotionClient(env.NOTION_API_KEY);

  const mainRows = env.NOTION_MAIN_DATA_SOURCE_ID
    ? await queryDataSource(notion, env.NOTION_MAIN_DATA_SOURCE_ID)
    : [];
  const fixedRows = env.NOTION_FIXED_DATA_SOURCE_ID
    ? await queryDataSource(notion, env.NOTION_FIXED_DATA_SOURCE_ID)
    : [];

  const items = [
    ...normalizeMainRows(mainRows, week, timeZone),
    ...normalizeFixedRows(fixedRows, week, timeZone)
  ]
    .filter(Boolean)
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const days = week.days.map((day) => ({
    ...day,
    summary: `${items.filter((item) => item.dateKey === day.dateKey).length} 项安排`
  }));

  return {
    weekLabel: formatWeekLabel(week.start, week.end, timeZone),
    updatedAtLabel: formatDateTimeLabel(now, timeZone),
    sources: fixedRows.length ? ["周时间轴 / 全部计划", "课程表 / 固定安排"] : ["周时间轴 / 全部计划"],
    legend: LEGEND,
    days,
    items
  };
}

export function createNotionClient(apiKey) {
  if (!apiKey) {
    throw new Error("Missing NOTION_API_KEY");
  }

  return {
    async queryDataSource(dataSourceId, body = {}) {
      const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Notion query failed (${response.status}): ${text}`);
      }

      return response.json();
    }
  };
}

export async function queryDataSource(notion, dataSourceId) {
  const results = [];
  let cursor = undefined;

  while (true) {
    const payload = await notion.queryDataSource(dataSourceId, {
      page_size: 100,
      start_cursor: cursor
    });

    results.push(...payload.results);

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    cursor = payload.next_cursor;
  }

  return results;
}

function normalizeMainRows(rows, week, timeZone) {
  return rows
    .map((page) => {
      const title = getTitle(page.properties);
      const typeLabel = getSelectLike(page.properties, ["类型", "来源"]) || "生活杂务";
      const dateValue = getDate(page.properties, ["日期", "时间", "时间块"]);
      const explicitStart = getTextLike(page.properties, ["开始时间"]);
      const explicitEnd = getTextLike(page.properties, ["结束时间"]);

      const rawStart = dateValue?.start ?? "";
      const rawEnd = dateValue?.end ?? "";
      const baseDateKey = rawStart ? rawStart.slice(0, 10) : "";

      let start = rawStart ? parseNotionDate(rawStart, explicitStart, timeZone) : null;
      let end = rawEnd ? parseNotionDate(rawEnd, explicitEnd, timeZone) : null;

      if (!start && baseDateKey && explicitStart) {
        start = combineDateAndClock(baseDateKey, explicitStart, timeZone);
      }
      if (!end && baseDateKey && explicitEnd) {
        end = combineDateAndClock(baseDateKey, explicitEnd, timeZone);
      }
      if (!end && start) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      if (!start || !end) {
        return null;
      }

      const dateKey = dateKeyInTimeZone(start, timeZone);
      if (!isInRenderedWeek(dateKey, week.days)) {
        return null;
      }

      return makeItem(page.id, title, typeLabel, start, end, dateKey);
    })
    .filter(Boolean);
}

function normalizeFixedRows(rows, week, timeZone) {
  return rows
    .map((page) => {
      const enabled = getCheckbox(page.properties, ["是否启用", "启用"]);
      if (!enabled) {
        return null;
      }

      const title = getTitle(page.properties);
      const typeLabel = getSelectLike(page.properties, ["类型", "来源"]) || "项目固定块";
      const specificDate = getDate(page.properties, ["本次日期", "日期"]);
      const weekday = getSelectLike(page.properties, ["星期"]);
      const startClock = getTextLike(page.properties, ["开始时间"]);
      const endClock = getTextLike(page.properties, ["结束时间"]);

      let dateKey = null;

      if (specificDate?.start) {
        dateKey = dateKeyInTimeZone(new Date(specificDate.start), timeZone);
      } else {
        const match = week.days.find((day) => day.dayLabel === weekday);
        dateKey = match?.dateKey ?? null;
      }

      if (!dateKey || !isInRenderedWeek(dateKey, week.days)) {
        return null;
      }

      const start = combineDateAndClock(dateKey, normalizeClock(startClock), timeZone);
      const end = endClock
        ? combineDateAndClock(dateKey, normalizeClock(endClock), timeZone)
        : new Date(start.getTime() + 60 * 60 * 1000);

      return makeItem(page.id, title, typeLabel, start, end, dateKey, timeZone);
    })
    .filter(Boolean);
}

function makeItem(id, title, typeLabel, start, end, dateKey, timeZone = "Asia/Shanghai") {
  return {
    id,
    title: simplifyTitle(title),
    typeLabel,
    typeKey: TYPE_MAP[typeLabel] || "life",
    dateKey,
    start: start.toISOString(),
    end: end.toISOString(),
    startMinute: minutesIntoDay(start, timeZone),
    endMinute: minutesIntoDay(end, timeZone),
    timeLabel: `${formatClockLabel(start, timeZone)} - ${formatClockLabel(end, timeZone)}`
  };
}

function getTitle(properties) {
  const titleProperty = Object.values(properties).find((property) => property.type === "title");
  return richTextToPlain(titleProperty?.title) || "未命名安排";
}

function getDate(properties, names) {
  const property = pickProperty(properties, names, "date");
  return property?.date ?? null;
}

function getCheckbox(properties, names) {
  const property = pickProperty(properties, names, "checkbox");
  return property?.checkbox ?? false;
}

function getSelectLike(properties, names) {
  const property = pickProperty(properties, names);
  if (!property) return "";

  if (property.type === "select") return property.select?.name ?? "";
  if (property.type === "status") return property.status?.name ?? "";
  if (property.type === "rich_text") return richTextToPlain(property.rich_text);
  if (property.type === "title") return richTextToPlain(property.title);
  if (property.type === "formula") {
    if (property.formula.type === "string") return property.formula.string ?? "";
  }
  return "";
}

function getTextLike(properties, names) {
  const property = pickProperty(properties, names);
  if (!property) return "";

  if (property.type === "rich_text") return richTextToPlain(property.rich_text);
  if (property.type === "title") return richTextToPlain(property.title);
  if (property.type === "select") return property.select?.name ?? "";
  if (property.type === "formula") {
    if (property.formula.type === "string") return property.formula.string ?? "";
    if (property.formula.type === "number") return String(property.formula.number ?? "");
  }
  return "";
}

function pickProperty(properties, names, forcedType) {
  for (const name of names) {
    const property = properties[name];
    if (!property) continue;
    if (!forcedType || property.type === forcedType) {
      return property;
    }
  }
  return null;
}

function richTextToPlain(nodes = []) {
  return nodes.map((node) => node.plain_text).join("").trim();
}

function simplifyTitle(title) {
  return title.replace(/^示例[:：]\s*/u, "").trim() || "未命名安排";
}

function isInRenderedWeek(dateKey, days) {
  return days.some((day) => day.dateKey === dateKey);
}

function parseNotionDate(rawValue, clockOverride, timeZone) {
  if (!rawValue) {
    return null;
  }

  if (/[Tt]\d{2}:\d{2}/.test(rawValue)) {
    return new Date(rawValue);
  }

  if (clockOverride) {
    return combineDateAndClock(rawValue.slice(0, 10), clockOverride, timeZone);
  }

  return combineDateAndClock(rawValue.slice(0, 10), "08:00", timeZone);
}
