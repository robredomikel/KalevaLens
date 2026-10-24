'use client';
import { useState, useRef, useEffect } from 'react';
import { mockSectionsData } from '@/data/mockNews';
import { trackArticleFeedback } from '@/lib/userService';
import CommentSections from '@/components/CommentSections';
import CommentSheet from '@/components/CommentSheet';

// ─── EXTRACTED CARD COMPONENT ───
function NewsCard({ item, index, activeTab, userFeedback, handleFeedback, handleCardSwipeOut, onSheetToggle }) {
  const feedback = userFeedback[item.id];
  const isSwipeableSection = activeTab === 'my-news' || activeTab === 'outside';

  const [dragOffset, setDragOffset] = useState({ x: 0, rot: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const cardRef = useRef(null);
  const activeTouchRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef(0);
  const dragAxisRef = useRef(null);

  const handleSheetStateChange = (isOpen) => {
    setIsSheetOpen(isOpen);
    if (onSheetToggle) onSheetToggle(isOpen);
  };

  const completeSwipe = (cancelled = false) => {
    const offsetX = dragOffsetRef.current;
    activeTouchRef.current = null;
    dragAxisRef.current = null;
    setIsDragging(false);

    const cardWidth = cardRef.current?.offsetWidth || 400;
    const swipeThreshold = Math.min(140, cardWidth * 0.32);

    if (!cancelled && Math.abs(offsetX) > swipeThreshold) {
      if (offsetX > 0) {
        setDragOffset({ x: 600, rot: 30 });
        setTimeout(() => {
          handleFeedback(item, 'like');
          handleCardSwipeOut(item.id, 'right');
        }, 200);
      } else {
        setDragOffset({ x: -600, rot: -30 });
        setTimeout(() => {
          handleFeedback(item, 'dislike');
          handleCardSwipeOut(item.id, 'left');
        }, 200);
      }
    } else {
      dragOffsetRef.current = 0;
      setDragOffset({ x: 0, rot: 0 });
    }
  };

  // Safari may make React's delegated touchmove listener passive. Registering
  // directly on the card lets us cancel horizontal page panning on iOS.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !isSwipeableSection || isSheetOpen) return;

    const findTouch = (touches) => Array.from(touches).find(
      (touch) => touch.identifier === activeTouchRef.current
    );

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest?.('button, input, textarea, a, select')) return;
      const touch = e.touches[0];
      activeTouchRef.current = touch.identifier;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      dragOffsetRef.current = 0;
      dragAxisRef.current = null;
      setIsDragging(true);
    };

    const onTouchMove = (e) => {
      const touch = findTouch(e.touches);
      if (!touch) return;
      const diffX = touch.clientX - touchStartRef.current.x;
      const diffY = touch.clientY - touchStartRef.current.y;

      if (!dragAxisRef.current && Math.hypot(diffX, diffY) >= 8) {
        dragAxisRef.current = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
      }

      if (dragAxisRef.current === 'x') {
        e.preventDefault();
        dragOffsetRef.current = diffX;
        setDragOffset({ x: diffX, rot: diffX * 0.03 });
      }
    };

    const onTouchEnd = (e) => {
      if (!findTouch(e.changedTouches)) return;
      completeSwipe(false);
    };

    const onTouchCancel = (e) => {
      if (!findTouch(e.changedTouches)) return;
      // WebKit can emit touchcancel when a finger leaves the original nested
      // scroll area. Keep a confirmed horizontal swipe instead of discarding it.
      completeSwipe(dragAxisRef.current !== 'x');
    };

    card.addEventListener('touchstart', onTouchStart, { passive: true });
    // Capture on window so Safari cannot strand the gesture when it retargets
    // the touch from the card to its nested scrolling container.
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });
    return () => {
      card.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchCancel, true);
    };
  });

  // Pointer events retain desktop mouse dragging without affecting iOS touch.
  const handlePointerDown = (e) => {
    if (!isSwipeableSection || isSheetOpen || e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('button, input, textarea, a, select')) return;

    activeTouchRef.current = e.pointerId;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = 0;
    dragAxisRef.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (e.pointerType !== 'mouse' || activeTouchRef.current !== e.pointerId || isSheetOpen) return;
    const diffX = e.clientX - touchStartRef.current.x;
    const diffY = e.clientY - touchStartRef.current.y;

    // Wait for a small amount of movement before locking the gesture axis.
    // This avoids a slightly diagonal vertical scroll becoming a card swipe.
    if (!dragAxisRef.current && Math.hypot(diffX, diffY) >= 8) {
      dragAxisRef.current = Math.abs(diffX) > Math.abs(diffY) ? 'x' : 'y';
    }

    if (dragAxisRef.current === 'x') {
      dragOffsetRef.current = diffX;
      setDragOffset({ x: diffX, rot: diffX * 0.03 });
    }
  };

  const finishPointerGesture = (e, cancelled = false) => {
    if (e.pointerType !== 'mouse' || activeTouchRef.current !== e.pointerId) return;
    completeSwipe(cancelled);
  };

  return (
    <div 
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onPointerCancel={(e) => finishPointerGesture(e, true)}
      style={{
        transform: `translateX(${dragOffset.x}px) rotate(${dragOffset.rot}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        touchAction: isSwipeableSection && !isSheetOpen ? 'pan-y' : 'auto'
      }}
      className={`bg-slate-900 border rounded-3xl p-5 shadow-2xl flex flex-col justify-between shrink-0 h-[calc(100vh-8.5rem)] md:h-[450px] snap-center relative overflow-hidden ${
        dragOffset.x > 60 ? 'border-emerald-500 bg-emerald-950/20' :
        dragOffset.x < -60 ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'
      }`}
    >
      <div className="overflow-y-auto pr-1 scrollbar-none flex-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 rounded">
            {item.community} • {item.category} {index === 0 && '🔥 (First)'}
          </span>
          <span className="text-[11px] text-slate-400">{item.readTime}</span>
        </div>

        <h2 className="text-lg sm:text-xl font-bold mt-1 mb-3 leading-snug text-white">
          {item.title}
        </h2>

        <ul className="space-y-2.5 mb-4">
          {item.summary && item.summary.map((bullet, idx) => (
            <li key={idx} className="text-slate-300 text-xs sm:text-sm flex items-start leading-relaxed">
              <span className="text-amber-400 mr-2 font-bold">•</span> {bullet}
            </li>
          ))}
        </ul>

        {isSwipeableSection && (
          <div className="text-[10px] text-slate-500 text-center italic mt-2">
            👉 Drag far right to like · 👈 Drag far left to dismiss
          </div>
        )}
      </div>

      <div className="shrink-0 my-2">
        <CommentSheet articleId={item.id} onToggleOpen={handleSheetStateChange} />
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex space-x-2">
          <button 
            onClick={() => alert(`Playing AI Audio stream for: ${item.title}`)}
            className="bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1 hover:bg-amber-300 transition shadow-lg active:scale-95"
          >
            <span>▶ Listen</span>
          </button>

          <button 
            onClick={() => alert(`Opening AI Video Summary for: ${item.title}`)}
            className="bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-2.5 py-1.5 rounded-xl text-xs hover:bg-slate-700 transition active:scale-95"
          >
            🎬 Video
          </button>
        </div>

        {activeTab === 'communities' ? (
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleFeedback(item, 'like')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                feedback === 'like'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👍</span>
            </button>

            <button
              onClick={() => handleFeedback(item, 'dislike')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                feedback === 'dislike'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👎</span>
            </button>
          </div>
        ) : (
          <>
            {dragOffset.x > 60 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 animate-pulse">
                👍 LIKE
              </span>
            )}
            {dragOffset.x < -60 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-500/20 text-rose-400 animate-pulse">
                👎 DISMISS
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN FEED PAGE ───
export default function FeedPage() {
  const [activeTab, setActiveTab] = useState('my-news');

  const [allAvailableCommunities] = useState([
    'Oulu Tech Hub', 'Northern Photographers', 'Oulu Food & Culture', 
    'Oulu Startup Founders', 'University Students Oulu', 'Northern Finland Real Estate',
    'Oulu Cycling & Outdoors', 'Local Musicians & Artists', 'Oulu Gaming & Esports',
    'Ostrobothnia Weather Watchers', 'Oulu Volunteer Network', 'Finnish Tech News'
  ]);

  const [subscribedCommunities, setSubscribedCommunities] = useState(['Oulu Tech Hub', 'Northern Photographers', 'Oulu Food & Culture']);
  const [selectedCommunity, setSelectedCommunity] = useState('Oulu Tech Hub');
  const [communitySubTab, setCommunitySubTab] = useState('verified');
  
  const [isManagingCommunities, setIsManagingCommunities] = useState(false);
  const [communitySearchQuery, setCommunitySearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [articlesData, setArticlesData] = useState(mockSectionsData);
  const [userFeedback, setUserFeedback] = useState({});

  // Touch States
  const [startY, setStartY] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnySheetOpen, setIsAnySheetOpen] = useState(false);

  // Publication Modal States
  const [isCreatingPublication, setIsCreatingPublication] = useState(false);
  const [newPubTitle, setNewPubTitle] = useState('');
  const [newPubContent, setNewPubContent] = useState('');
  const [newPubCommunity, setSelectedPubCommunity] = useState('Oulu Tech Hub');

  const containerRef = useRef(null);
  const communityButtonRefs = useRef({});

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const activeBtn = communityButtonRefs.current[selectedCommunity];
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      }
    }
  }, [selectedCommunity]);

  const handleCardSwipeOut = (itemId, direction) => {
    setArticlesData((prevData) => {
      const currentList = prevData[activeTab] || [];
      return {
        ...prevData,
        [activeTab]: currentList.filter(item => item.id !== itemId)
      };
    });
  };

  const handleCreatePublication = (e) => {
    e.preventDefault();
    if (!newPubTitle.trim() || !newPubContent.trim()) {
      alert("Please fill in both title and content.");
      return;
    }

    const newArticle = {
      id: `pub-${Date.now()}`,
      category: 'My Story',
      community: newPubCommunity,
      title: newPubTitle,
      summary: [newPubContent],
      readTime: '1 min read'
    };

    setArticlesData((prev) => ({
      ...prev,
      published: [newArticle, ...(prev.published || [])]
    }));

    setNewPubTitle('');
    setNewPubContent('');
    setIsCreatingPublication(false);
    setActiveTab('published');
  };
  
  const toggleCommunitySubscription = (commName) => {
    if (subscribedCommunities.includes(commName)) {
      if (subscribedCommunities.length === 1) {
        alert("You must be subscribed to at least one community.");
        return;
      }
      const updated = subscribedCommunities.filter(c => c !== commName);
      setSubscribedCommunities(updated);
      if (selectedCommunity === commName) {
        setSelectedCommunity(updated[0]);
      }
    } else {
      setSubscribedCommunities([...subscribedCommunities, commName]);
    }
  };

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setLoading(true);
    setTimeout(() => {
      setArticlesData((prevData) => {
        const currentList = activeTab === 'communities' 
          ? [...(prevData.communities[selectedCommunity]?.[communitySubTab] || [])]
          : [...(prevData[activeTab] || [])];

        if (currentList.length > 0) {
          const shiftedItem = currentList.shift();
          currentList.push(shiftedItem);
        }

        if (activeTab === 'communities') {
          return {
            ...prevData,
            communities: {
              ...prevData.communities,
              [selectedCommunity]: {
                ...(prevData.communities[selectedCommunity] || { verified: [], unverified: [] }),
                [communitySubTab]: currentList
              }
            }
          };
        } else {
          return {
            ...prevData,
            [activeTab]: currentList
          };
        }
      });
      setLoading(false);
      setIsRefreshing(false);
      setPullDistance(0);
    }, 450);
  };

  const handleTouchStart = (e) => {
    if (isAnySheetOpen) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);

    if (isRefreshing) return;
    if (containerRef.current && containerRef.current.scrollTop <= 1) {
      setStartY(e.touches[0].clientY);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (isAnySheetOpen || !isDragging || startY === 0) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // A card owns horizontal gestures. Do not let pull-to-refresh translate
    // the whole feed while an iPhone user is swiping a story.
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setPullDistance(0);
      return;
    }

    if (deltaY > 0 && containerRef.current && containerRef.current.scrollTop <= 1) {
      const damped = Math.min(Math.pow(deltaY, 0.82) * 1.8, 120);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = (e) => {
    if (isAnySheetOpen) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (typeof window !== 'undefined' && window.innerWidth < 768 && activeTab === 'communities' && Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      const currentIndex = subscribedCommunities.indexOf(selectedCommunity);
      if (diffX < 0) {
        const nextIndex = (currentIndex + 1) % subscribedCommunities.length;
        setSelectedCommunity(subscribedCommunities[nextIndex]);
      } else {
        const prevIndex = (currentIndex - 1 + subscribedCommunities.length) % subscribedCommunities.length;
        setSelectedCommunity(subscribedCommunities[prevIndex]);
      }
    }

    if (!isDragging) return;
    setIsDragging(false);

    if (pullDistance > 65) {
      setPullDistance(80);
      handleRefreshFeed();
    } else {
      setPullDistance(0);
    }
    setStartY(0);
  };
  
  const handleFeedback = (item, type) => {
    const currentStatus = userFeedback[item.id];
    const newStatus = currentStatus === type ? null : type;

    setUserFeedback((prev) => ({
      ...prev,
      [item.id]: newStatus
    }));

    trackArticleFeedback({
      articleId: item.id,
      community: item.community,
      category: item.category,
      feedbackType: newStatus || 'neutral'
    });
  };

  const getActiveItems = () => {
    if (activeTab === 'communities') {
      const communityFeed = articlesData.communities?.[selectedCommunity];
      return communityFeed ? communityFeed[communitySubTab] : [];
    }
    return articlesData[activeTab] || [];
  };

  const currentItems = getActiveItems();
  const filteredCommunitiesForManagement = allAvailableCommunities.filter(c => 
    c.toLowerCase().includes(communitySearchQuery.toLowerCase())
  );

  return (
    <main
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-hidden select-none relative"
    >
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 p-5 h-screen justify-between shrink-0">
        <div>
          <h1 className="text-lg font-black tracking-wider text-amber-400 mb-6">
            KALEVA <span className="text-white text-xs font-normal">MICRO</span>
          </h1>
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('my-news')}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-3 ${activeTab === 'my-news' ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>📰</span> <span>My News</span>
            </button>
            <button 
              onClick={() => setActiveTab('outside')}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-3 ${activeTab === 'outside' ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>🌐</span> <span>Outside Sources</span>
            </button>
            <button 
              onClick={() => setActiveTab('communities')}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-3 ${activeTab === 'communities' ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>👥</span> <span>Communities</span>
            </button>
            <button 
              onClick={() => setActiveTab('published')}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-3 ${activeTab === 'published' ? 'bg-amber-400 text-slate-950 shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>✍️</span> <span>Published by Me</span>
            </button>
          </nav>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400">
          Kaleva AI Micro-News <br />Hackathon Edition
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col items-center h-screen overflow-hidden py-3 px-3 relative">
        
        {/* Communities Subnav */}
        {activeTab === 'communities' && (
          <div className="w-full max-w-md mb-2 space-y-2 z-10 shrink-0">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1 flex-1 mr-2">
                {subscribedCommunities.map((comm) => (
                  <button
                    key={comm}
                    ref={(el) => (communityButtonRefs.current[comm] = el)}
                    onClick={() => { setSelectedCommunity(comm); setPullDistance(0); }}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg whitespace-nowrap transition border ${
                      selectedCommunity === comm 
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md scale-105' 
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    @{comm}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsManagingCommunities(true)}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center space-x-1"
              >
                <span>⚙️ ({subscribedCommunities.length})</span>
              </button>
            </div>

            <div className="flex justify-center space-x-2">
              <button 
                onClick={() => { setCommunitySubTab('verified'); setPullDistance(0); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-full border transition ${communitySubTab === 'verified' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-slate-800 text-slate-400'}`}
              >
                ✓ Verified Posts
              </button>
              <button 
                onClick={() => { setCommunitySubTab('unverified'); setPullDistance(0); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-full border transition ${communitySubTab === 'unverified' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-slate-800 text-slate-400'}`}
              >
                ⚠ Unverified / Citizen
              </button>
            </div>
          </div>
        )}

        {/* Feed Container */}
        <div className="w-full relative flex-1 flex justify-center max-w-md md:max-w-4xl">
          {loading ? (
            <div className="text-center py-20 text-amber-400 text-xs tracking-wider uppercase animate-pulse">
              Rotating news stack...
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm bg-slate-900/50 rounded-2xl border border-slate-800 w-full">
              No articles found in this section.
            </div>
          ) : (
            <div 
              ref={containerRef}
              style={{
                transform: `translateY(${pullDistance}px)`,
                transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                overscrollBehaviorY: 'contain'
              }}
              className={`h-[calc(100vh-7rem)] md:h-[calc(100vh-2rem)] w-full overflow-y-scroll md:overflow-y-auto ${
                activeTab === 'my-news' || activeTab === 'outside' ? 'snap-none' : 'snap-y snap-mandatory'
              } space-y-4 md:grid md:grid-cols-2 md:gap-4 relative scrollbar-none`}
            >
              {pullDistance > 15 && (
                <div className="w-full py-2 flex items-center justify-center text-amber-400 text-xs font-bold bg-slate-900/90 border border-slate-800 rounded-2xl shadow-inner shrink-0 md:hidden snap-center">
                  <span>{pullDistance > 65 ? "🔄 Release to Shuffle & Rotate Feed" : "⬇ Pull down..."}</span>
                </div>
              )}

              {currentItems.map((item, index) => (
                <NewsCard 
                  key={`${item.id}-${index}`}
                  item={item}
                  index={index}
                  activeTab={activeTab}
                  userFeedback={userFeedback}
                  handleFeedback={handleFeedback}
                  handleCardSwipeOut={handleCardSwipeOut}
                  onSheetToggle={setIsAnySheetOpen}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── FLOATING ACTION BUTTON (FAB) ─── */}
      {activeTab === 'published' && (
        <button
          onClick={() => setIsCreatingPublication(true)}
          className="fixed right-6 bottom-20 md:bottom-8 z-50 bg-amber-400 text-slate-950 w-14 h-14 rounded-full flex items-center justify-center font-black shadow-2xl hover:bg-amber-300 transition-transform active:scale-95 border-2 border-slate-950"
          title="Create New Publication"
        >
          <span className="text-3xl leading-none mb-0.5">+</span>
        </button>
      )}



        {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2.5 px-4 z-40 max-w-md mx-auto rounded-t-2xl shadow-2xl flex justify-around items-center md:hidden">
        <button 
            onClick={() => { setActiveTab('my-news'); setPullDistance(0); }}
            className={`flex flex-col items-center flex-1 py-1 transition ${activeTab === 'my-news' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="text-base">📰</span>
            <span className="text-[10px] mt-0.5">My News</span>
          </button>

          <button 
            onClick={() => { setActiveTab('outside'); setPullDistance(0); }}
            className={`flex flex-col items-center flex-1 py-1 transition ${activeTab === 'outside' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="text-base">🌐</span>
            <span className="text-[10px] mt-0.5">Outside</span>
          </button>

          <button 
            onClick={() => { setActiveTab('communities'); setPullDistance(0); }}
            className={`flex flex-col items-center flex-1 py-1 transition ${activeTab === 'communities' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="text-base">👥</span>
            <span className="text-[10px] mt-0.5">Communities</span>
          </button>

          <button 
            onClick={() => { setActiveTab('published'); setPullDistance(0); }}
            className={`flex flex-col items-center flex-1 py-1 transition ${activeTab === 'published' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="text-base">✍️</span>
            <span className="text-[10px] mt-0.5">Published</span>
          </button>
        </nav>

        {/* MANAGE COMMUNITIES MODAL */}
        {isManagingCommunities && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Manage Communities</h3>
                  <p className="text-[11px] text-slate-400">Subscribe to topics to curate your micro-feed</p>
                </div>
                <button 
                  onClick={() => setIsManagingCommunities(false)}
                  className="bg-slate-800 text-slate-300 hover:text-white px-3 py-1 rounded-lg text-xs font-bold"
                >
                  ✕ Done
                </button>
              </div>

              <div className="mb-3">
                <input 
                  type="text" 
                  placeholder="Search hundreds of communities..."
                  value={communitySearchQuery}
                  onChange={(e) => setCommunitySearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="overflow-y-auto space-y-2 pr-1 flex-1 scrollbar-none">
                {filteredCommunitiesForManagement.map((comm) => {
                  const isSubscribed = subscribedCommunities.includes(comm);

                  return (
                    <div 
                      key={comm}
                      onClick={() => toggleCommunitySubscription(comm)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        isSubscribed 
                          ? 'bg-amber-400/10 border-amber-400/40 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">@{comm}</span>
                      <button className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                        isSubscribed 
                          ? 'bg-amber-400 text-slate-950' 
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {isSubscribed ? 'Subscribed ✓' : '+ Subscribe'}
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* NEW PUBLICATION MODAL */}
        {isCreatingPublication && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-bold text-white">New Publication</h3>
                  <p className="text-[11px] text-slate-400">Publish a micro-news update or story</p>
                </div>
                <button 
                  onClick={() => setIsCreatingPublication(false)}
                  className="bg-slate-800 text-slate-300 hover:text-white px-3 py-1 rounded-lg text-xs font-bold"
                >
                  ✕ Cancel
                </button>
              </div>

              <form onSubmit={handleCreatePublication} className="space-y-3 overflow-y-auto pr-1 scrollbar-none flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Title</label>
                  <input 
                    type="text" 
                    placeholder="Enter publication title..."
                    value={newPubTitle}
                    onChange={(e) => setNewPubTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Content / Summary</label>
                  <textarea 
                    rows="4"
                    placeholder="Write your story bullets or content..."
                    value={newPubContent}
                    onChange={(e) => setNewPubContent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Community Tag</label>
                  <select 
                    value={newPubCommunity}
                    onChange={(e) => setSelectedPubCommunity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {allAvailableCommunities.map((comm) => (
                      <option key={comm} value={comm}>@{comm}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg mt-2"
                >
                  Publish Story 🚀
                </button>
              </form>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
