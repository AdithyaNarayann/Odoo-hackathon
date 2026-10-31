import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, User, KeyRound, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onToggleSidebar }) {
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const profileLink = role === 'customer' ? '/portal/profile' : '/settings';

  return (
    <header className="h-16 bg-cream border-b-2 border-ink px-4 md:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Mobile Menu Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-[4px] border-2 border-ink bg-white shadow-neo-sm active:translate-y-0.5 active:shadow-none"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} className="text-ink" />
        </button>
      </div>

      {/* Right User Section */}
      <div className="relative ml-auto" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-[4px] border-2 border-ink bg-cream-light shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          {/* Avatar with Initials */}
          <div className="w-8 h-8 rounded-full bg-brand-orange text-white border-2 border-ink flex items-center justify-center font-archivo font-extrabold text-xs">
            {getInitials(user?.full_name)}
          </div>

          <div className="text-left hidden sm:block">
            <div className="text-xs font-archivo font-bold text-ink leading-tight">
              {user?.full_name || 'User'}
            </div>
            <div className="text-[10px] font-archivo font-extrabold tracking-wider uppercase text-ink/70">
              {role || 'staff'}
            </div>
          </div>

          <ChevronDown
            size={16}
            className={`text-ink transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-ink rounded-[4px] shadow-neo-md py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-2 border-b-2 border-ink/10 sm:hidden">
              <p className="text-xs font-bold text-ink truncate">{user?.full_name}</p>
              <p className="text-[10px] text-ink/60 capitalize">{role}</p>
            </div>

            <Link
              to={profileLink}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-ink hover:bg-cream transition-colors"
            >
              <User size={15} />
              <span>View Profile</span>
            </Link>

            <Link
              to={profileLink}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-ink hover:bg-cream transition-colors"
            >
              <KeyRound size={15} />
              <span>Change Password</span>
            </Link>

            <div className="my-1 border-t-2 border-ink/10" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
