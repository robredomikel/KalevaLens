'use client';

export default function ModeratorCard({ card, onDecision }) {
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
          <div className="grid w-full grid-cols-2 gap-1.5">
            <button onClick={() => onDecision(card.id, 'request_evidence')} className="rounded-xl bg-slate-800 py-1.5 text-[10px] font-bold text-slate-300">More evidence</button>
            <button onClick={() => onDecision(card.id, 'escalate')} className="rounded-xl bg-blue-500/20 py-1.5 text-[10px] font-bold text-blue-300">Escalate</button>
            <button onClick={() => onDecision(card.id, 'reject')} className="rounded-xl bg-rose-500/20 py-1.5 text-[10px] font-bold text-rose-400">Reject</button>
            <button onClick={() => onDecision(card.id, 'approve')} className="rounded-xl bg-amber-400 py-1.5 text-[10px] font-bold text-slate-950">Approve ➔</button>
          </div>
        )}

        {card.stage === 'review' && (
          <div className="grid w-full grid-cols-2 gap-1.5">
            <button 
              onClick={() => onDecision(card.id, 'request_changes')}
              className="bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
            >
              Changes
            </button>
            <button 
              onClick={() => onDecision(card.id, 'reject')}
              className="flex-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold py-1.5 rounded-xl text-xs hover:bg-rose-500/30 transition"
            >
              ✕ Reject
            </button>
            <button 
              onClick={() => onDecision(card.id, 'approve')}
              className="flex-1 bg-emerald-500 text-slate-950 font-bold py-1.5 rounded-xl text-xs hover:bg-emerald-400 transition"
            >
              {card.category === 'Correction Review' ? '✓ Resolve' : '✓ Publish'}
            </button>
            <button onClick={() => onDecision(card.id, 'escalate')} className="rounded-xl bg-blue-500/20 py-1.5 text-[10px] font-bold text-blue-300">Escalate</button>
          </div>
        )}

        {card.stage === 'published' && (
          <span className="text-[10px] text-emerald-400 font-bold w-full text-center">
            {card.category === 'Correction Review' ? '✓ Editorial review completed' : '🚀 Live on Verified Feed'}
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
