'use client';
import { useState } from 'react';
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

  const moveCard = (cardId, newStage) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, stage: newStage } : c));
  };

  const columns = [
    { id: 'incoming', title: '1. Incoming Submissions', color: 'border-slate-800' },
    { id: 'review', title: '2. Moderator Review', color: 'border-blue-500/40' },
    { id: 'published', title: '3. Published / Rejected', color: 'border-emerald-500/40' }
  ];

  return (
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
                  <ModeratorCard key={card.id} card={card} onMoveCard={moveCard} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
