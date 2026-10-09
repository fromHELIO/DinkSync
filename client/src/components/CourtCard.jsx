export default function CourtCard({ court, onToggleBookmark }) {
  const { name, location, available, bookmarked, bookingUrl, booking_url } = court;
  const targetUrl = bookingUrl || booking_url;

  return (
    <div className="court-card">
      <div className="court-card-info">
        <h3>{name}</h3>
        <p className="location">{location || "Location unavailable"}</p>
        
        {/* Availability Bar / Badge */}
        <div className="court-status-container" style={{ marginTop: '8px' }}>
        <span className={`status-badge ${available === false ? "unavailable" : ""}`}>
          {available === null ? "Site login required" : available ? "Available" : "Unavailable"}
        </span>
        </div>
      </div>

      <div className="court-card-actions">
        <a
          className="book-btn"
          href={targetUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{ pointerEvents: !targetUrl || available === false ? 'none' : 'auto', opacity: available === false ? 0.6 : 1 }}
        >
          BOOK
          <br />
          HERE
        </a>

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
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 21s-6.7-4.35-9.33-8.3C1.1 10.5 1.5 7.2 4.1 5.6c2.2-1.35 4.8-.7 6.3 1.2l1.6 2 1.6-2c1.5-1.9 4.1-2.55 6.3-1.2 2.6 1.6 3 4.9 1.43 7.1C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

function HeartOutline() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path d="M12 21s-6.7-4.35-9.33-8.3C1.1 10.5 1.5 7.2 4.1 5.6c2.2-1.35 4.8-.7 6.3 1.2l1.6 2 1.6-2c1.5-1.9 4.1-2.55 6.3-1.2 2.6 1.6 3 4.9 1.43 7.1C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}