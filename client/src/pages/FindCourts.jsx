import { useState } from "react";
import Header from "../components/Header.jsx";
import CourtCard from "../components/CourtCard.jsx";
import DatePicker from "../components/DatePicker.jsx";
import TimeRangePicker from "../components/TimeRangePicker.jsx";
import { useCourts } from "../context/CourtsContext.jsx";

const PAGE_SIZE = 3;

export default function FindCourts() {
  const { courts, search, setSearch, toggleBookmark, loading, error } = useCourts();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleCourts = courts.slice(0, visibleCount);
  const remaining = courts.length - visibleCount;

  return (
    <div className="app-shell">
      <Header />
      <div className="page">
        <div className="list-page-header">
          <h1>Courts</h1>
          <div className="filter-pills">
            <DatePicker
              value={search.date}
              onChange={(date) => setSearch((s) => ({ ...s, date }))}
            />
            <TimeRangePicker
              value={search.timeRange}
              onChange={(timeRange) => setSearch((s) => ({ ...s, timeRange }))}
            />
          </div>
        </div>

        {loading && (
          <div className="empty-state" role="status">
            Checking court availability… this can take up to 20 seconds.
          </div>
        )}
        {error && (
          <div className="empty-state" role="alert">
            {error}
          </div>
        )}

        <div className={`court-list ${loading ? "is-loading" : ""}`} aria-busy={loading}>
          {!loading && !error && visibleCourts.length === 0 && (
            <div className="empty-state">No courts to show yet.</div>
          )}
          {visibleCourts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              onToggleBookmark={toggleBookmark}
            />
          ))}
        </div>

        {remaining > 0 && (
          <div className="show-more">
            <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              +{remaining}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}