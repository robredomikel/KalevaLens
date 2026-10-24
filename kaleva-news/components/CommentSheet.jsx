'use client';
import { useState } from 'react';

const dummyComments = [
  {
    id: 1,
    author: 'Mohd Fahad',
    authorType: 'Author',
    text: 'The invisible layer of a business can be its most valuable part.',
    timestamp: '20h',
    replies: [
      {
        id: 101,
        author: 'Anna Virtanen',
        text: 'Totally agree! Excited to see how this scales.',
        timestamp: '5h ago'
      }
    ]
  },
  {
    id: 2,
    author: 'Gaurav Agrawaal',
    authorType: '2nd',
    text: 'In regulated sectors, reliable infrastructure is often the real competitive advantage.',
    timestamp: '12h',
    replies: []
  }
];

export default function CommentSheet({ articleId, onToggleOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('half'); // 'half' or 'full'
  const [comments, setComments] = useState(dummyComments);
  const [newCommentText, setNewCommentText] = useState('');
  
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const totalCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

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

  const addComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const newComm = {
      id: Date.now(),
      author: 'You (Journalist)',
      authorType: '',
      text: newCommentText,
      timestamp: 'Just now',
      replies: []
    };
    setComments([newComm, ...comments]);
    setNewCommentText('');
  };

  const addReply = (commentId, e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [
            ...comment.replies,
            {
              id: Date.now(),
              author: 'You (Journalist)',
              text: replyText,
              timestamp: 'Just now'
            }
          ]
        };
      }
      return comment;
    }));

    setReplyText('');
    setReplyingTo(null);
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
              {comments.map((comment) => (
                <div key={comment.id} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-slate-200">@{comment.author}</span>
                    {comment.authorType && (
                      <span className="text-[8px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1 py-0.5 rounded">
                        {comment.authorType}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">{comment.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{comment.text}</p>
                  
                  <button 
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="text-[10px] text-amber-400 hover:underline font-semibold"
                  >
                    Reply
                  </button>

                  {replyingTo === comment.id && (
                    <form onSubmit={(e) => addReply(comment.id, e)} className="mt-2 flex gap-2 pl-3 border-l-2 border-amber-400/40">
                      <input 
                        type="text"
                        placeholder={`Reply to @${comment.author}...`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                      <button 
                        type="submit"
                        className="bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-[10px]"
                      >
                        Send
                      </button>
                    </form>
                  )}

                  {comment.replies.length > 0 && (
                    <div className="mt-2 pl-3 space-y-2 border-l border-slate-800">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="bg-slate-900/50 p-2 rounded-lg">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-amber-400">@{reply.author}</span>
                            <span className="text-[9px] text-slate-500 ml-auto">{reply.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={addComment} className="p-3 border-t border-slate-800 flex items-center gap-2 bg-slate-950 shrink-0">
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
