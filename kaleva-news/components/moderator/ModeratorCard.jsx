'use client';

export default function ModeratorCard({ card, onMoveCard }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded">
            @{card.community}
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {card.category || 'Citizen Scoop'}
          </span>
        </div>

        <h3 className="text-sm font-bold text-white mb-2 leading-snug">
          {card.title}
        </h3>

        <p className="text-xs text-slate-400 line-clamp-3 mb-2">
          {card.summary}
        </p>

        <div className="text-[10px] text-slate-500">
          Author: <span className="text-slate-300">@{card.author}</span> • {card.timestamp}
        </div>
      </div>

      {/* Manual Action Buttons */}
      <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
        {card.stage === 'incoming' && (
          <button 
            onClick={() => onMoveCard(card.id, 'review')}
            className="w-full bg-amber-400 text-slate-950 font-bold py-1.5 rounded-xl text-xs hover:bg-amber-300 transition"
          >
            Send to Review ➔
          </button>
        )}

        {card.stage === 'review' && (
          <div className="flex w-full space-x-2">
            <button 
              onClick={() => onMoveCard(card.id, 'incoming')}
              className="bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
            >
              ← Back
            </button>
            <button 
              onClick={() => onMoveCard(card.id, 'rejected')}
              className="flex-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold py-1.5 rounded-xl text-xs hover:bg-rose-500/30 transition"
            >
              ✕ Reject
            </button>
            <button 
              onClick={() => onMoveCard(card.id, 'published')}
              className="flex-1 bg-emerald-500 text-slate-950 font-bold py-1.5 rounded-xl text-xs hover:bg-emerald-400 transition"
            >
              ✓ Publish
            </button>
          </div>
        )}

        {card.stage === 'published' && (
          <span className="text-[10px] text-emerald-400 font-bold w-full text-center">
            🚀 Live on Verified Feed
          </span>
        )}

        {card.stage === 'rejected' && (
          <span className="text-[10px] text-rose-400 font-bold w-full text-center">
            ❌ Archived / Rejected
          </span>
        )}
      </div>
    </div>
  );
}
