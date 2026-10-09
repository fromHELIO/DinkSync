import { useCallback, useRef, useState } from "react";
import useDismiss from "../hooks/useDismiss.js";
import { formatDisplay, monthGrid, monthLabel, todayISO } from "../utils/dateTime.js";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const viewFor = (iso) => ({
  year: Number(iso.slice(0, 4)),
  month: Number(iso.slice(5, 7)) - 1,
});

// value: 'YYYY-MM-DD'.  onChange(newIsoDate) is called when a day is picked.
export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => viewFor(value));
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, close, open);

  const today = todayISO();
  const currentMonth = viewFor(today);
  const atCurrentMonth = view.year === currentMonth.year && view.month === currentMonth.month;

  const toggle = () => {
    if (!open) setView(viewFor(value)); // reopen on the selected month
    setOpen((o) => !o);
  };

  const shiftMonth = (delta) =>
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {formatDisplay(value)}
      </button>

      {open && (
        <div className="picker-popover" role="dialog" aria-label="Choose a date">
          <div className="cal-header">
            <button
              type="button"
              className="cal-nav"
              aria-label="Previous month"
              disabled={atCurrentMonth}
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <strong>{monthLabel(view.year, view.month)}</strong>
            <button
              type="button"
              className="cal-nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="cal-grid">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="cal-weekday" aria-hidden="true">
                {d}
              </span>
            ))}
            {monthGrid(view.year, view.month)
              .flat()
              .map((cell, i) =>
                cell ? (
                  <button
                    key={cell.iso}
                    type="button"
                    className={[
                      "cal-day",
                      cell.iso === value ? "selected" : "",
                      cell.iso === today ? "today" : "",
                    ].join(" ")}
                    disabled={cell.iso < today}
                    aria-pressed={cell.iso === value}
                    aria-label={cell.iso}
                    onClick={() => pick(cell.iso)}
                  >
                    {cell.day}
                  </button>
                ) : (
                  <span key={`blank-${i}`} />
                )
              )}
          </div>
        </div>
      )}
    </div>
  );
}