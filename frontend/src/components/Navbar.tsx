import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCheck, LogOut, Radio, FolderGit2, X } from 'lucide-react';
import { api } from '../services/api';
import { Socket } from 'socket.io-client';

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NavbarProps {
  socket?: Socket | null;
  onlineCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ socket, onlineCount }) => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Load notifications on mount ────────────────────────────────────────────
  useEffect(() => {
    async function fetchNotifs() {
      try {
        const { data } = await api.get('/notifications');
        if (data.success) {
          setNotifications(data.data.notifications);
          setUnreadCount(data.data.unreadCount);
        }
      } catch {}
    }
    fetchNotifs();
  }, []);

  // ── Real-time: receive new notifications via WebSocket (no polling) ─────────
  useEffect(() => {
    if (!socket) return;

    const handleNew = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    socket.on('notification:new', handleNew);
    return () => { socket.off('notification:new', handleNew); };
  }, [socket]);

  // ── Close dropdown when clicking outside ──────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Mark a single notification as read ────────────────────────────────────
  const markOneRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  // ── Mark all notifications as read ────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await api.patch('/notifications/all/read');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const roleBadges: Record<string, { label: string; cls: string }> = {
    ADMIN: { label: 'Admin / Lead', cls: 'bg-purple-950/60 text-purple-300 border-purple-800/80' },
    PROJECT_MANAGER: {
      label: 'Product Lead',
      cls: 'bg-blue-950/60 text-blue-300 border-blue-800/80'
    },
    DEVELOPER: {
      label: 'Engineer',
      cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
    }
  };

  const badge = user
    ? roleBadges[user.role]
    : { label: 'User', cls: 'bg-slate-800 text-slate-400 border-slate-700' };

  return (
    <header className="sticky top-0 z-40 bg-[#161b22] border-b border-[#30363d] backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand + role badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center font-black text-white text-xs">
              V
            </div>
            <span className="font-semibold text-white tracking-tight text-sm">Velozity</span>
          </div>
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-[#30363d] text-xs text-slate-400">
            <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300">Engineering Workspaces</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Right: presence + notifications + user */}
        <div className="flex items-center space-x-3">
          {/* Live presence counter – admin only */}
          {user?.role === 'ADMIN' && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#30363d] text-emerald-400 text-xs font-mono">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{onlineCount || 1} online</span>
            </div>
          )}

          {/* Notification bell + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="notification-bell"
              onClick={() => setShowDropdown(v => !v)}
              className="relative p-1.5 rounded-md hover:bg-[#21262d] text-slate-300 hover:text-white transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden z-50">
                {/* Dropdown header */}
                <div className="px-4 py-2.5 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
                  <span className="text-xs text-white uppercase tracking-wider font-mono">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 text-blue-400">({unreadCount} unread)</span>
                    )}
                  </span>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        id="mark-all-read"
                        onClick={markAllRead}
                        className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-mono text-xs"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Mark all read</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowDropdown(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notification list */}
                <div className="max-h-[400px] overflow-y-auto divide-y divide-[#30363d]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => !n.isRead && markOneRead(n.id)}
                        className={`p-3 text-xs transition cursor-pointer ${
                          n.isRead
                            ? 'bg-[#161b22] text-slate-400'
                            : 'bg-[#0d1117]/60 text-slate-200 hover:bg-[#1f242c]'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 text-slate-200">
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          )}
                          <span className="font-medium">{n.title}</span>
                        </div>
                        <div className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                          {n.message}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User info + logout */}
          <div className="flex items-center space-x-2 pl-2 border-l border-[#30363d]">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
              {user?.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-medium text-slate-200 leading-tight truncate max-w-[140px]">
                {user?.name}
              </div>
              <div className="text-[10px] text-slate-500 font-mono leading-tight">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
