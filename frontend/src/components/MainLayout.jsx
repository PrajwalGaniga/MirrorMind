import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import DeveloperConsole from './DeveloperConsole';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: '🏠' },
    { path: '/projects', label: 'Projects', icon: '📁' },
    { path: '/predict', label: 'Predict', icon: '✨' },
    { path: '/internships', label: 'Internships', icon: '💼' },
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="layout-container">
      {/* Developer Console Overlay */}
      <DeveloperConsole />

      <main className="layout-main">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <div className="bottom-nav-container">
        <div className="bottom-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="bottom-nav-icon">{item.icon}</span>
                <span className="bottom-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
