import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  FolderGit2,
  Sparkles,
  Briefcase,
  User,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Code2,
  BrainCircuit,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNova } from '../context/NovaContext';
import NovaDrawer from './NovaDrawer';
import NovaFloatingVoiceBar from './NovaFloatingVoiceBar';
import DeveloperConsole from './DeveloperConsole';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { openNova, isOpen, handsFree, toggleHandsFree, wakeStatus } = useNova();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const userMenuRef = useRef(null);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/interview', label: 'AI Interviews', icon: Mic },
    { path: '/projects', label: 'Projects', icon: FolderGit2 },
    { path: '/predict', label: 'Predictions', icon: BrainCircuit },
    { path: '/internships', label: 'Internships', icon: Briefcase },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handleNavClick = (path) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  return (
    <div className="nova-viewport">
      {/* Developer Console Overlay */}
      <DeveloperConsole />

      {/* Global Nova Assistant Slide-over Drawer */}
      <NovaDrawer />

      {/* Real-time Floating Voice Co-Pilot Bar */}
      <NovaFloatingVoiceBar />

      {/* Outer Application Shell Frame */}
      <div className="nova-shell-frame">
        <div className="nova-app-container">
          {/* Top Navigation Bar */}
          <header className="nova-top-nav">
            {/* Mobile Hamburger Toggle (Visible on < 900px) */}
            <button
              className="nova-hamburger-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {/* Brand Logo */}
            <div className="nova-brand" onClick={() => navigate('/dashboard')}>
              <div className="nova-brand-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill="#FFFFFF"
                  />
                </svg>
              </div>
              <span className="nova-brand-text">MirrorMind</span>
            </div>

            {/* Pill Navigation Items (Desktop & Tablet >= 900px) */}
            <nav className="nova-nav-pills">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path === '/dashboard' && location.pathname === '/');
                return (
                  <button
                    key={item.path}
                    className={`nova-pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Action Utilities */}
            <div className="nova-nav-actions">
              {/* Hands-Free Voice Indicator & Quick Toggle */}
              <button
                className={`nova-hands-free-btn ${handsFree ? 'active' : 'inactive'} ${wakeStatus === 'DETECTED' ? 'detected' : ''}`}
                onClick={toggleHandsFree}
                title={
                  handsFree
                    ? 'Hands-Free is ACTIVE: Say "Hey Nova" anytime to activate voice co-pilot. Click to turn OFF.'
                    : 'Hands-Free is OFF. Click to enable continuous "Hey Nova" wake word.'
                }
              >
                <Mic size={14} className={handsFree ? 'pulse-mic' : ''} />
                <span>
                  {wakeStatus === 'DETECTED'
                    ? 'Heard "Hey Nova"!'
                    : handsFree
                    ? 'Hey Nova: ON'
                    : 'Hey Nova: OFF'}
                </span>
                <span
                  className="nova-hf-status-dot"
                  style={{
                    backgroundColor:
                      wakeStatus === 'DETECTED'
                        ? '#2563EB'
                        : handsFree
                        ? '#10B981'
                        : '#94A3B8',
                  }}
                />
              </button>

              {/* Settings Action */}
              <button
                className={`nova-action-icon-btn ${location.pathname === '/settings' ? 'active' : ''}`}
                onClick={() => navigate('/settings')}
                title="Settings"
              >
                <Settings size={18} />
                <span className="nova-action-label">Settings</span>
              </button>

              {/* Nova Assistant Trigger Pill */}
              <button className="nova-trigger-pill" onClick={() => openNova()} title="Open Nova Assistant">
                <Sparkles size={14} className="sparkle-pulse" />
                <span>Nova</span>
                <span className="nova-online-dot" />
              </button>

              {/* User Avatar & Dropdown Menu */}
              <div className="nova-user-menu-wrapper" ref={userMenuRef}>
                <div
                  className="nova-avatar-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={user?.name || 'User Profile'}
                  role="button"
                  tabIndex={0}
                >
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="nova-avatar-img" />
                  ) : (
                    <div className="nova-avatar-initials">{getInitials(user?.name)}</div>
                  )}
                </div>

                {/* Floating User Dropdown Menu */}
                {showUserMenu && (
                  <div className="nova-user-menu-dropdown">
                    <div className="nova-menu-header">
                      <div className="nova-menu-user-name">{user?.name || 'Student Account'}</div>
                      <div className="nova-menu-user-email">{user?.email || 'Logged in'}</div>
                    </div>

                    <button
                      className="nova-menu-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile');
                      }}
                    >
                      <User size={16} />
                      <span>My Profile</span>
                    </button>

                    <button
                      className="nova-menu-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/settings');
                      }}
                    >
                      <Settings size={16} />
                      <span>Account Settings</span>
                    </button>

                    <button
                      className="nova-menu-item"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/developer');
                      }}
                    >
                      <Code2 size={16} />
                      <span>Developer Pipeline</span>
                    </button>

                    <div className="nova-menu-divider" />

                    <button
                      className="nova-menu-item danger"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Body Canvas */}
          <main className="nova-content-body">
            <Outlet />
          </main>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer & Backdrop (Screens < 900px) ── */}
      {mobileDrawerOpen && (
        <>
          <div
            className="nova-mobile-overlay"
            style={{ display: 'block' }}
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="nova-mobile-drawer">
            <div className="nova-mobile-drawer-header">
              <div className="nova-brand" onClick={() => handleNavClick('/dashboard')}>
                <div className="nova-brand-icon">
                  <span style={{ fontSize: 16 }}>🧠</span>
                </div>
                <span className="nova-brand-text">MirrorMind</span>
              </div>
              <button
                className="nova-action-icon-btn"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="nova-mobile-nav-list">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path === '/dashboard' && location.pathname === '/');
                return (
                  <button
                    key={item.path}
                    className={`nova-mobile-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.path)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <div className="nova-menu-divider" style={{ margin: '12px 0' }} />

              <button
                className={`nova-mobile-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
                onClick={() => handleNavClick('/settings')}
              >
                <Settings size={18} />
                <span>Settings</span>
              </button>

              <button
                className={`nova-mobile-nav-item ${location.pathname === '/developer' ? 'active' : ''}`}
                onClick={() => handleNavClick('/developer')}
              >
                <Code2 size={18} />
                <span>Developer Pipeline</span>
              </button>
            </div>

            <div style={{ paddingTop: 16, borderTop: '1px solid var(--slate-100)' }}>
              <button
                className="nova-menu-item danger"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12 }}
                onClick={() => {
                  setMobileDrawerOpen(false);
                  logout();
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
