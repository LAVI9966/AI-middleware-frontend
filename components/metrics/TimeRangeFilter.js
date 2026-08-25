import { memo, useState, useMemo } from "react";
import { METRICS_TIME_RANGE_OPTIONS } from "@/utils/enums";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "@/components/Icons";

const CUSTOM_RANGE = 10;
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const closeDropdown = (event) => {
  event.currentTarget.closest("details")?.removeAttribute("open");
};

const isSameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const buildMonthCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
};

const formatCustomLabel = (start, end) => {
  if (!start || !end) return "Custom Range";
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} - ${endStr}`;
};

const MonthGrid = memo(({ monthDate, pickStart, pickEnd, onPickDay, onNav, showPrevNav, showNextNav }) => {
  const cells = useMemo(() => buildMonthCells(monthDate), [monthDate]);
  const today = new Date();
  const label = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onNav(-1)}
          className={`btn btn-ghost btn-xs btn-circle ${showPrevNav ? "" : "invisible"}`}
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-semibold">{label}</span>
        <button
          type="button"
          onClick={() => onNav(1)}
          className={`btn btn-ghost btn-xs btn-circle ${showNextNav ? "" : "invisible"}`}
        >
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] text-center text-base-content/50 font-semibold py-1">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="aspect-square" />;
          const inRange = pickStart && pickEnd && date > pickStart && date < pickEnd;
          const isStart = isSameDay(date, pickStart);
          const isEnd = isSameDay(date, pickEnd);
          const isToday = isSameDay(date, today);
          const isFuture = date > today;
          return (
            <button
              type="button"
              key={date.toISOString()}
              disabled={isFuture}
              onClick={() => onPickDay(date)}
              className={[
                "aspect-square rounded-md text-xs flex items-center justify-center",
                isFuture ? "text-base-content/20 cursor-not-allowed" : "hover:bg-base-300 cursor-pointer",
                inRange ? "bg-primary/10" : "",
                isStart || isEnd ? "bg-primary text-primary-content font-semibold" : "",
                isToday && !isStart && !isEnd ? "ring-1 ring-primary" : "",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
});
MonthGrid.displayName = "MonthGrid";

// Time Range filter: same trigger styling as the other FilterDropdowns, but
// its popup combines the preset list with a two-month calendar grid (for the
// custom range option, the existing "custom start/end date" mode that
// useMetricsData already supports but no UI control previously reached).
const TimeRangeFilter = memo(({ range, customStartDate, customEndDate, onPresetChange, onCustomRangeApply }) => {
  const [calMonth0, setCalMonth0] = useState(() => {
    const base = customStartDate ? new Date(customStartDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth() - 1, 1);
  });
  const [pickStart, setPickStart] = useState(customStartDate ? new Date(customStartDate) : null);
  const [pickEnd, setPickEnd] = useState(customEndDate ? new Date(customEndDate) : null);

  const isCustom = range === CUSTOM_RANGE;
  const selectedPreset = METRICS_TIME_RANGE_OPTIONS.find((opt) => opt.range === range);
  const label = isCustom ? formatCustomLabel(customStartDate, customEndDate) : selectedPreset?.label || "Select Range";

  const handleNav = (dir) => setCalMonth0((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));

  const handlePickDay = (date) => {
    if (!pickStart || (pickStart && pickEnd)) {
      setPickStart(date);
      setPickEnd(null);
    } else if (date < pickStart) {
      setPickStart(date);
    } else {
      setPickEnd(date);
    }
  };

  const handleApply = (event) => {
    if (pickStart && pickEnd) {
      onCustomRangeApply(pickStart, pickEnd);
      closeDropdown(event);
    }
  };

  const rightMonth = new Date(calMonth0.getFullYear(), calMonth0.getMonth() + 1, 1);

  return (
    <details
      data-testid="metrics-filter-time-range"
      className="dropdown"
      tabIndex={0}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          e.currentTarget.removeAttribute("open");
        }
      }}
    >
      <summary className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary bg-primary/10 text-[13px] font-medium text-base-content cursor-pointer select-none">
        <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate max-w-[180px]">{label}</span>
        <ChevronDownIcon className="w-3 h-3 flex-shrink-0 text-base-content/50" />
      </summary>

      <div className="dropdown-content z-high mt-2 shadow-lg bg-base-100 rounded-box border border-base-300 flex">
        <ul className="menu p-2 w-40 flex-shrink-0 border-r border-base-300">
          {METRICS_TIME_RANGE_OPTIONS.map((opt) => (
            <li key={opt.range}>
              <a
                className={`block truncate ${
                  (!isCustom && range === opt.range) || (isCustom && opt.range === CUSTOM_RANGE)
                    ? "bg-primary/10 text-primary font-semibold"
                    : ""
                }`}
                onClick={(e) => {
                  if (opt.range === CUSTOM_RANGE) return; // applied via the calendar's own Apply button instead
                  onPresetChange(opt.range);
                  closeDropdown(e);
                }}
              >
                {opt.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="p-3 w-[380px]">
          <div className="flex gap-4">
            <MonthGrid
              monthDate={calMonth0}
              pickStart={pickStart}
              pickEnd={pickEnd}
              onPickDay={handlePickDay}
              onNav={handleNav}
              showPrevNav
              showNextNav={false}
            />
            <MonthGrid
              monthDate={rightMonth}
              pickStart={pickStart}
              pickEnd={pickEnd}
              onPickDay={handlePickDay}
              onNav={handleNav}
              showPrevNav={false}
              showNextNav
            />
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
            <span className="text-xs text-base-content/60 font-mono">
              {pickStart && pickEnd
                ? `${pickStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${pickEnd.toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}`
                : pickStart
                  ? `${pickStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - select end date`
                  : "Select a start and end date"}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!pickStart || !pickEnd}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </details>
  );
});

TimeRangeFilter.displayName = "TimeRangeFilter";

export default TimeRangeFilter;
