import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../services/authService';

// Bootstrap must load BEFORE our own CSS so our overrides win.
import 'bootstrap/dist/css/bootstrap.min.css';
import './AppLayout.css';

const links = [
  { to: '/admin', label: 'Admin' },
  { to: '/search', label: 'Search' },
  { to: '/upload', label: 'Upload' },
];

const AppLayout = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/', { replace: true });
  };

  return (
    <div className="app-layout">
      <nav className="app-navbar navbar navbar-expand-md navbar-dark">
        <div className="container-fluid">
          <NavLink to="/search" className="app-brand navbar-brand">
            <span>DMS</span>
          </NavLink>

          {/* Mobile toggle (state-driven, so no Bootstrap JS needed) */}
          <button
            type="button"
            className="navbar-toggler"
            aria-controls="app-nav"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            id="app-nav"
            className={`collapse navbar-collapse${open ? ' show' : ''}`}
          >
            <ul className="navbar-nav mr-auto me-auto">
              {links.map(({ to, label }) => (
                <li className="nav-item" key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `nav-link${isActive ? ' active' : ''}`
                    }
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="app-logout btn btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Page content for the matched child route */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;