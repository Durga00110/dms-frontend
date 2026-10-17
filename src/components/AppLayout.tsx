
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FiFileText,
  FiGrid,
  FiSearch,
  FiUploadCloud,
  FiLogOut,
  FiMenu,
  FiX,
  FiChevronRight,
} from "react-icons/fi";

import { clearToken } from "../services/authService";
import ChatbotWidget from "./ChatbotWidget";

import "./AppLayout.css";

const links = [
  { to: "/admin", label: "Admin", icon: FiGrid },
  { to: "/search", label: "Search", icon: FiSearch },
  { to: "/upload", label: "Upload", icon: FiUploadCloud },
];

const AppLayout = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    setOpen(false);
    clearToken();
    navigate("/", { replace: true });
  };

  const closeMenu = () => setOpen(false);

  return (
    <div className="app-layout">
      <nav className="app-navbar navbar navbar-expand-md">
        <div className="container-fluid app-navbar-container">
          {/* Brand */}
          <NavLink
            to="/search"
            className="app-brand navbar-brand"
            onClick={closeMenu}
            aria-label="DMS home"
          >
            <span className="app-brand-icon">
              <FiFileText aria-hidden="true" />
            </span>

            <span className="app-brand-text">
              <span className="app-brand-name">DMS</span>
              <span className="app-brand-caption">Document Management</span>
            </span>
          </NavLink>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className={`app-menu-toggle ${open ? "is-open" : ""}`}
            aria-controls="app-nav"
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <FiX /> : <FiMenu />}
          </button>

          {/* Navigation */}
          <div
            id="app-nav"
            className={`app-nav-collapse navbar-collapse ${
              open ? "show" : ""
            }`}
          >
            <ul className="navbar-nav app-nav-links">
              {links.map(({ to, label, icon: Icon }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `app-nav-link${isActive ? " active" : ""}`
                    }
                    onClick={closeMenu}
                  >
                    <Icon className="app-nav-icon" aria-hidden="true" />

                    <span>{label}</span>

                    <FiChevronRight
                      className="app-nav-chevron"
                      aria-hidden="true"
                    />
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="app-nav-actions">
              <span className="app-nav-divider" aria-hidden="true" />

              <button
                type="button"
                className="app-logout"
                onClick={handleLogout}
              >
                <FiLogOut aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Active page content */}
      <main className="app-main">
        <Outlet />
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default AppLayout;
