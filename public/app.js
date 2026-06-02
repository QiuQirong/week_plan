const TYPE_META = {
  course: { label: "学校课程", className: "type-course", color: "#6aa9ff" },
  gridPrep: { label: "国网备考", className: "type-grid", color: "#f3a64f" },
  exam: { label: "学校考试", className: "type-exam", color: "#ea7373" },
  fitness: { label: "健身", className: "type-fitness", color: "#7bc363" },
  social: { label: "社交", className: "type-social", color: "#dcb22c" },
  project: { label: "项目任务 / 项目固定块", className: "type-project", color: "#a27ae8" },
  life: { label: "生活杂务", className: "type-life", color: "#9f9488" },
  rest: { label: "休息", className: "type-rest", color: "#8f6a43" }
};

const HOURS = Array.from({ length: 18 }, (_, index) => 6 + index);

const plannerEl = document.querySelector("#planner");
const legendEl = document.querySelector("#legend");
const weekLabelEl = document.querySelector("#weekLabel");
const sourceLabelEl = document.querySelector("#sourceLabel");
const updatedAtLabelEl = document.querySelector("#updatedAtLabel");
const refreshButtonEl = document.querySelector("#refreshButton");
const themeToggleButtonEl = document.querySelector("#themeToggleButton");

const THEME_STORAGE_KEY = "notion-week-planner-theme";
const API_URL = "./api/week";
const MOCK_URL = "./mock-week.json";

bootTheme();

refreshButtonEl.addEventListener("click", () => {
  void loadWeek({ force: true });
});

themeToggleButtonEl.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
});

void loadWeek();

async function loadWeek({ force = false } = {}) {
  plannerEl.innerHTML = `<div class="planner-loading">${force ? "正在刷新..." : "正在读取本周安排..."}</div>`;

  const suffix = force ? `?ts=${Date.now()}` : "";

  try {
    let response = await fetch(`${API_URL}${suffix}`, { cache: "no-store" });
    if (!response.ok) {
      response = await fetch(`${MOCK_URL}${suffix}`, { cache: "no-store" });
    }
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const payload = await response.json();
    renderWeek(payload);
  } catch (error) {
    console.error(error);
    plannerEl.innerHTML = `<div class="planner-empty">读取失败了。先检查部署和 Notion 配置，再试一次。</div>`;
  }
}

function renderWeek(payload) {
  const { days, items, weekLabel, updatedAtLabel, sources, legend } = payload;

  weekLabelEl.textContent = weekLabel;
  sourceLabelEl.textContent = Array.isArray(sources) ? sources.join(" + ") : "Notion 主库";
  updatedAtLabelEl.textContent = updatedAtLabel;

  renderLegend(legend);

  if (!items.length) {
    plannerEl.innerHTML = `<div class="planner-empty">这周还没有安排。先去 Notion 主库里加几条课程或计划吧。</div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "planner-grid";

  const cornerCell = document.createElement("div");
  cornerCell.className = "corner-cell";
  cornerCell.innerHTML = "<span>时间</span>";
  grid.append(cornerCell);

  days.forEach((day) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.innerHTML = `
      <span class="date-label">${day.dateLabel}</span>
      <span class="day-label">${day.dayLabel}</span>
      <span class="completion">${day.summary}</span>
    `;
    grid.append(header);
  });

  const timeColumn = document.createElement("div");
  timeColumn.className = "time-column";

  HOURS.forEach((hour) => {
    const timeCell = document.createElement("div");
    timeCell.className = "time-cell";
    timeCell.innerHTML = `<span>${formatHour(hour)}</span>`;
    timeColumn.append(timeCell);
  });

  grid.append(timeColumn);

  days.forEach((day) => {
    grid.append(createDayColumn(day, items));
  });

  plannerEl.innerHTML = "";
  plannerEl.append(grid);
}

function createDayColumn(day, items) {
  const column = document.createElement("div");
  column.className = "day-column";

  const dayItems = layoutDayItems(items.filter((item) => item.dateKey === day.dateKey));

  dayItems.forEach(({ item, laneIndex, laneCount }) => {
    const block = document.createElement("article");
    block.className = `event-block ${TYPE_META[item.typeKey]?.className ?? "type-life"}`;

    const startMinute = resolveStartMinute(item);
    const endMinute = resolveEndMinute(item);
    const startHour = startMinute / 60;
    const endHour = endMinute / 60;
    const top = Math.max(0, startHour - 6) * 72;
    const height = Math.max(44, (endHour - startHour) * 72 - 6);
    const horizontalGap = 6;
    const inset = 8;
    const usableWidth = `calc(100% - ${inset * 2}px)`;
    const width =
      laneCount > 1
        ? `calc((${usableWidth} - ${(laneCount - 1) * horizontalGap}px) / ${laneCount})`
        : usableWidth;
    const left = laneCount > 1 ? `calc(${inset}px + ${laneIndex} * (${width} + ${horizontalGap}px))` : `${inset}px`;

    block.style.top = `${top + 4}px`;
    block.style.height = `${height}px`;
    block.style.left = left;
    block.style.width = width;
    block.style.right = "auto";
    block.style.zIndex = String(10 + laneIndex);
    block.innerHTML = `
      <span class="event-time">${item.timeLabel}</span>
      <span class="event-title">${escapeHtml(item.title)}</span>
      <span class="event-meta">${TYPE_META[item.typeKey]?.label ?? item.typeLabel}</span>
    `;
    column.append(block);
  });

  return column;
}

function renderLegend(items) {
  legendEl.innerHTML = "";
  const template = document.querySelector("#legendItemTemplate");

  items.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".legend-dot").style.setProperty("--legend-color", item.color);
    node.querySelector(".legend-text").textContent = item.label;
    legendEl.append(node);
  });
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function layoutDayItems(items) {
  const sorted = [...items].sort((left, right) => {
    const startDiff = resolveStartMinute(left) - resolveStartMinute(right);
    if (startDiff !== 0) return startDiff;

    const endDiff = resolveEndMinute(right) - resolveEndMinute(left);
    if (endDiff !== 0) return endDiff;

    return left.title.localeCompare(right.title, "zh-CN");
  });

  const laidOut = [];
  let group = [];
  let groupEndMinute = -1;

  const flushGroup = () => {
    if (!group.length) return;

    const laneEnds = [];
    const groupLayouts = group.map((item) => {
      const startMinute = resolveStartMinute(item);
      const endMinute = resolveEndMinute(item);
      let laneIndex = laneEnds.findIndex((laneEndMinute) => startMinute >= laneEndMinute);

      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(endMinute);
      } else {
        laneEnds[laneIndex] = endMinute;
      }

      return { item, laneIndex };
    });

    const laneCount = Math.max(1, laneEnds.length);
    groupLayouts.forEach((entry) => {
      laidOut.push({
        item: entry.item,
        laneIndex: entry.laneIndex,
        laneCount
      });
    });

    group = [];
    groupEndMinute = -1;
  };

  sorted.forEach((item) => {
    const startMinute = resolveStartMinute(item);
    const endMinute = resolveEndMinute(item);

    if (!group.length || startMinute < groupEndMinute) {
      group.push(item);
      groupEndMinute = Math.max(groupEndMinute, endMinute);
      return;
    }

    flushGroup();
    group.push(item);
    groupEndMinute = endMinute;
  });

  flushGroup();
  return laidOut;
}

function bootTheme() {
  const urlTheme = new URL(window.location.href).searchParams.get("theme");
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const theme =
    urlTheme === "light" || urlTheme === "dark"
      ? urlTheme
      : savedTheme || "dark";
  applyTheme(theme, { persist: false });
}

function applyTheme(theme, { persist = true } = {}) {
  document.body.dataset.theme = theme;
  themeToggleButtonEl.textContent = theme === "dark" ? "浅色" : "深色";

  const themeColor = theme === "dark" ? "#121212" : "#f7f3ea";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);

  if (persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function minutesFromIso(iso) {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function resolveStartMinute(item) {
  return item.startMinute ?? minutesFromIso(item.start);
}

function resolveEndMinute(item) {
  const startMinute = resolveStartMinute(item);
  const rawEndMinute = item.endMinute ?? minutesFromIso(item.end);
  return rawEndMinute > startMinute ? rawEndMinute : startMinute + 60;
}

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
