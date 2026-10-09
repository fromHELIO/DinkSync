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
      </nav>
    </header>
  );
}