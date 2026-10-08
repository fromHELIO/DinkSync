import Header from "../components/Header.jsx";
import CourtCard from "../components/CourtCard.jsx";
import { useCourts } from "../context/CourtsContext.jsx";

export default function Bookmarks() {
  const { courts, toggleBookmark } = useCourts();
  const bookmarked = courts.filter((c) => c.bookmarked);

  const handleBook = (court) => {
    if (court.bookingUrl) window.open(court.bookingUrl, "_blank", "noopener");
  };

  return (
    <div className="app-shell">
      <Header />
      <div className="page">
        <div className="list-page-header">
          <h1>Bookmarks</h1>
        </div>

        <div className="court-list">
          {bookmarked.length === 0 && (
            <div className="empty-state">
              You haven't bookmarked any courts yet.
            </div>
          )}
          {bookmarked.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              onToggleBookmark={toggleBookmark}
              onBook={handleBook}
            />
          ))}
        </div>
      </div>
    </div>
  );
}