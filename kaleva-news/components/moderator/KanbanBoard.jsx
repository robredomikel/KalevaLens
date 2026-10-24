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
    aiScore: 45,
    author: 'CitizenJussi',
    timestamp: '15m ago'
  },
  {
    id: 'k2',
    stage: 'ai-verification',
    community: 'Oulu Food & Culture',
    title: 'Secret Pop-up Bakery Near Rotuaari Sells Out in 30 Mins',
    summary: 'Cross-referenced with local social media chatter and Instagram tags. High confidence.',
    aiScore: 88,
    author: 'FoodieOulu',
    timestamp: '1h ago'
  },
  {
    id: 'k3',
    stage: 'review',
    community: 'Northern Photographers',
    title: 'Unusual Solar Halo Spotted Over Nallikari Beach',
    summary: 'Photos verified by meteorological logs. Ready for manual moderator sign-off.',
    aiScore: 92,
    author: 'AuroraHunter',
    timestamp: '3h ago'
  },
  {
    id: 'k4',
    stage: 'published',
    community: 'Oulu Startup Founders',
    title: 'Arctic Startup Weekend Sets New Participant Record',
    summary: 'Successfully verified and pushed to the live user feed.',
    aiScore: 98,
    author: 'TechLeadOulu',
    timestamp: 'Yesterday'
  }
];

export default function KanbanBoard() {
  const [cards, setCards] = useState(initialKanbanCards);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const moveCard = (cardId, newStage) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, stage: newStage } : c));
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (e, targetStage, targetColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { cardId, sourceColumn } = data;

      // If dropped in the same column, reorder priority
      if (sourceColumn === targetColumnId) {
        const colCards = cards.filter(c => {
          if (targetColumnId === 'published') return c.stage === 'published' || c.stage === 'rejected';
          return c.stage === targetColumnId;
        });

        const draggedCardIndex = colCards.findIndex(c => c.id === cardId);
        // Place it at the top or bottom of drop zone depending on interaction
        if (draggedCardIndex > -1) {
          const updatedColCards = [...colCards];
          const [movedCard] = updatedColCards.splice(draggedCardIndex, 1);
          updatedColCards.unshift(movedCard); // Move to top of priority list

          // Rebuild full cards array with new order
          const unselectedCards = cards.filter(c => {
            if (targetColumnId === 'published') return c.stage !== 'published' && c.stage !== 'rejected';
            return c.stage !== targetColumnId;
          });

          setCards([...unselectedCards, ...updatedColCards]);
        }
      } else {
        // Moved to a different column
        moveCard(cardId, targetStage);
      }
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const columns = [
    { id: 'incoming', title: '1. Incoming Submissions', color: 'border-slate-800' },
    { id: 'ai-verification', title: '2. AI Verification', color: 'border-amber-500/40' },
    { id: 'review', title: '3. Moderator Review', color: 'border-blue-500/40' },
    { id: 'published', title: '4. Published / Rejected', color: 'border-emerald-500/40' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full items-start">
      {columns.map(col => {
        const colCards = cards.filter(c => {
          if (col.id === 'published') {
            return c.stage === 'published' || c.stage === 'rejected';
          }
          return c.stage === col.id;
        });

        const isTargeted = dragOverColumn === col.id;

        return (
          <div 
            key={col.id} 
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, col.id === 'published' ? 'published' : col.id, col.id)}
            className={`bg-slate-900 border ${col.color} rounded-3xl p-4 flex flex-col h-[calc(100vh-10rem)] shadow-xl transition-all ${
              isTargeted ? 'ring-2 ring-amber-400 bg-slate-900/90' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">{col.title}</h2>
              <span className="text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                {colCards.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
              {colCards.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs italic">
                  Drop cards here
                </div>
              ) : (
                colCards.map((card, index) => (
                  <ModeratorCard 
                    key={card.id} 
                    card={card} 
                    index={index}
                    columnId={col.id}
                    onMoveCard={moveCard} 
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
