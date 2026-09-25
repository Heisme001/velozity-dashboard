import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Socket } from 'socket.io-client';
import { GitCommit, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  action: string;
  description: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
  user?: { name: string; role: string };
  userName?: string;
  project?: { title: string };
  projectTitle?: string;
}

interface ActivityFeedProps {
  socket?: Socket | null;
  projectId?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ socket, projectId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Initial load: fetch last 20 role-filtered events from DB ──────────────
  // This satisfies the "offline users see last 20 missed events from the DB"
  // requirement. The server enforces role-based filtering.
  useEffect(() => {
    async function loadFromDB() {
      try {
        const url = projectId
          ? `/activities?projectId=${projectId}&limit=20`
          : '/activities?limit=20';
        const res = await api.get(url);
        if (res.data.success) {
          setActivities(res.data.data);
          // Track the timestamp of the most recent event for catch-up
          if (res.data.data.length > 0) {
            localStorage.setItem('lastActivityTimestamp', res.data.data[0].createdAt);
          }
        }
      } catch (err) {
        console.error('[ActivityFeed] Failed to load activities', err);
      } finally {
        setLoading(false);
      }
    }
    loadFromDB();
  }, [projectId]);

  // ── Real-time: listen for live activity events from the socket ────────────
  // The backend only sends events the current user is allowed to see
  // (Admin=all, PM=own projects, Dev=own tasks). No client-side filtering here.
  useEffect(() => {
    if (!socket) return;

    const handleLiveFeed = (newAct: Activity) => {
      setActivities(prev => [newAct, ...prev.slice(0, 24)]);
      // Update the last-seen timestamp for future catch-up calls
      localStorage.setItem('lastActivityTimestamp', newAct.createdAt);
    };

    // Live feed events
    socket.on('activity:feed', handleLiveFeed);

    // Catch-up result: events missed while offline (emitted by server
    // in response to the 'activity:catch-up' event sent on connect)
    socket.on('activity:catch-up:result', (missed: Activity[]) => {
      if (missed.length === 0) return;
      setActivities(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newOnes = missed.filter(a => !existingIds.has(a.id));
        const merged = [...newOnes, ...prev].slice(0, 25);
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (merged.length > 0) {
          localStorage.setItem('lastActivityTimestamp', merged[0].createdAt);
        }
        return merged;
      });
    });

    return () => {
      socket.off('activity:feed', handleLiveFeed);
      socket.off('activity:catch-up:result');
    };
  }, [socket]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/80">
        <div className="flex items-center space-x-2">
          <GitCommit className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-white uppercase tracking-wider font-mono">
            Live Audit Log
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SYNCED</span>
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-[#30363d]/60 overflow-y-auto max-h-[580px]">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-500 font-mono">
            Fetching activity logs...
          </div>
        ) : activities.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">No recent activity</div>
        ) : (
          activities.map(act => (
            <div
              key={act.id}
              className="px-4 py-3 hover:bg-[#1f242c] transition flex flex-col gap-1"
            >
              <div className="text-xs text-slate-200 leading-relaxed font-sans">
                {act.description}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span className="truncate max-w-[170px] text-slate-400">
                  {act.project?.title || act.projectTitle || 'General'}
                </span>
                <span className="flex items-center space-x-1 shrink-0">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span>{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
