// lib/userService.js

/**
 * Service wrapper to track user interactions for profiling and personalization.
 * Currently uses local logging/stubbing; replace implementation with Supabase/Backend API.
 */

export async function trackArticleFeedback({ articleId, community, category, feedbackType }) {
  // feedbackType: 'like' | 'dislike' | 'neutral'
  
  console.log(`[USER PROFILING LOG] Article feedback updated:`, {
    articleId,
    community,
    category,
    feedbackType,
    timestamp: new Date().toISOString(),
  });

  // TODO: Connect to backend / Supabase
  /*
  const { data, error } = await supabase
    .from('user_feedback')
    .upsert({ 
      article_id: articleId, 
      feedback: feedbackType, 
      category: category,
      community: community,
      updated_at: new Date() 
    });
  if (error) console.error("Error saving user feedback:", error);
  return data;
  */

  return { success: true, message: "Feedback saved locally." };
}

export async function fetchUserProfile() {
  console.log(`[USER PROFILING LOG] Fetching user preference profile...`);

  // TODO: Connect to backend / Supabase to pull user preference vector
  return {
    likedCategories: ['Oulu Local', 'Nordic Culture'],
    dislikedCategories: [],
    subscribedCommunities: ['Oulu Tech Hub', 'Northern Photographers', 'Oulu Food & Culture']
  };
}
