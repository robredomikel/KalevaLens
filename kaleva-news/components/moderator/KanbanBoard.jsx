'use client';
import { useState, useEffect } from 'react';
import ModeratorCard from './ModeratorCard';
import { getPendingEditorialTasks, submitModeratorDecision, triggerEditorialWorkflow } from '@/app/actions/news';

const fallbackCards = [
  {
    id: 'k1',
    stage: 'INCOMING',
    community: 'Oulu Tech Hub',
    title: 'New Quantum Computing Lab Planned for Linnanmaa Campus',
    summary: 'Unconfirmed whispers from faculty members suggest a major Nordic grant is being finalized.',
    author: 'CitizenJussi',
    timestamp: '15m ago'
  },
  {
    id: 'k2',
    stage: 'REVIEW',
    community: 'Oulu Food & Culture',
    title: 'Secret Pop-up Bakery Near Rotuaari Sells Out in 30 Mins',
    summary: 'Cross-referenced with local social media chatter and Instagram tags. High interest.',
    author: 'FoodieOulu',
    timestamp: '1h ago'
  },
  {
    id: 'k3',
    stage: 'PUBLISHED',
    community: 'Oulu Startup Founders',
    title: 'Arctic Startup Weekend Sets New Participant Record',
    summary: 'Successfully verified and pushed to the live user feed.',
    author: 'TechLeadOulu',
    timestamp: 'Yesterday'
  }
];

export default function KanbanBoard() {
  const [cards, setCards] = useState(fallbackCards);
  const [loading, setLoading] = useState(false);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getPendingEditorialTasks();
      if (res && res.success && res.submissions && res.submissions.length > 0) {
        const tasksByStory = new Map((res.tasks || []).map((task) => [String(task.storyId), task]));
        const formatted = res.submissions.map((sub) => ({
          taskId: tasksByStory.get(String(sub.id))?.id,
          auditReason: tasksByStory.get(String(sub.id))?.taskType === 'HITL_MEDIA_AUDIT'
            ? tasksByStory.get(String(sub.id))?.details?.error || 'Audio generation failed after all retries.'
            : null,
          id: sub.id,
          stage: sub.stage ? sub.stage.toUpperCase() : 'INCOMING',
          community: sub.community || 'Oulu',
          title: sub.title,
          summary: sub.summary,
          author: sub.authorId || 'citizen',
          aiScore: sub.aiScore || 85,
          timestamp: sub.createdAt ? new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
        }));
        setCards(formatted);
      }
    } catch (err) {
      console.error("Failed to load tasks from server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      setLoading(true);
      try {
        const res = await getPendingEditorialTasks();
        if (ignore) return;
        if (res && res.success && res.submissions && res.submissions.length > 0) {
          const tasksByStory = new Map((res.tasks || []).map((task) => [String(task.storyId), task]));
          const formatted = res.submissions.map((sub) => ({
            taskId: tasksByStory.get(String(sub.id))?.id,
            auditReason: tasksByStory.get(String(sub.id))?.taskType === 'HITL_MEDIA_AUDIT'
              ? tasksByStory.get(String(sub.id))?.details?.error || 'Audio generation failed after all retries.'
              : null,
            id: sub.id,
            stage: sub.stage ? sub.stage.toUpperCase() : 'INCOMING',
            community: sub.community || 'Oulu',
            title: sub.title,
            summary: sub.summary,
            author: sub.authorId || 'citizen',
            aiScore: sub.aiScore || 85,
            timestamp: sub.createdAt ? new Date(sub.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          }));
          setCards(formatted);
        }
      } catch (err) {
        console.error("Failed to load tasks from server:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, []);

  const moveCard = async (cardId, targetStage, decision = 'APPROVE') => {
    // Optimistic state update
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stage: targetStage } : c)));

    try {
      await submitModeratorDecision({
        taskId: cards.find((card) => card.id === cardId)?.taskId,
        storyId: cardId,
        decision,
        notes: `Moderator moved card to ${targetStage}`,
      });
    } catch (err) {
      console.error("Error submitting moderator decision:", err);
    }
  };

  const handleTriggerWorkflow = async () => {
    setTriggeringWorkflow(true);
    try {
      const result = await triggerEditorialWorkflow();
      if (result.success) {
        await loadData();
      } else {
        alert(`Workflow Note: ${result.message || result.error || 'Ingestion completed.'}`);
      }
    } catch (err) {
      console.error("Error triggering workflow:", err);
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const columns = [
    { id: 'INCOMING', title: '1. Incoming Submissions', color: 'border-slate-800' },
    { id: 'REVIEW', title: '2. Moderator Review (HITL-2)', color: 'border-blue-500/40' },
    { id: 'PUBLISHED', title: '3. Published / Rejected', color: 'border-emerald-500/40' }
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="text-xs text-slate-300">
          🤖 <span className="font-bold text-amber-400">Gemini Editorial Multi-Agent Pipeline</span> (LangGraph Orchestration)
        </div>
        <button
          onClick={handleTriggerWorkflow}
          disabled={triggeringWorkflow}
          className="bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs hover:bg-amber-300 transition shadow-md disabled:opacity-50"
        >
          {triggeringWorkflow ? "⚡ Ingesting & Verifying with Gemini Agents..." : "🚀 Run Gemini Agent Pipeline"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
        {columns.map(col => {
          const colCards = cards.filter(c => {
            if (col.id === 'PUBLISHED') {
              return c.stage === 'PUBLISHED' || c.stage === 'REJECTED';
            }
            return c.stage === col.id;
          });

          return (
            <div key={col.id} className={`bg-slate-900 border ${col.color} rounded-3xl p-4 flex flex-col h-[calc(100vh-14rem)] shadow-xl`}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 shrink-0">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">{col.title}</h2>
                <span className="text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  {colCards.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
                {loading ? (
                  <div className="text-center py-12 text-slate-500 text-xs animate-pulse">
                    Syncing database...
                  </div>
                ) : colCards.length === 0 ? (
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
    </div>
  );
}

