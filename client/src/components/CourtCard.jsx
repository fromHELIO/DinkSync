/*
  CourtCard
  ---------
  All the visible text comes from the `court` object, so you can plug in
  your real data (or whatever the API returns) without touching this file.

  Expected shape of `court`:
  {
    id: string | number,
    name: string,          // e.g. "The Court Avenue"
    location: string,      // e.g. "San Isidro, City of San Fernando"
    available: boolean,
    bookmarked: boolean,
    bookingUrl?: string,   // where "BOOK HERE" should send the user
  }
*/
export default function CourtCard({ court, onToggleBookmark, onBook }) {
  const { name, location, available, bookmarked } = court;

  return (
    <div className="court-card">
      <div className="court-card-info">
        <h3>{name}</h3>
        <p className="location">{location}</p>
        <span className={`status-badge ${available ? "" : "unavailable"}`}>
          {available ? "Available" : "Unavailable"}
        </span>
      </div>

      <div className="court-card-actions">
        <button
          className="book-btn"
          disabled={!available}
          onClick={() => onBook?.(court)}
        >
          BOOK
          <br />
          HERE
        </button>

        <button
          className="bookmark-btn"
          aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
          onClick={() => onToggleBookmark?.(court.id)}
        >
          {bookmarked ? <HeartFilled /> : <HeartOutline />}
        </button>
      </div>
    </div>
  );
}

function HeartFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-6.7-4.35-9.33-8.3C1.1 10.5 1.5 7.2 4.1 5.6c2.2-1.35 4.8-.7 6.3 1.2l1.6 2 1.6-2c1.5-1.9 4.1-2.55 6.3-1.2 2.6 1.6 3 4.9 1.43 7.1C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

function HeartOutline() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-6.7-4.35-9.33-8.3C1.1 10.5 1.5 7.2 4.1 5.6c2.2-1.35 4.8-.7 6.3 1.2l1.6 2 1.6-2c1.5-1.9 4.1-2.55 6.3-1.2 2.6 1.6 3 4.9 1.43 7.1C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}