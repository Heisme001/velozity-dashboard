import React from 'react';
import { Calendar, AlertCircle, User } from 'lucide-react';
import { format } from 'date-fns';

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string;
  isOverdue: boolean;
  projectId: string;
  project?: { title: string };
  developer?: { id: string; name: string };
}

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: number, newStatus: Task['status']) => void;
  canEditStatus: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, canEditStatus }) => {
  const priorityConfig: Record<Task['priority'], { label: string; cls: string }> = {
    LOW: { label: 'Low', cls: 'text-slate-400 bg-slate-800/80 border-[#30363d]' },
    MEDIUM: { label: 'Medium', cls: 'text-sky-300 bg-sky-950/30 border-sky-800/60' },
    HIGH: { label: 'High', cls: 'text-amber-300 bg-amber-950/30 border-amber-800/60' },
    CRITICAL: { label: 'P0 Critical', cls: 'text-rose-300 bg-rose-950/40 border-rose-800/80' }
  };

  const statusList: { value: Task['status']; label: string }[] = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'DONE', label: 'Completed' }
  ];

  const pri = priorityConfig[task.priority];

  return (
    <div className="bg-[#161b22] border border-[#30363d] hover:border-slate-600 rounded-lg p-3.5 transition flex flex-col justify-between group shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-400">
            <span className="font-bold">#{task.id}</span>
            {task.project && (
              <span className="truncate max-w-[130px] text-slate-500 font-sans text-[11px]">
                · {task.project.title}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${pri.cls}`}>
            {pri.label}
          </span>
        </div>

        <h4 className="text-slate-100 text-xs leading-snug group-hover:text-blue-400 transition mb-1.5">
          {task.title}
        </h4>

        {task.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {task.description}
          </p>
        )}
      </div>

      <div className="pt-2.5 border-t border-[#30363d]/80 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className={`font-mono text-[11px] ${task.isOverdue ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
              {format(new Date(task.dueDate), 'dd MMM yyyy')}
            </span>
            {task.isOverdue && (
              <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>OVERDUE</span>
              </span>
            )}
          </div>

          {task.developer ? (
            <div className="flex items-center space-x-1 text-slate-300 font-sans truncate max-w-[120px]">
              <span className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[9px] flex items-center justify-center font-mono shrink-0">
                {task.developer.name.charAt(0)}
              </span>
              <span className="text-[11px] truncate">{task.developer.name.split(' ')[0]}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-slate-600 text-[11px]">
              <User className="w-3 h-3" />
              <span>Unassigned</span>
            </div>
          )}
        </div>

        {canEditStatus && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase font-mono text-slate-500">Status:</span>
            <select
              value={task.status}
              onChange={e => onStatusChange(task.id, e.target.value as Task['status'])}
              className="bg-[#0d1117] border border-[#30363d] text-slate-300 hover:text-white text-xs rounded px-2 py-1 font-sans focus:outline-none focus:border-blue-500 transition cursor-pointer"
            >
              {statusList.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
