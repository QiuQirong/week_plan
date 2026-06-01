const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function getWeekWindow(now = new Date(), timeZone = "Asia/Shanghai") {
  const zoned = zonedDateParts(now, timeZone);
  const localMidnight = new Date(`${zoned.dateKey}T00:00:00+08:00`);
  const day = zoned.weekday;

  // 周日时显示下一周；其余时间显示本周。
  const offsetToMonday = day === 0 ? 1 : 1 - day;
  const start = new Date(localMidnight.getTime() + offsetToMonday * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);

  return {
    start,
    end,
    days: Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start.getTime() + index * DAY_MS);
      const parts = zonedDateParts(current, timeZone);
      return {
        date: current,
        dateKey: parts.dateKey,
        dateLabel: parts.dateLabel,
        dayLabel: WEEKDAY_LABELS[parts.weekday]
      };
    })
  };
}

export function zonedDateParts(date, timeZone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const weekdayMap = {
    周日: 0,
    周一: 1,
    周二: 2,
    周三: 3,
    周四: 4,
    周五: 5,
    周六: 6
  };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    dateLabel: `${parts.year}/${parts.month}/${parts.day}`
  };
}

export function dateKeyInTimeZone(date, timeZone = "Asia/Shanghai") {
  return zonedDateParts(date, timeZone).dateKey;
}

export function formatWeekLabel(start, end, timeZone = "Asia/Shanghai") {
  return `${zonedDateParts(start, timeZone).dateLabel} - ${zonedDateParts(end, timeZone).dateLabel}`;
}

export function formatDateTimeLabel(date, timeZone = "Asia/Shanghai") {
  const parts = zonedDateParts(date, timeZone);
  return `${parts.dateLabel} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatClockLabel(date, timeZone = "Asia/Shanghai") {
  const parts = zonedDateParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function minutesIntoDay(date, timeZone = "Asia/Shanghai") {
  const parts = zonedDateParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function combineDateAndClock(dateKey, clock, timeZone = "Asia/Shanghai") {
  const safeClock = normalizeClock(clock);
  const offset = timeZone === "Asia/Shanghai" ? "+08:00" : "Z";
  return new Date(`${dateKey}T${safeClock}:00${offset}`);
}

export function normalizeClock(value) {
  if (!value) return "00:00";

  const cleaned = String(value).trim().replaceAll("：", ":");
  if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
    const [hour, minute] = cleaned.split(":");
    return `${hour.padStart(2, "0")}:${minute}`;
  }
  if (/^\d{1,2}$/.test(cleaned)) {
    return `${cleaned.padStart(2, "0")}:00`;
  }
  return "00:00";
}
