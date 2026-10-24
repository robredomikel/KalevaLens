'use client';

export default function ModeratorCard({ card, index, columnId, onMoveCard, onReorderCard }) {
  const getAiBadgeColor = (score) => {
    if (score >= 85) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: card.id, sourceColumn: columnId, sourceIndex: index }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 hover:border-slate-700 cursor-grab active:cursor-grabbing transition opacity-100"
    >
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded">
            @{card.community}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getAiBadgeColor(card.aiScore)}`}>
            AI Confidence: {card.aiScore}%
          </span>
        </div>

        <h3 className="text-sm font-bold text-white mb-2 leading-snug">
          {card.title}
        </h3>

        <p className="text-xs text-slate-400 line-clamp-3 mb-2">
          {card.summary}
        </p>

        <div className="text-[10px] text-slate-500 flex justify-between items-center">
          <span>Author: <span className="text-slate-300">@{card.author}</span> • {card.timestamp}</span>
          <span className="text-slate-600 font-mono text-[9px]">#prio-{index + 1}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
        {card.stage === 'incoming' && (
          <button 
            onClick={() => onMoveCard(card.id, 'ai-verification')}
            className="w-full bg-amber-400 text-slate-950 font-bold py-1.5 rounded-xl text-xs hover:bg-amber-300 transition"
          >
            Run AI Verification ➔
          </button>
        )}

        {card.stage === 'ai-verification' && (
          <>
            <button 
              onClick={() => onMoveCard(card.id, 'incoming')}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1"
            >
              ← Back
            </button>
            <button 
              onClick={() => onMoveCard(card.id, 'review')}
              className="bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-amber-300 transition"
            >
              Send to Review ➔
            </button>
          </>
        )}

        {card.stage === 'review' && (
          <div className="flex w-full space-x-2">
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
              ✓ Publish Live
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
