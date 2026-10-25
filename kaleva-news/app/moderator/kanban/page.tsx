// @ts-nocheck -- legacy JSX page is incrementally typed.
/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import KanbanBoard from '@/components/moderator/KanbanBoard';

export default function ModeratorKanbanPage() {
  const router = useRouter();
  const [moderatorUser, setModeratorUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Authenticate and verify moderator role on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('kaleva_current_user');
      if (!storedUser) {
        router.push('/auth/login');
        return;
      }
      
      const user = JSON.parse(storedUser);
      if (user.role !== 'MODERATOR') {
        alert('Unauthorized access. This area is restricted to moderators.');
        router.push('/');
        return;
      }

      setModeratorUser(user);
      setIsCheckingAuth(false);
    }
  }, [router]);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kaleva_current_user');
    }
    router.push('/auth/login');
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-slate-950 text-amber-400 flex items-center justify-center text-xs tracking-widest uppercase animate-pulse">
        Verifying moderator credentials...
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
          <p className="text-[11px] text-slate-400">
            Logged in as <strong className="text-white">{moderatorUser?.name}</strong> • Manual review pipeline for citizen news.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-1 rounded-full font-bold">
            🟢 Moderator Online
          </span>
          <button 
            onClick={handleSignOut}
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs font-bold transition"
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
