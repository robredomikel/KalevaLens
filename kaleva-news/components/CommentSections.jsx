'use client';
import { useState } from 'react';

export default function CommentSections({ articleId }) {
  const [isOpen, setIsOpen] = useState(false); // Toggle state for mobile view
  const [comments, setComments] = useState([
    {
      id: 1,
      author: 'Matti Meikäläinen',
      text: 'This is a huge milestone for Oulu tech ecosystem! Great to see local backing.',
      timestamp: '10m ago',
      replies: [
        {
          id: 101,
          author: 'Anna Virtanen',
          text: 'Totally agree! Excited to see how this scales.',
          timestamp: '5m ago',
        }
      ]
    },
    {
      id: 2,
      author: 'Juha Korhonen',
      text: 'Very informative summary. Thanks for posting.',
      timestamp: '25m ago',
      replies: []
    }
  ]);

  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const totalCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: Date.now(),
      author: 'You (Citizen Journalist)',
      text: newCommentText,
      timestamp: 'Just now',
      replies: []
    };

    setComments([newComment, ...comments]);
    setNewCommentText('');
  };

  const handleAddReply = (commentId) => {
    if (!replyText.trim()) return;

    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [
            ...comment.replies,
            {
              id: Date.now(),
              author: 'You (Citizen Journalist)',
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
    <div className="mt-2 pt-2 border-t border-slate-800 text-left">
      {/* 1. Always visible label/trigger at the bottom of the card */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-bold text-amber-400 py-1 px-2 rounded-lg bg-slate-950/40 hover:bg-slate-950/80 transition"
      >
        <span>💬 Discussion ({totalCount})</span>
        <span className="text-[10px] text-slate-400 font-normal">{isOpen ? 'Hide ▲' : 'View comments ▼'}</span>
      </button>

      {/* 2. Expanded view: shows input box and nested thread only when clicked */}
      {isOpen && (
        <div className="mt-3 space-y-3 animate-fadeIn">
          {/* Comment Input Box */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input 
              type="text"
              placeholder="Share your thoughts or ask a question..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button 
              type="submit"
              className="bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition hover:bg-amber-300"
            >
              Post
            </button>
          </form>

          {/* Comment Thread List */}
          <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1 scrollbar-none">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-200">@{comment.author}</span>
                  <span className="text-[10px] text-slate-500">{comment.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 mb-1.5">{comment.text}</p>
                
                <button 
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-[10px] text-slate-400 hover:text-amber-400 font-semibold"
                >
                  Reply
                </button>

                {/* Nested Reply Input */}
                {replyingTo === comment.id && (
                  <div className="mt-2 flex gap-2 pl-3 border-l-2 border-amber-400/40">
                    <input 
                      type="text"
                      placeholder={`Replying to @${comment.author}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button 
                      onClick={() => handleAddReply(comment.id)}
                      className="bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-[10px]"
                    >
                      Send
                    </button>
                  </div>
                )}

                {/* Nested Replies Stream */}
                {comment.replies.length > 0 && (
                  <div className="mt-2 pl-3 space-y-1.5 border-l border-slate-800">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="bg-slate-900/50 p-2 rounded-lg">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-bold text-amber-400/90">@{reply.author}</span>
                          <span className="text-[9px] text-slate-500">{reply.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
