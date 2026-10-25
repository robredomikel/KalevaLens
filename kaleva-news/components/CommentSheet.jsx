'use client';

import { useState, useEffect } from 'react';
import { 
  getCommentsForArticle, 
  addComment, 
  deleteComment 
} from '@/app/actions/comments';

const CURRENT_USER_ID = "123";

export default function CommentSheet({ articleId, onToggleOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('half');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Fetch comments immediately on mount so the count is correct right away
  useEffect(() => {
    async function loadInitialComments() {
      if (articleId) {
        const dbComments = await getCommentsForArticle(articleId);
        setComments(dbComments || []);
      }
    }
    loadInitialComments();
  }, [articleId]);

  const totalCount = comments.length;

  const handleOpen = (e) => {
    e.stopPropagation();
    setIsOpen(true);
    setSheetMode('half');
    if (onToggleOpen) onToggleOpen(true);
  };

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsOpen(false);
    setSheetMode('half');
    if (onToggleOpen) onToggleOpen(false);
  };

  const handleScroll = (e) => {
    const scrollTop = e.target.scrollTop;
    if (scrollTop > 15 && sheetMode === 'half') {
      setSheetMode('full');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !articleId) return;

    const res = await addComment({
      articleId,
      userId: CURRENT_USER_ID,
      content: newCommentText.trim()
    });

    if (res.success) {
      setComments(prev => [...prev, res.comment]);
      setNewCommentText('');
    } else {
      alert(`Error posting comment: ${res.error}`);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const res = await deleteComment(commentId, CURRENT_USER_ID);

    if (res.success) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    } else {
      alert(`Error deleting comment: ${res.error}`);
    }
  };

  return (
    <div className="w-full text-left mt-1">
      <div 
        onClick={handleOpen}
        className="w-full flex items-center justify-between text-xs font-bold text-amber-400 py-1.5 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition"
      >
        <span>💬 Discussion ({totalCount})</span>
        <span className="text-[11px] text-slate-400 font-semibold hover:text-amber-300">View details ▼</span>
      </div>

      {isOpen && (
        <div 
          className="absolute inset-x-0 bottom-0 top-[-200px] z-50 bg-slate-950/60 backdrop-blur-[2px] flex flex-col justify-end"
          onClick={handleClose}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl transition-all duration-300 ease-out flex flex-col overflow-hidden ${
              sheetMode === 'full' ? 'h-[75vh]' : 'h-[40vh]'
            }`}
          >
            <div 
              onClick={() => setSheetMode(prev => prev === 'half' ? 'full' : 'half')}
              className="p-3 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none bg-slate-900 relative shrink-0"
            >
              <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto absolute left-1/2 -translate-x-1/2 top-1.5" />
              <div className="flex items-center gap-2 mt-1">
                <h4 className="text-xs font-bold text-white">Discussion ({totalCount})</h4>
                <span className="text-[9px] text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.5 rounded">
                  {sheetMode === 'full' ? 'Full View 🔼' : 'Scroll for more 🔽'}
                </span>
              </div>
              <button 
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white font-bold px-2 py-0.5"
              >
                ✕ Close
              </button>
            </div>

            <div 
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none"
            >
              {comments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No comments yet. Be the first to start the discussion!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-slate-200">
                        @{comment.userId === CURRENT_USER_ID ? 'You' : comment.userId || 'Anonymous'}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mb-2">{comment.content || comment.text}</p>
                    
                    <div className="flex items-center space-x-3">
                      {comment.userId === CURRENT_USER_ID && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-[10px] text-rose-400 hover:underline font-semibold"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="p-3 border-t border-slate-800 flex items-center gap-2 bg-slate-950 shrink-0">
              <input 
                type="text"
                placeholder="Share your thoughts..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button 
                type="submit"
                className="bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-full text-xs hover:bg-amber-300 transition"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
