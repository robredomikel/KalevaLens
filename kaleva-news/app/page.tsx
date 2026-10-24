// @ts-nocheck -- legacy JSX page is incrementally typed.
/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useRef, useEffect } from 'react';
import { mockSectionsData } from '@/data/mockNews';
import { trackArticleFeedback } from '@/lib/userService';
import CommentSheet from '@/components/CommentSheet';
import { markStoryAsRead } from '@/app/actions/news';
import { getPersonalizedFeed } from '@/app/actions/personalizedNews';
import { getBlendedOutsidePriorityFeed } from '@/app/actions/blendedNews';
import { 
  getCommunitiesList, 
  getCommunityFeed, 
  submitToCommunity, 
  verifyCommunityStory 
} from '@/app/actions/communityNews';
import { 
  getUserSubscribedCommunities, 
  toggleUserSubscription 
} from '@/app/actions/subscriptions';
import ArticleMediaControls from '@/components/ArticleMediaControls';
import PreferencesModal from '@/components/PreferencesModal';

const CURRENT_USER_ID = "123";

// ─── EXTRACTED CARD COMPONENT ───
function NewsCard({ 
  item, 
  index, 
  activeTab, 
  communitySubTab, 
  userFeedback, 
  handleFeedback, 
  handleCardSwipeOut, 
  onSheetToggle,
  onVerifySuccess 
}) {
  const feedback = userFeedback[item.id];
  const isSwipeableSection = activeTab === 'my-news' || activeTab === 'outside';

  const [dragOffset, setDragOffset] = useState({ x: 0, rot: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);
  const isGestureActiveRef = useRef(false);

  const handleSheetStateChange = (isOpen) => {
    setIsSheetOpen(isOpen);
    if (onSheetToggle) onSheetToggle(isOpen);
  };

  const handlePointerDown = (e) => {
    if (!isSwipeableSection || isSheetOpen) return;
    // Do not trigger swipe dragging if user is clicking/interacting with a button, link, audio, or input
    const targetEl = e.target;
    if (
      targetEl.closest('button') || 
      targetEl.closest('a') || 
      targetEl.closest('audio') || 
      targetEl.closest('input') || 
      targetEl.closest('textarea')
    ) {
      return;
    }

    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    isHorizontalSwipeRef.current = false;
    isGestureActiveRef.current = true;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isSwipeableSection || !isGestureActiveRef.current || isSheetOpen) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    // Detect direction on initial movement threshold (10px)
    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
        // Vertical gesture taking precedence - cancel horizontal drag
        isGestureActiveRef.current = false;
        setIsDragging(false);
        setDragOffset({ x: 0, rot: 0 });
        return;
      }
    }

    if (isHorizontalSwipeRef.current) {
      const rotation = diffX * 0.03; 
      setDragOffset({ x: diffX, rot: rotation });
    }
  };

  const handlePointerUp = () => {
    if (!isSwipeableSection || !isGestureActiveRef.current || isSheetOpen) {
      isGestureActiveRef.current = false;
      setIsDragging(false);
      return;
    }
    
    setIsDragging(false);
    isGestureActiveRef.current = false;
    
    const swipeThreshold = 140;

    if (isHorizontalSwipeRef.current && Math.abs(dragOffset.x) > swipeThreshold) {
      if (dragOffset.x > 0) {
        setDragOffset({ x: 600, rot: 25 });
        setTimeout(() => {
          handleFeedback(item, 'like');
          handleCardSwipeOut(item.id, 'right');
        }, 200);
      } else {
        setDragOffset({ x: -600, rot: -25 });
        setTimeout(() => {
          handleFeedback(item, 'dislike');
          handleCardSwipeOut(item.id, 'left');
        }, 200);
      }
    } else {
      setDragOffset({ x: 0, rot: 0 });
    }
    isHorizontalSwipeRef.current = false;
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    const res = await verifyCommunityStory(item.id);
    setIsVerifying(false);

    if (res.success) {
      alert(`Story verified successfully! Moved to Verified feed.`);
      if (onVerifySuccess) onVerifySuccess(item.id);
    } else {
      alert(`Error verifying story: ${res.error}`);
    }
  };

  return (
    <div 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translateX(${dragOffset.x}px) rotate(${dragOffset.rot}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        touchAction: isSwipeableSection && !isSheetOpen ? 'pan-y' : 'auto'
      }}
      className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between h-full snap-start relative overflow-visible ${
        dragOffset.x > 60 ? 'border-emerald-500 bg-emerald-950/20' :
        dragOffset.x < -60 ? 'border-rose-500 bg-rose-950/20' : 'border-slate-800'
      }`}
    >
      <div className="flex-1 flex flex-col justify-start">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2.5 py-1 rounded-md">
            {item.community || 'Kaleva'} • {item.category || 'News'} {index === 0 && '🔥 (First)'}
          </span>
          <div className="flex items-center space-x-2">
            {item.contentAccessLevel === 'SUMMARY_ONLY' ? (
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 px-1.5 py-0.5 rounded">
                Summary Only
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                Full Article
              </span>
            )}
            <span className="text-[11px] text-slate-400">{item.readTime || '1 min read'}</span>
          </div>
        </div>

        {item.imageUrl && (
          <div className="mb-3.5 rounded-2xl overflow-hidden w-full bg-slate-950 border border-slate-800 relative aspect-[16/9] max-h-60">
            <img 
              src={item.imageUrl} 
              alt={item.title || 'Article image'} 
              className="w-full h-full object-cover" 
              onError={(e) => {
                const target = e.currentTarget;
                if (target.parentElement) {
                  target.parentElement.style.display = 'none';
                }
              }}
            />
          </div>
        )}

        <h2 className="text-lg sm:text-xl font-bold mt-1 mb-2.5 leading-snug text-white">
          {item.title}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 mb-3.5">
          <span>Source: <strong className="text-slate-200">{item.authorId || item.publisher || 'Kaleva'}</strong></span>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold flex items-center space-x-1 ml-auto"
            >
              <span>🔗 Original Article</span>
            </a>
          )}
        </div>

        {item.preferredContentReady === false && (
          <p className="text-[10px] text-amber-300 mb-2 animate-pulse">Preparing your preferred language and length…</p>
        )}

        <ul className="space-y-2.5 mb-5">
          {(() => {
            const summaries = Array.isArray(item.summary) 
              ? item.summary 
              : item.summary ? [item.summary] : [];

            return summaries.map((bullet, idx) => (
              <li key={idx} className="text-slate-300 text-xs sm:text-sm flex items-start leading-relaxed">
                <span className="text-amber-400 mr-2.5 font-bold shrink-0">•</span> <span>{bullet}</span>
              </li>
            ));
          })()}
        </ul>

        {activeTab === 'communities' && (communitySubTab === 'unverified' || item.stage === 'PENDING') && (
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="mb-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-[11px] font-bold rounded-xl transition shadow-md w-full text-center"
          >
            {isVerifying ? 'Verifying...' : '✔ Verify Story (Moderator Action)'}
          </button>
        )}

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
        <ArticleMediaControls title={item.title} media={item.media} />

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

  const [allAvailableCommunities, setAllAvailableCommunities] = useState([
    'Indian', 'Spanish', 'Food', 'PhD Researcher in Oulu', 'Tech Jobs'
  ]);

  const [subscribedCommunities, setSubscribedCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [communitySubTab, setCommunitySubTab] = useState('verified');
  
  const [isManagingCommunities, setIsManagingCommunities] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [preferenceRevision, setPreferenceRevision] = useState(0);
  const [isWaitingForPreferences, setIsWaitingForPreferences] = useState(false);
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
  const [newPubCommunity, setSelectedPubCommunity] = useState('Indian');

  // Pagination States for Infinite Scroll
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [outsideOffset, setOutsideOffset] = useState(0);
  const [hasMoreOutside, setHasMoreOutside] = useState(true);
  const [isLoadingMoreOutside, setIsLoadingMoreOutside] = useState(false);

  // Database Community States
  const [communityArticles, setCommunityArticles] = useState([]);

  const containerRef = useRef(null);
  const communityButtonRefs = useRef({});
  const subscribedCommunitiesKey = Array.isArray(subscribedCommunities) ? subscribedCommunities.join(',') : '';

  // Fetch all communities & user's database active subscriptions on mount
  useEffect(() => {
    async function initCommunities() {
      const list = await getCommunitiesList();
      if (list.length > 0) {
        const names = list.map(c => c.name);
        setAllAvailableCommunities(names);
      }

      // Fetch ONLY communities this user is actively subscribed to from db (isActive = TRUE)
      const userSubs = await getUserSubscribedCommunities(CURRENT_USER_ID);
      if (userSubs.length > 0) {
        const subNames = userSubs.map(s => s.name);
        setSubscribedCommunities(subNames);
        setSelectedCommunity(subNames[0]);
      } else {
        setSubscribedCommunities([]);
        setSelectedCommunity('');
      }
    }
    initCommunities();
  }, []);

  // Fetch feed whenever activeTab, selectedCommunity, or communitySubTab changes
  useEffect(() => {
    async function loadCommunityFeedData() {
      if (activeTab === 'communities' && selectedCommunity) {
        setLoading(true);
        const isVerified = communitySubTab === 'verified';
        const stories = await getCommunityFeed(selectedCommunity, isVerified, 10, 0);
        setCommunityArticles(stories);
        setLoading(false);
      }
    }
    loadCommunityFeedData();
  }, [activeTab, selectedCommunity, communitySubTab]);

  // Load feeds dynamically when switching tabs, changing subscriptions, or updating preferences
  useEffect(() => {
    async function loadFeeds() {
      setLoading(true);
      if (activeTab === 'my-news') {
        const stories = await getPersonalizedFeed(CURRENT_USER_ID, subscribedCommunities, 10, 0);
        setArticlesData(prev => ({
          ...prev,
          'my-news': stories
        }));
        setPageOffset(0);
        setHasMore(true);
      } else if (activeTab === 'outside') {
        const blendedStories = await getBlendedOutsidePriorityFeed(CURRENT_USER_ID, 10, 0);
        setArticlesData(prev => ({
          ...prev,
          outside: blendedStories
        }));
        setOutsideOffset(0);
        setHasMoreOutside(true);
      }
      setLoading(false);
    }
    loadFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, subscribedCommunitiesKey, preferenceRevision]);

  // Infinite scroll loader for 'My News'
  const loadMoreArticles = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextOffset = pageOffset + 10;
    const moreStories = await getPersonalizedFeed(CURRENT_USER_ID, subscribedCommunities, 10, nextOffset);

    if (moreStories.length === 0) {
      setHasMore(false);
    } else {
      setArticlesData(prev => ({
        ...prev,
        'my-news': [...(prev['my-news'] || []), ...moreStories]
      }));
      setPageOffset(nextOffset);
    }
    setIsLoadingMore(false);
  };

  // Infinite scroll loader for 'Outside Sources'
  const loadMoreOutsideArticles = async () => {
    if (isLoadingMoreOutside || !hasMoreOutside) return;
    setIsLoadingMoreOutside(true);

    const nextOffset = outsideOffset + 10;
    const moreStories = await getBlendedOutsidePriorityFeed(CURRENT_USER_ID, nextOffset);

    if (moreStories.length === 0) {
      setHasMoreOutside(false);
    } else {
      setArticlesData(prev => ({
        ...prev,
        outside: [...(prev.outside || []), ...moreStories]
      }));
      setOutsideOffset(nextOffset);
    }
    setIsLoadingMoreOutside(false);
  };

  useEffect(() => {
    if (!isWaitingForPreferences) return;
    let refreshes = 0;
    const timer = window.setInterval(() => {
      refreshes += 1;
      setPreferenceRevision((value) => value + 1);
      if (refreshes >= 12) {
        window.clearInterval(timer);
        setIsWaitingForPreferences(false);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isWaitingForPreferences]);

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

  const handleCardSwipeOut = (itemId) => {
    markStoryAsRead(CURRENT_USER_ID, itemId);

    setArticlesData((prevData) => {
      const currentList = prevData[activeTab] || [];
      return {
        ...prevData,
        [activeTab]: currentList.filter(item => item.id !== itemId)
      };
    });
  };

  const handleCreatePublication = async (e) => {
    e.preventDefault();
    if (!newPubTitle.trim() || !newPubContent.trim()) {
      alert("Please fill in both title and content.");
      return;
    }

    const response = await submitToCommunity({
      title: newPubTitle,
      summary: newPubContent,
      content: newPubContent,
      community: newPubCommunity,
      category: 'Community Submission'
    });

    if (response.success) {
      alert("Publication submitted successfully as unverified!");
      setNewPubTitle('');
      setNewPubContent('');
      setIsCreatingPublication(false);
      setSelectedCommunity(newPubCommunity);
      setCommunitySubTab('unverified');
      setActiveTab('communities');
    } else {
      alert(`Error creating publication: ${response.error}`);
    }
  };

  const handleVerifySuccess = (verifiedStoryId) => {
    setCommunityArticles(prev => prev.filter(story => story.id !== verifiedStoryId));
  };
  
  // Handle Database Subscription / Unsubscription toggle
  const toggleCommunitySubscription = async (commName) => {
    const isCurrentlySubscribed = subscribedCommunities.includes(commName);

    if (isCurrentlySubscribed) {
      if (subscribedCommunities.length === 1) {
        alert("You must be subscribed to at least one community.");
        return;
      }
      // Unsubscribe in database (sets isActive = false)
      const res = await toggleUserSubscription(CURRENT_USER_ID, commName, false);
      if (res.success) {
        const updated = subscribedCommunities.filter(c => c !== commName);
        setSubscribedCommunities(updated);
        if (selectedCommunity === commName) {
          setSelectedCommunity(updated[0]);
        }
      } else {
        alert(`Error unsubscribing: ${res.error}`);
      }
    } else {
      // Subscribe in database (sets isActive = true)
      const res = await toggleUserSubscription(CURRENT_USER_ID, commName, true);
      if (res.success) {
        const updated = [...subscribedCommunities, commName];
        setSubscribedCommunities(updated);
        if (!selectedCommunity) {
          setSelectedCommunity(commName);
        }
      } else {
        alert(`Error subscribing: ${res.error}`);
      }
    }
  };

  const handleRefreshFeed = async () => {
    setIsRefreshing(true);
    setLoading(true);

    if (activeTab === 'communities') {
      const isVerified = communitySubTab === 'verified';
      const stories = await getCommunityFeed(selectedCommunity, isVerified, 10, 0);
      setCommunityArticles(stories);
    } else if (activeTab === 'my-news') {
      const stories = await getPersonalizedFeed(CURRENT_USER_ID, subscribedCommunities, 10, 0);
      setArticlesData(prev => ({ ...prev, 'my-news': stories }));
    } else if (activeTab === 'outside') {
      const stories = await getBlendedOutsidePriorityFeed(CURRENT_USER_ID, 10, 0);
      setArticlesData(prev => ({ ...prev, outside: stories }));
    }

    setLoading(false);
    setIsRefreshing(false);
    setPullDistance(0);
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
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

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
      return communityArticles;
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
            KALEVA <span className="text-white text-xs font-normal">LENS</span>
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
            <button onClick={() => setIsPreferencesOpen(true)} className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-3 text-slate-400 hover:bg-slate-800 hover:text-white">
              <span>⚙️</span> <span>Preferences</span>
            </button>
          </nav>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-400">
          Kaleva Lens <br />Hackathon Edition
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
        <div className="w-full relative flex-1 flex justify-center max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
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
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop > 50 && target.scrollHeight - target.scrollTop <= target.clientHeight + 150) {
                  if (activeTab === 'my-news') {
                    loadMoreArticles();
                  } else if (activeTab === 'outside') {
                    loadMoreOutsideArticles();
                  }
                }
              }}
              style={{
                transform: `translateY(${pullDistance}px)`,
                transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                overscrollBehaviorY: 'contain'
              }}
              className="h-[calc(100vh-7rem)] md:h-[calc(100vh-2rem)] w-full overflow-y-auto snap-y snap-mandatory md:snap-none space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-6 relative scrollbar-none pb-20 md:pb-12"
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
                  communitySubTab={communitySubTab}
                  userFeedback={userFeedback}
                  handleFeedback={handleFeedback}
                  handleCardSwipeOut={handleCardSwipeOut}
                  onSheetToggle={setIsAnySheetOpen}
                  onVerifySuccess={handleVerifySuccess}
                />
              ))}

              {/* Tab-aware Loading Indicators */}
              {activeTab === 'my-news' && isLoadingMore && (
                <div className="text-center py-4 text-amber-400 text-xs animate-pulse col-span-2">
                  Loading more unseen news...
                </div>
              )}
              {activeTab === 'outside' && isLoadingMoreOutside && (
                <div className="text-center py-4 text-amber-400 text-xs animate-pulse col-span-2">
                  Loading more blended outside sources...
                </div>
              )}
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
          <button onClick={() => setIsPreferencesOpen(true)} className="flex flex-col items-center flex-1 py-1 text-slate-400 hover:text-white transition">
            <span className="text-base">⚙️</span><span className="text-[10px] mt-0.5">Preferences</span>
          </button>
        </nav>

        <PreferencesModal userId={CURRENT_USER_ID} open={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} onSaved={() => { setPreferenceRevision((value) => value + 1); setIsWaitingForPreferences(true); }} />

        {/* MANAGE COMMUNITIES MODAL */}
        {isManagingCommunities && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
              
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Manage Communities</h3>
                  <p className="text-[11px] text-slate-400">Subscribe to topics to curate your personalized feed</p>
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
                  placeholder="Search communities..."
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
                  <p className="text-[11px] text-slate-400">Publish a news update or story</p>
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
