import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNova } from '../context/NovaContext';
import NovaDrawer from './NovaDrawer';
import NovaFloatingVoiceBar from './NovaFloatingVoiceBar';
import DeveloperConsole from './DeveloperConsole';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { openNova, isOpen, handsFree, toggleHandsFree, wakeStatus } = useNova();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/interview', label: 'AI Interviews' },
    { path: '/projects', label: 'Projects' },
    { path: '/predict', label: 'Predictions' },
    { path: '/internships', label: 'Internships' },
    { path: '/profile', label: 'Profile' },
  ];

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
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

            {/* Pill Navigation Items */}
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

              {/* Notification Bell */}
              <button className="nova-action-icon-btn" title="Notifications">
                <Bell size={18} />
                <span className="nova-bell-indicator" />
              </button>

              {/* Nova Assistant Trigger Pill */}
              <button className="nova-trigger-pill" onClick={() => openNova()}>
                <Sparkles size={14} className="sparkle-pulse" />
                <span>Nova</span>
                <span className="nova-online-dot" />
              </button>

              {/* User Avatar Pill */}
              <div
                className="nova-avatar-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user?.name || 'User Profile'}
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="nova-avatar-img" />
                ) : (
                  <div className="nova-avatar-initials">{getInitials(user?.name)}</div>
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
    </div>
  );
}
