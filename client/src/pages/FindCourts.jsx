import { useState } from "react";
import Header from "../components/Header.jsx";
import CourtCard from "../components/CourtCard.jsx";
import { useCourts } from "../context/CourtsContext.jsx";

const PAGE_SIZE = 3;

export default function FindCourts() {
  const { courts, search, toggleBookmark } = useCourts();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleCourts = courts.slice(0, visibleCount);
  const remaining = courts.length - visibleCount;

  const handleBook = (court) => {
    if (court.bookingUrl) window.open(court.bookingUrl, "_blank", "noopener");
  };

  return (
    <div className="app-shell">
      <Header />
      <div className="page">
        <div className="list-page-header">
          <h1>Courts</h1>
          <div className="filter-pills">
            <button className="pill">{search.date}</button>
            <button className="pill">{search.timeRange}</button>
          </div>
        </div>

        <div className="court-list">
          {visibleCourts.length === 0 && (
            <div className="empty-state">No courts match this search yet.</div>
          )}
          {visibleCourts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              onToggleBookmark={toggleBookmark}
              onBook={handleBook}
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