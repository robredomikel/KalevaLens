'use client';
import { useEffect, useState } from 'react';
import ModeratorCard from './ModeratorCard';

const initialKanbanCards = [
  {
    id: 'k1',
    stage: 'incoming',
    community: 'Oulu Tech Hub',
    title: 'New Quantum Computing Lab Planned for Linnanmaa Campus',
    summary: 'Unconfirmed whispers from faculty members suggest a major Nordic grant is being finalized.',
    author: 'CitizenJussi',
    timestamp: '15m ago'
  },
  {
    id: 'k2',
    stage: 'review',
    community: 'Oulu Food & Culture',
    title: 'Secret Pop-up Bakery Near Rotuaari Sells Out in 30 Mins',
    summary: 'Cross-referenced with local social media chatter and Instagram tags. High interest.',
    author: 'FoodieOulu',
    timestamp: '1h ago'
  },
  {
    id: 'k3',
    stage: 'published',
    community: 'Oulu Startup Founders',
    title: 'Arctic Startup Weekend Sets New Participant Record',
    summary: 'Successfully verified and pushed to the live user feed.',
    author: 'TechLeadOulu',
    timestamp: 'Yesterday'
  }
];

export default function KanbanBoard() {
  const [cards, setCards] = useState(initialKanbanCards);
  const [usingFallback, setUsingFallback] = useState(true);

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/editorial/tasks', { cache: 'no-store' });
      if (!response.ok) return;
      const tasks = await response.json();
      setCards(tasks.map((task) => ({
        id: task.id,
        stage: task.status === 'PENDING' ? (task.checkpoint === 'SOURCE_REVIEW' ? 'incoming' : 'review') : task.status === 'APPROVED' ? 'published' : 'rejected',
        community: task.candidate?.communityId || 'Editorial workflow',
        category: task.checkpoint === 'SOURCE_REVIEW' ? 'Source Investigation' : task.checkpoint === 'CORRECTION_REVIEW' ? 'Correction Review' : 'AI Draft Review',
        title: task.articleVersion?.headline || task.candidate?.title || 'Editorial review task',
        summary: task.reason || task.articleVersion?.lead || 'Review the supporting material and record an editorial decision.',
        author: 'KalevaLens workflow', timestamp: new Date(task.createdAt).toLocaleString(), persisted: true,
      })));
      setUsingFallback(false);
    } catch { /* Keep the labeled development fixtures available. */ }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTasks(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const decideCard = async (cardId, action) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card?.persisted) {
      const stage = action === 'approve' ? (card.stage === 'incoming' ? 'review' : 'published') : action === 'reject' ? 'rejected' : card.stage;
      setCards(cards.map(c => c.id === cardId ? { ...c, stage } : c));
      return;
    }
    const response = await fetch(`/api/editorial/tasks/${cardId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, notes: `Moderator selected ${action.replace('_', ' ')}.` }) });
    if (!response.ok) { const body = await response.json(); alert(body.error || 'Editorial transition failed.'); return; }
    await loadTasks();
  };

  const columns = [
    { id: 'incoming', title: '1. Incoming Submissions', color: 'border-slate-800' },
    { id: 'review', title: '2. Moderator Review', color: 'border-blue-500/40' },
    { id: 'published', title: '3. Published / Rejected', color: 'border-emerald-500/40' }
  ];

  return (
    <div>
      {usingFallback && <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">Development fixtures are shown because persistent editorial tasks are unavailable.</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
      {columns.map(col => {
        const colCards = cards.filter(c => {
          if (col.id === 'published') {
            return c.stage === 'published' || c.stage === 'rejected';
          }
          return c.stage === col.id;
        });

        return (
          <div key={col.id} className={`bg-slate-900 border ${col.color} rounded-3xl p-4 flex flex-col h-[calc(100vh-10rem)] shadow-xl`}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">{col.title}</h2>
              <span className="text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {colCards.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
              {colCards.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs italic">
                  No submissions in this stage
                </div>
              ) : (
                colCards.map(card => (
                  <ModeratorCard key={card.id} card={card} onDecision={decideCard} />
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
