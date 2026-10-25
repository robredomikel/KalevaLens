// @ts-nocheck -- legacy JSX page is incrementally typed.
'use client';

import { useState, useEffect } from 'react';
import { getAllModerationStories, updateStoryStage } from '@/app/actions/moderation';

export default function KanbanBoard() {
  const [columns, setColumns] = useState({
    PENDING: [],
    IN_PROGRESS: [],
    VERIFIED: [],
    REJECTED: []
  });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchStories = async () => {
    setLoading(true);
    const res = await getAllModerationStories();
    if (res.success) {
      setColumns(res.grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleMoveStage = async (storyId, targetStage) => {
    setProcessingId(storyId);
    const res = await updateStoryStage(storyId, targetStage);
    if (res.success) {
      await fetchStories();
    } else {
      alert(`Error updating stage: ${res.error}`);
    }
    setProcessingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-amber-400 text-xs uppercase tracking-widest animate-pulse">
        Loading moderation pipeline...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
      {/* 1. PENDING */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
        <h2 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
          ⏳ Pending ({columns.PENDING.length})
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3">
          {columns.PENDING.map(story => (
            <div key={story.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-md">
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded uppercase">@{story.community}</span>
              <h3 className="text-xs font-bold text-white mt-1.5 mb-1">{story.title}</h3>
              <div className="flex gap-1 mt-3">
                <button 
                  onClick={() => handleMoveStage(story.id, 'IN_PROGRESS')}
                  disabled={processingId === story.id}
                  className="flex-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-[10px] font-bold py-1 rounded-lg"
                >
                  Start Review ➔
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. IN PROGRESS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
        <h2 className="text-xs font-black text-blue-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
          ⚡ In Progress ({columns.IN_PROGRESS.length})
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3">
          {columns.IN_PROGRESS.map(story => (
            <div key={story.id} className="bg-slate-950 border border-blue-500/30 p-3 rounded-xl shadow-md">
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">@{story.community}</span>
              <h3 className="text-xs font-bold text-white mt-1.5 mb-1">{story.title}</h3>
              <div className="flex gap-1 mt-3">
                <button 
                  onClick={() => handleMoveStage(story.id, 'VERIFIED')}
                  disabled={processingId === story.id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1 rounded-lg"
                >
                  Verify ✓
                </button>
                <button 
                  onClick={() => handleMoveStage(story.id, 'REJECTED')}
                  disabled={processingId === story.id}
                  className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[10px] font-bold px-2 py-1 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. VERIFIED */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
        <h2 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
          ✅ Verified ({columns.VERIFIED.length})
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3">
          {columns.VERIFIED.map(story => (
            <div key={story.id} className="bg-slate-950 border border-emerald-500/30 p-3 rounded-xl shadow-md">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">@{story.community}</span>
              <h3 className="text-xs font-bold text-white mt-1.5 mb-1">{story.title}</h3>
              <span className="text-[10px] text-emerald-500 font-bold block mt-2">Live on Public Feed 🟢</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. REJECTED */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full">
        <h2 className="text-xs font-black text-rose-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
          ❌ Rejected ({columns.REJECTED.length})
        </h2>
        <div className="flex-1 overflow-y-auto space-y-3">
          {columns.REJECTED.map(story => (
            <div key={story.id} className="bg-slate-950 border border-rose-500/30 p-3 rounded-xl shadow-md opacity-75">
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded uppercase">@{story.community}</span>
              <h3 className="text-xs font-bold text-white mt-1.5 mb-1">{story.title}</h3>
              <button 
                onClick={() => handleMoveStage(story.id, 'PENDING')}
                disabled={processingId === story.id}
                className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1 rounded-lg"
              >
                Restore to Pending ↺
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
