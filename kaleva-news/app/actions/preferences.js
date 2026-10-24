'use server';

import { getUserPreferences, persistUserPreferences, enqueuePreferredArticles, hasCompletedOnboarding } from '@/lib/preferences/service';
import { enqueueArticleMedia } from '@/lib/media/repository';

export async function loadPreferences(userId) {
  return getUserPreferences(userId);
}

export async function checkOnboardingStatus(userId) {
  if (!userId) return false;
  return hasCompletedOnboarding(userId);
}

export async function savePreferences(userId, input) {
  if (!userId) throw new Error('A signed-in user is required.');
  const preferences = await persistUserPreferences(userId, input);
  const articles = await enqueuePreferredArticles(preferences.articleLanguage, preferences.articleLength);
  for (let index = 0; index < articles.length; index += 10) {
    await Promise.all(articles.slice(index, index + 10).map((article) =>
      enqueueArticleMedia(article.id, preferences.audioLanguage, 30)
    ));
  }
  return { preferences, queuedArticles: articles.length };
}
