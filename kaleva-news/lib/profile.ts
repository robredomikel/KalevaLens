import { isValidCommunityId } from '@/data/communities'

export type FinnishPracticeFrequency = 'none' | 'occasionally' | 'regularly'
export type FinnishPracticeMode = 'translation' | 'simplified' | 'original' | null

export interface UserPreferences {
  preferredLanguage: string
  finnishPracticeFrequency: FinnishPracticeFrequency | ''
  finnishPracticeMode: FinnishPracticeMode
  userSituation: string
  timeInFinland: string
  finnishSocietyFamiliarity: string
  topicInterests: string[]
  newsGoals: string[]
  contextLevel: string
  discoveryOpenness: number
}

export interface UserProfile {
  userId: string
  preferences: UserPreferences
  communityId: string | null
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  currentQuestion: number
  createdAt: string
  updatedAt: string
}

export interface MockSession {
  userId: string
  email: string
  name: string
}

export const TOPIC_IDS = [
  'science_technology', 'local_news_events', 'politics_society', 'culture_traditions',
  'education_careers', 'economy_business', 'nature_environment', 'sports_leisure',
] as const

export const GOAL_IDS = [
  'understand_local', 'learn_society', 'discover_events', 'connect_community',
  'different_perspectives', 'practical_information',
] as const

const SESSION_KEY = 'kalevalens:session'
const profileKey = (userId: string) => `kalevalens:profile:${userId}`

export const defaultPreferences: UserPreferences = {
  preferredLanguage: '',
  finnishPracticeFrequency: '',
  finnishPracticeMode: null,
  userSituation: '',
  timeInFinland: '',
  finnishSocietyFamiliarity: '',
  topicInterests: [],
  newsGoals: [],
  contextLevel: '',
  discoveryOpenness: 50,
}

export function createUserId(email: string): string {
  return email.trim().toLowerCase()
}

export function setSession(email: string, name = ''): MockSession {
  const session = { userId: createUserId(email), email: email.trim().toLowerCase(), name: name.trim() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getSession(): MockSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getUserProfile(userId: string): UserProfile | null {
  try {
    const value = localStorage.getItem(profileKey(userId))
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function createEmptyProfile(userId: string): UserProfile {
  const now = new Date().toISOString()
  return {
    userId,
    preferences: { ...defaultPreferences },
    communityId: null,
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    currentQuestion: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function validateProfile(profile: UserProfile, requireComplete = false): string[] {
  const errors: string[] = []
  const p = profile.preferences
  const required = [p.preferredLanguage, p.finnishPracticeFrequency, p.userSituation, p.timeInFinland, p.finnishSocietyFamiliarity, p.contextLevel]
  if (requireComplete && required.some((value) => !value)) errors.push('Please answer all required questions.')
  if (p.finnishPracticeFrequency !== 'none' && requireComplete && !p.finnishPracticeMode) errors.push('Choose how you would like to practice Finnish.')
  if (p.finnishPracticeFrequency === 'none' && p.finnishPracticeMode !== null) errors.push('Finnish practice mode must be empty when practice is disabled.')
  if (!Number.isInteger(p.discoveryOpenness) || p.discoveryOpenness < 0 || p.discoveryOpenness > 100) errors.push('Discovery openness must be between 0 and 100.')
  if (p.topicInterests.some((id) => !TOPIC_IDS.includes(id as typeof TOPIC_IDS[number]))) errors.push('A selected topic is invalid.')
  if (p.newsGoals.some((id) => !GOAL_IDS.includes(id as typeof GOAL_IDS[number]))) errors.push('A selected news goal is invalid.')
  if (!isValidCommunityId(profile.communityId)) errors.push('The selected community is unavailable.')
  return errors
}

export function saveUserProfile(profile: UserProfile): UserProfile {
  if (profile.userId !== getSession()?.userId) throw new Error('You can only update your own profile.')
  const normalized: UserProfile = {
    ...profile,
    preferences: {
      ...profile.preferences,
      finnishPracticeMode: profile.preferences.finnishPracticeFrequency === 'none' ? null : profile.preferences.finnishPracticeMode,
      discoveryOpenness: Math.max(0, Math.min(100, Math.round(profile.preferences.discoveryOpenness))),
    },
    updatedAt: new Date().toISOString(),
  }
  const errors = validateProfile(normalized)
  if (errors.length) throw new Error(errors[0])
  localStorage.setItem(profileKey(profile.userId), JSON.stringify(normalized))
  return normalized
}

export function completeOnboarding(profile: UserProfile): UserProfile {
  const errors = validateProfile(profile, true)
  if (errors.length) throw new Error(errors[0])
  return saveUserProfile({
    ...profile,
    onboardingCompleted: true,
    onboardingCompletedAt: profile.onboardingCompletedAt || new Date().toISOString(),
  })
}

export const getUserPreferences = (userId: string) => getUserProfile(userId)?.preferences ?? null
export const hasCompletedOnboarding = (userId: string) => Boolean(getUserProfile(userId)?.onboardingCompleted)
export const getUserCommunity = (userId: string) => getUserProfile(userId)?.communityId ?? null

export function updateUserPreferences(userId: string, preferences: UserPreferences) {
  const profile = getUserProfile(userId) ?? createEmptyProfile(userId)
  return saveUserProfile({ ...profile, preferences })
}

export function updateUserCommunity(userId: string, communityId: string | null) {
  const profile = getUserProfile(userId) ?? createEmptyProfile(userId)
  return saveUserProfile({ ...profile, communityId })
}
