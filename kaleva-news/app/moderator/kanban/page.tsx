'use client';
import { useState } from 'react';
import KanbanBoard from '@/components/moderator/KanbanBoard';

export default function ModeratorKanbanPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (passcode === 'kaleva2026' || passcode === 'mod') {
      setIsAuthenticated(true);
    } else {
      alert("Invalid moderator passcode. Try 'kaleva2026'");
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md">
          <h1 className="text-xl font-black text-amber-400 mb-2">KALEVA MODERATOR PORTAL</h1>
          <p className="text-xs text-slate-400 mb-6">Enter your authorized moderator credentials to access the manual Kanban workflow.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Moderator Passcode</label>
              <input 
                type="password"
                placeholder="Enter passcode (e.g. kaleva2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg"
            >
              Access Kanban Dashboard 🔐
            </button>
          </form>
          <div className="mt-4 text-[10px] text-slate-500 text-center">
            Hint for hackathon demo: Passcode is <code className="text-amber-400">kaleva2026</code>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-black tracking-wider text-amber-400">
            KALEVA <span className="text-white text-xs font-normal">MODERATOR KANBAN WORKFLOW</span>
          </h1>
          <p className="text-[11px] text-slate-400">Manual review pipeline for citizen news and community stories.</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold">
            🟢 Moderator Online (ID: #MOD-07)
          </span>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto p-6">
        <KanbanBoard />
      </div>
    </main>
  );
}
