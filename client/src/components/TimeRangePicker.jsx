import { useCallback, useEffect, useRef, useState } from "react";
import useDismiss from "../hooks/useDismiss.js";
import {
  END_OPTIONS,
  START_OPTIONS,
  joinRange,
  labelToHour,
  hourToLabel,
  parseTypedHour,
  splitRange,
  typedHasMinutes,
} from "../utils/dateTime.js";

// One column: a typeable box on top, a scrollable list of whole hours below.
// onCommit(label) returns true if the value was accepted.
// onInvalid(message) is called when typed text can't be used.
// isDisabled(option) greys out hours that can't be chosen.
function TimeColumn({ label, options, value, onCommit, onInvalid, isDisabled }) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const listRef = useRef(null);

  // Keep the box in sync when the value changes from the list or the other column.
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const scrollTo = useCallback(
    (time) => {
      const list = listRef.current;
      const el = list && list.children[options.indexOf(time)];
      if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    },
    [options]
  );

  useEffect(() => {
    scrollTo(value);
  }, [value, scrollTo]);

  const handleTyping = (event) => {
    const text = event.target.value;
    setDraft(text);
    const parsed = parseTypedHour(text);
    setInvalid(text.trim() !== "" && parsed === null);
    if (parsed) scrollTo(parsed === "00:00" ? "24:00" : parsed); // jump while typing
  };

  const commitDraft = () => {
    const parsed = parseTypedHour(draft);
    if (parsed) {
      if (onCommit(parsed)) return;
    } else if (draft.trim() !== "" && draft !== value) {
      onInvalid(
        typedHasMinutes(draft)
          ? "Whole hours only, like 7 or 7pm."
          : "Enter an hour like 7, 19 or 7pm."
      );
    }
    setDraft(value); // not usable: put the old value back
    setInvalid(false);
  };

  return (
    <div className="time-column">
      <label>
        {label}
        <input
          className={`time-input ${invalid ? "invalid" : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 7 or 7pm"
          value={draft}
          aria-invalid={invalid}
          onChange={handleTyping}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
      </label>
      <div className="time-list" role="listbox" aria-label={`${label} time`} ref={listRef}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="option"
            className="time-option"
            aria-selected={option === value}
            disabled={isDisabled(option)}
            onClick={() => onCommit(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// value: '08:00-10:00'.  onChange(newRange) is called with the same format.
export default function TimeRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState("");
  const rootRef = useRef(null);
  const { start, end } = splitRange(value);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, close, open);

  const commitStart = (newStart) => {
    setHint("");
    const startHour = labelToHour(newStart);
    // Moving the start to or past the end drags the end along (a 1 hour block).
    const newEnd = labelToHour(end) > startHour ? end : hourToLabel(startHour + 1);
    onChange(joinRange(newStart, newEnd));
    return true;
  };

  const commitEnd = (typedEnd) => {
    const newEnd = typedEnd === "00:00" ? "24:00" : typedEnd; // 12am = end of day
    if (labelToHour(newEnd) <= labelToHour(start)) {
      setHint("End time must be after the start time.");
      return false;
    }
    setHint("");
    onChange(joinRange(start, newEnd));
    return true;
  };

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setHint("");
          setOpen((o) => !o);
        }}
      >
        {start}-{end}
      </button>

      {open && (
        <div className="picker-popover" role="dialog" aria-label="Choose a time range">
          <div className="time-columns">
            <TimeColumn
              label="From"
              options={START_OPTIONS}
              value={start}
              onCommit={commitStart}
              onInvalid={setHint}
              isDisabled={() => false}
            />
            <TimeColumn
              label="To"
              options={END_OPTIONS}
              value={end}
              onCommit={commitEnd}
              onInvalid={setHint}
              isDisabled={(option) => labelToHour(option) <= labelToHour(start)}
            />
          </div>
          {hint && (
            <p className="picker-hint" role="alert">
              {hint}
            </p>
          )}
          <button type="button" className="picker-done" onClick={close}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}