import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { KeyRound, Mail, ArrowRight, ShieldCheck, Terminal, Users, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@velozity.com');
  const [password, setPassword] = useState('Password@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        login(res.data.data.accessToken, res.data.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const presetAccounts = [
    { role: 'Admin', email: 'admin@velozity.com', icon: ShieldCheck, tag: 'All Projects' },
    { role: 'Project Manager (Ravi)', email: 'ravi.pm@velozity.com', icon: Users, tag: 'Projects 1 & 2' },
    { role: 'Developer (Priya)', email: 'priya.dev@velozity.com', icon: Terminal, tag: 'Assigned Tasks' }
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
      <header className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-500/20">
            V
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold tracking-tight text-white text-base">Velozity</span>
            <span className="text-slate-400 text-sm hidden sm:inline">Project Dashboard</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center w-full px-4 py-8">
        <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl p-8 shadow-xl space-y-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sign in to your account</h1>
            <p className="text-xs text-slate-400 mt-1">
              Enter your credentials or select a demo profile below.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@velozity.com"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <span className="text-[10px] text-slate-500 font-mono">Default: Password@123</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-sans"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center space-x-2 shadow-sm transition disabled:opacity-50"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-6 border-t border-[#30363d]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5 font-mono">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Demo Accounts</span>
            </div>

            <div className="space-y-2">
              {presetAccounts.map(p => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => { setEmail(p.email); setPassword('Password@123'); }}
                  className={`w-full text-left p-2.5 rounded-lg border transition flex items-center justify-between group ${
                    email === p.email
                      ? 'bg-blue-950/40 border-blue-600 text-white'
                      : 'bg-[#0d1117] border-[#30363d] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <p.icon className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-200">{p.role}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{p.email}</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#21262d] text-slate-400 border border-[#30363d] font-mono shrink-0 ml-2">
                    {p.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#30363d] px-6 py-4 text-center text-xs text-slate-500">
        Velozity Dashboard © 2026
      </footer>
    </div>
  );
};
