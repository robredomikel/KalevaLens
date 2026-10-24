'use client';
import { useEffect, useRef, useState } from 'react';
import { getArticleMediaStatus } from '@/app/actions/news';

export default function ArticleMediaControls({ articleId, canonicalId, title, media: initialMedia, language = 'en' }) {
  const audioRef = useRef(null);
  const [showAudio, setShowAudio] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(initialMedia);

  useEffect(() => {
    setCurrentMedia(initialMedia);
  }, [initialMedia]);

  const audio = currentMedia?.audio?.status === 'ready' ? currentMedia.audio : null;

  // Poll for media status if audio is not ready yet
  useEffect(() => {
    if (audio) return;

    let isSubscribed = true;
    const targetId = articleId || canonicalId;
    if (!targetId) return;

    const pollInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const updated = await getArticleMediaStatus(articleId, canonicalId, language);
        if (isSubscribed && updated?.audio) {
          setCurrentMedia(updated);
          if (updated.audio.status === 'ready') {
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [audio, articleId, canonicalId, language]);

  useEffect(() => {
    if (showAudio && audioRef.current) audioRef.current.play().catch(() => {});
  }, [showAudio]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" aria-label={`Media options for ${title}`}>
        <span className="text-[10px] font-semibold text-slate-400 px-2 py-1.5">Read</span>
        <button
          disabled={!audio}
          onClick={() => setShowAudio((value) => !value)}
          className="bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-amber-300 transition disabled:cursor-not-allowed"
          title={audio ? 'Play prepared AI audio explanation' : 'Audio is being prepared'}
        >
          ▶ Listen
        </button>
        {!audio && <span className="text-[10px] text-slate-500">Audio processing</span>}
      </div>
      {showAudio && audio && (
        <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-2">
          <audio ref={audioRef} controls preload="metadata" src={audio.url} className="h-9 w-full" />
          <p className="mt-1 text-[9px] text-slate-500">AI-generated audio explanation based on the original news article.</p>
        </div>
      )}
    </>
  );
}
