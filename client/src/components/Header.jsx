import { NavLink } from "react-router-dom";
import Logo from "./Logo.jsx";

export default function Header() {
  return (
    <header className="header">
      <Logo variant="compact" />
      <nav className="header-nav">
        <NavLink to="/courts" className={({ isActive }) => (isActive ? "active" : "")}>
          Find Courts
        </NavLink>
        <span className="divider">|</span>
        <NavLink to="/bookmarks" className={({ isActive }) => (isActive ? "active" : "")}>
          Bookmarks
        </NavLink>
      </nav>
    </header>
  );
}