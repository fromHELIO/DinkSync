import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";

/*
  All copy on this screen is plain JSX text below - edit directly.
*/
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="page landing">
      <div className="landing-grid">
        <Logo variant="hero" />

        <div className="landing-copy">
          <h1>Tired of all the reservation sites?</h1>
          <p>
            See them all in one place, and find the ones that are free
            when you need.
          </p>
          <button className="btn-primary" onClick={() => navigate("/courts")}>
            <SearchIcon /> Find My Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}