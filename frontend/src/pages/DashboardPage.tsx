import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { Navbar } from '../components/Navbar';
import { ActivityFeed } from '../components/ActivityFeed';
import { TaskCard, Task } from '../components/TaskCard';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Users
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { socket, onlineCount } = useSocket();

  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatus = searchParams.get('status') || '';
  const filterPriority = searchParams.get('priority') || '';
  const filterProject = searchParams.get('projectId') || '';

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, tasksRes, projRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/tasks?' + searchParams.toString()),
        api.get('/projects')
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (tasksRes.data.success) setTasks(tasksRes.data.data);
      if (projRes.data.success) setProjects(projRes.data.data);
    } catch (err) {
      console.error('[Dashboard] Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Real-time: refresh task list when a task:updated event arrives ─────────
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdated = () => {
      api.get('/tasks?' + searchParams.toString()).then(res => {
        if (res.data.success) setTasks(res.data.data);
      });
      api.get('/dashboard/stats').then(res => {
        if (res.data.success) setStats(res.data.data);
      });
    };

    socket.on('task:updated', handleTaskUpdated);
    return () => { socket.off('task:updated', handleTaskUpdated); };
  }, [socket, searchParams]);

  // ── Status change handler ──────────────────────────────────────────────────
  const handleStatusChange = async (taskId: number, newStatus: Task['status']) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      // Optimistic update locally; real-time socket event will also refresh
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update task status';
      alert(msg);
    }
  };

  // ── URL filter helpers ─────────────────────────────────────────────────────
  const handleFilterChange = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);
  };

  // ── Client-side text search (on top of server-side role filtering) ─────────
  const filteredTasks = tasks.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.developer && t.developer.name.toLowerCase().includes(q)) ||
      String(t.id).includes(q)
    );
  });

  const columns: { status: Task['status']; title: string; color: string }[] = [
    { status: 'TODO', title: 'Backlog / To Do', color: 'border-slate-600' },
    { status: 'IN_PROGRESS', title: 'In Development', color: 'border-blue-500' },
    { status: 'IN_REVIEW', title: 'Code Review & QA', color: 'border-amber-500' },
    { status: 'DONE', title: 'Production Deployed', color: 'border-emerald-500' }
  ];

  const overdueTasks = tasks.filter(t => t.isOverdue);
  const completedTasks = tasks.filter(t => t.status === 'DONE');
  const openTasks = tasks.filter(t => t.status !== 'DONE');

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <Navbar socket={socket} onlineCount={onlineCount} />

      <main className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Stat cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] shadow-sm">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Active Projects</span>
              <FolderKanban className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5 font-mono">
              {stats?.totalProjects ?? stats?.projectsCount ?? projects.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] shadow-sm">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Open Tickets</span>
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-sky-400 mt-1.5 font-mono">
              {openTasks.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] shadow-sm">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>SLA Breaches</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1.5 font-mono flex items-center space-x-2">
              <span>{overdueTasks.length}</span>
              {overdueTasks.length > 0 && (
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80">
                  Action Required
                </span>
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] shadow-sm">
            {user?.role === 'ADMIN' ? (
              <>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Online Now</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1.5 font-mono">
                  {onlineCount}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Completed</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1.5 font-mono">
                  {completedTasks.length}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Text search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                id="task-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ticket..."
                className="w-full bg-[#0d1117] border border-[#30363d] text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>

            {/* Project filter */}
            <select
              id="filter-project"
              value={filterProject}
              onChange={e => handleFilterChange('projectId', e.target.value)}
              className="bg-[#0d1117] border border-[#30363d] text-xs rounded-lg px-2.5 py-1.5 text-slate-300 font-sans cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">All Client Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              id="filter-priority"
              value={filterPriority}
              onChange={e => handleFilterChange('priority', e.target.value)}
              className="bg-[#0d1117] border border-[#30363d] text-xs rounded-lg px-2.5 py-1.5 text-slate-300 font-sans cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">P0 Critical</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Status filter */}
            <select
              id="filter-status"
              value={filterStatus}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="bg-[#0d1117] border border-[#30363d] text-xs rounded-lg px-2.5 py-1.5 text-slate-300 font-sans cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center space-x-1 border border-[#30363d] rounded-lg p-0.5 bg-[#0d1117]">
            <button
              id="view-kanban"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs flex items-center space-x-1 ${
                viewMode === 'kanban'
                  ? 'bg-[#21262d] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              id="view-list"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs flex items-center space-x-1 ${
                viewMode === 'list'
                  ? 'bg-[#21262d] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* ── Main content area ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tasks (3/4 width) */}
          <div className="lg:col-span-3 space-y-4">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                Syncing workspace tickets...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#161b22] border border-[#30363d] text-slate-400 text-xs">
                No tickets match the active filter criteria.
              </div>
            ) : viewMode === 'kanban' ? (
              /* Kanban board */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
                {columns.map(col => {
                  const colTasks = filteredTasks.filter(t => t.status === col.status);
                  return (
                    <div
                      key={col.status}
                      className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-col min-h-[450px]"
                    >
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#30363d]">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full border-2 ${col.color}`} />
                          <span className="text-xs text-slate-200">{col.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-[#21262d] px-2 py-0.5 rounded-full border border-[#30363d]">
                          {colTasks.length}
                        </span>
                      </div>
                      <div className="space-y-2.5 overflow-y-auto flex-1">
                        {colTasks.length === 0 ? (
                          <div className="p-4 text-center text-[11px] text-slate-600 border border-dashed border-[#30363d] rounded-lg">
                            No tickets
                          </div>
                        ) : (
                          colTasks.map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onStatusChange={handleStatusChange}
                              canEditStatus={true}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List / table view */
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-slate-400 font-mono text-[11px] uppercase border-b border-[#30363d] bg-[#0d1117]/50">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Title & Context</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Assigned</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]/60">
                    {filteredTasks.map(task => (
                      <tr key={task.id} className="hover:bg-[#1f242c] transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                          #{task.id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-200">{task.title}</div>
                          {task.project && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {task.project.title}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#30363d] bg-[#0d1117]">
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {task.developer ? (
                            <div className="text-slate-300">{task.developer.name}</div>
                          ) : (
                            <span className="text-slate-600">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {new Date(task.dueDate).toLocaleDateString()}
                          {task.isOverdue && (
                            <span className="ml-1 text-[9px] text-rose-400 bg-rose-950/80 px-1 py-0.5 rounded border border-rose-800">
                              OVERDUE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={task.status}
                            onChange={e =>
                              handleStatusChange(task.id, e.target.value as Task['status'])
                            }
                            className="bg-[#0d1117] border border-[#30363d] text-slate-300 text-xs rounded px-2 py-1"
                          >
                            <option value="TODO">To Do</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="IN_REVIEW">In Review</option>
                            <option value="DONE">Done</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity feed (1/4 width) */}
          <div className="lg:col-span-1">
            <ActivityFeed socket={socket} projectId="" />
          </div>
        </div>
      </main>
    </div>
  );
};
