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
      </div>
    </div>
  );
}