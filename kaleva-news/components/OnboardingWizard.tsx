'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableCommunities } from '@/data/communities'
import {
  completeOnboarding,
  createEmptyProfile,
  getSession,
  getUserProfile,
  saveUserProfile,
  type UserPreferences,
  type UserProfile,
} from '@/lib/profile'

type Option = { value: string; label: string; detail?: string }
type WizardMode = 'onboarding' | 'settings'

const stages = ['Your Languages', 'About You', 'Your Interests', 'Your Community', 'Your News Experience']
const knownLanguages: Option[] = [
  { value: 'en', label: 'English' }, { value: 'fi', label: 'Finnish' },
  { value: 'sv', label: 'Swedish' }, { value: 'es', label: 'Spanish' },
  { value: 'ar', label: 'Arabic' }, { value: 'other', label: 'Other language' },
]
const situations: Option[] = [
  ['international_student', 'International student or PhD researcher'], ['professional', 'Working professional'],
  ['job_seeker', 'Looking for work'], ['family', 'Living with family'], ['resident', 'Finnish resident'],
  ['other', 'Other / Prefer not to say'],
].map(([value, label]) => ({ value, label }))
const timeOptions: Option[] = [
  ['not_moved', 'I haven’t moved yet'], ['under_6_months', 'Less than 6 months'],
  ['6_months_2_years', '6 months – 2 years'], ['2_5_years', '2 – 5 years'],
  ['over_5_years', 'More than 5 years'], ['always', 'I’ve always lived here'],
].map(([value, label]) => ({ value, label }))
const familiarityOptions: Option[] = [
  ['beginner', 'I’m just starting to learn'], ['basic', 'I understand everyday life, but not politics or culture'],
  ['intermediate', 'I know quite a lot, but some topics are unfamiliar'], ['advanced', 'I’m very familiar with Finland'],
].map(([value, label]) => ({ value, label }))
const topicOptions: Option[] = [
  ['science_technology', 'Science & technology'], ['local_news_events', 'Local news & events'],
  ['politics_society', 'Politics & society'], ['culture_traditions', 'Culture & traditions'],
  ['education_careers', 'Education & careers'], ['economy_business', 'Economy & business'],
  ['nature_environment', 'Nature & environment'], ['sports_leisure', 'Sports & leisure'],
].map(([value, label]) => ({ value, label }))
const goalOptions: Option[] = [
  ['understand_local', 'Understand what’s happening around me'], ['learn_society', 'Learn how Finnish society works'],
  ['discover_events', 'Discover local events and activities'], ['connect_community', 'Connect with people in my community'],
  ['different_perspectives', 'Understand different perspectives'], ['practical_information', 'Find practical information for everyday life'],
].map(([value, label]) => ({ value, label }))

function ChoiceCards({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) {
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => (
    <label key={option.value} className={`cursor-pointer rounded-2xl border p-3 transition focus-within:ring-2 focus-within:ring-amber-400 ${value === option.value ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'}`}>
      <input className="sr-only" type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
      <span className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden>{value === option.value ? '●' : '○'}</span>{option.label}</span>
      {option.detail && <span className="mt-1 block pl-5 text-xs text-slate-400">{option.detail}</span>}
    </label>
  ))}</div>
}

function MultiCards({ options, values, onChange }: { options: Option[]; values: string[]; onChange: (values: string[]) => void }) {
  const toggle = (id: string) => onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id])
  return <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => {
    const selected = values.includes(option.value)
    return <label key={option.value} className={`cursor-pointer rounded-2xl border p-3 transition focus-within:ring-2 focus-within:ring-amber-400 ${selected ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'}`}>
      <input className="sr-only" type="checkbox" checked={selected} onChange={() => toggle(option.value)} />
      <span className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden>{selected ? '✓' : '+'}</span>{option.label}</span>
    </label>
  })}</div>
}

export default function OnboardingWizard({ mode = 'onboarding' }: { mode?: WizardMode }) {
  const router = useRouter()
  const [communities] = useState(() => getAvailableCommunities())
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [question, setQuestion] = useState(0)
  const [customLanguage, setCustomLanguage] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) {
      router.replace('/auth/login')
      return
    }
    const loaded = getUserProfile(session.userId) ?? createEmptyProfile(session.userId)
    if (mode === 'onboarding' && loaded.onboardingCompleted) {
      router.replace('/')
      return
    }
    const timer = window.setTimeout(() => {
      const knownCodes = knownLanguages.map((language) => language.value)
      if (loaded.preferences.preferredLanguage && !knownCodes.includes(loaded.preferences.preferredLanguage)) {
        setCustomLanguage(loaded.preferences.preferredLanguage)
      }
      setProfile(loaded)
      setQuestion(mode === 'settings' ? 0 : Math.min(loaded.currentQuestion, 10))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [mode, router])

  const questions = [1, 2]
  if (profile?.preferences.finnishPracticeFrequency && profile.preferences.finnishPracticeFrequency !== 'none') questions.push(3)
  questions.push(4, 5, 6, 7, 8, 9, 10, 11)

  if (!profile) return <main className="min-h-screen bg-slate-950 grid place-items-center text-amber-400">Loading your profile…</main>

  const q = questions[Math.min(question, questions.length - 1)]
  const stage = q <= 3 ? 0 : q <= 6 ? 1 : q <= 8 ? 2 : q === 9 ? 3 : 4
  const p = profile.preferences
  const knownLanguage = knownLanguages.some((language) => language.value === p.preferredLanguage) ? p.preferredLanguage : p.preferredLanguage ? 'other' : ''

  const updatePreferences = (patch: Partial<UserPreferences>) => {
    setSaved(false)
    setProfile((current) => current ? { ...current, preferences: { ...current.preferences, ...patch } } : current)
  }
  const persist = (nextQuestion = question) => {
    const next = { ...profile, currentQuestion: nextQuestion }
    setProfile(saveUserProfile(next))
    setSaved(true)
  }
  const validCurrent = () => {
    const required: Record<number, boolean> = {
      1: Boolean(p.preferredLanguage && (knownLanguage !== 'other' || customLanguage.trim())),
      2: Boolean(p.finnishPracticeFrequency), 3: Boolean(p.finnishPracticeMode), 4: Boolean(p.userSituation),
      5: Boolean(p.timeInFinland), 6: Boolean(p.finnishSocietyFamiliarity), 7: true, 8: true, 9: true,
      10: Boolean(p.contextLevel), 11: p.discoveryOpenness >= 0 && p.discoveryOpenness <= 100,
    }
    return required[q]
  }
  const next = () => {
    setError('')
    if (!validCurrent()) { setError('Choose an option to continue.'); return }
    if (q === 1 && knownLanguage === 'other') updatePreferences({ preferredLanguage: customLanguage.trim().toLowerCase() })
    const nextIndex = Math.min(question + 1, questions.length - 1)
    try { persist(nextIndex); setQuestion(nextIndex) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your progress.') }
  }
  const finish = () => {
    setError('')
    try {
      const result = mode === 'onboarding' ? completeOnboarding(profile) : saveUserProfile(profile)
      setProfile(result)
      router.push('/')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your profile.') }
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div><p className="text-xs font-black tracking-[0.24em] text-amber-400">KALEVA LENS</p><h1 className="mt-1 text-xl font-bold">{mode === 'settings' ? 'News preferences' : 'Make local news feel local to you'}</h1></div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">{mode === 'settings' ? 'Settings' : `${question + 1} / ${questions.length}`}</span>
      </header>

      <div className="mb-5" aria-label={`Stage ${stage + 1} of 5: ${stages[stage]}`}>
        <div className="mb-2 flex justify-between text-xs"><span className="font-bold text-amber-400">Stage {stage + 1}: {stages[stage]}</span><span className="text-slate-500">{Math.round(((question + 1) / questions.length) * 100)}%</span></div>
        <div className="flex gap-2">{stages.map((name, index) => <div key={name} className={`h-1.5 flex-1 rounded-full ${index <= stage ? 'bg-amber-400' : 'bg-slate-800'}`} />)}</div>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-8">
        {q === 1 && <Question title="What language would you prefer to read the news in?" description="Choose the language you’re most comfortable with. You can always change it later."><ChoiceCards options={knownLanguages} value={knownLanguage} onChange={(value) => updatePreferences({ preferredLanguage: value })} />{knownLanguage === 'other' && <input autoFocus value={customLanguage} onChange={(e) => { setCustomLanguage(e.target.value); updatePreferences({ preferredLanguage: e.target.value || 'other' }) }} placeholder="Enter your preferred language" className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-amber-400" />}</Question>}
        {q === 2 && <Question title={p.preferredLanguage === 'fi' ? 'How often would you like Finnish-language news?' : 'Would you like to occasionally read news in Finnish to practice the language?'}><ChoiceCards value={p.finnishPracticeFrequency} onChange={(value) => updatePreferences({ finnishPracticeFrequency: value as UserPreferences['finnishPracticeFrequency'], finnishPracticeMode: value === 'none' ? null : p.finnishPracticeMode })} options={[{ value: 'none', label: 'No, only in my preferred language' }, { value: 'occasionally', label: 'Yes, occasionally' }, { value: 'regularly', label: 'Yes, I’d like to practice regularly' }]} /></Question>}
        {q === 3 && <Question title="How would you like to practice?"><ChoiceCards value={p.finnishPracticeMode ?? ''} onChange={(value) => updatePreferences({ finnishPracticeMode: value as UserPreferences['finnishPracticeMode'] })} options={[{ value: 'translation', label: 'Finnish with translation available' }, { value: 'simplified', label: 'Simplified Finnish' }, { value: 'original', label: 'Original Finnish articles' }]} /></Question>}
        {q === 4 && <Question title="What best describes your current situation in Finland?"><ChoiceCards value={p.userSituation} onChange={(value) => updatePreferences({ userSituation: value })} options={situations} /></Question>}
        {q === 5 && <Question title="How long have you lived in Finland?"><ChoiceCards value={p.timeInFinland} onChange={(value) => updatePreferences({ timeInFinland: value })} options={timeOptions} /></Question>}
        {q === 6 && <Question title="How familiar are you with Finnish society?"><ChoiceCards value={p.finnishSocietyFamiliarity} onChange={(value) => updatePreferences({ finnishSocietyFamiliarity: value })} options={familiarityOptions} /></Question>}
        {q === 7 && <Question title="Which topics are you most interested in?" description="Choose as many as you want, or continue without selecting any."><MultiCards options={topicOptions} values={p.topicInterests} onChange={(values) => updatePreferences({ topicInterests: values })} /></Question>}
        {q === 8 && <Question title="What would you like to get out of local news?" description="Choose as many as you want, or continue without selecting any."><MultiCards options={goalOptions} values={p.newsGoals} onChange={(values) => updatePreferences({ newsGoals: values })} /></Question>}
        {q === 9 && <Question title="Would you like to join a community?" description="Connect with people who share your interests or experiences in Finland. You can also skip this step."><button onClick={() => setProfile({ ...profile, communityId: null })} className={`mb-3 w-full rounded-xl border p-3 text-left text-sm font-semibold ${profile.communityId === null ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700'}`}>Continue without a community</button>{communities.length === 0 ? <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">No communities are available yet.</p> : <div className="grid gap-2 sm:grid-cols-2">{communities.map((community) => <button key={community.id} onClick={() => setProfile({ ...profile, communityId: community.id })} className={`rounded-2xl border p-4 text-left ${profile.communityId === community.id ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950/60'}`}><span className="text-lg" aria-hidden>{community.icon}</span><span className="ml-2 text-sm font-bold">{community.name}</span><span className="mt-2 block text-xs text-slate-400">{community.description}</span></button>)}</div>}</Question>}
        {q === 10 && <Question title="How much context would you like when reading news?" description="You can always ask for more or less explanation."><ChoiceCards value={p.contextLevel} onChange={(value) => updatePreferences({ contextLevel: value })} options={[{ value: 'brief', label: 'Brief — just the essentials' }, { value: 'balanced', label: 'Balanced — explain unfamiliar people and concepts' }, { value: 'detailed', label: 'Detailed — include historical and cultural background' }, { value: 'adaptive', label: 'Adaptive — let the app decide based on what I know' }]} /></Question>}
        {q === 11 && <Question title="How open are you to discovering topics outside your interests?"><div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5"><div className="mb-5 text-center text-4xl font-black text-amber-400">{p.discoveryOpenness}%</div><input aria-label="Discovery openness percentage" type="range" min="0" max="100" step="1" value={p.discoveryOpenness} onChange={(e) => updatePreferences({ discoveryOpenness: Number(e.target.value) })} className="w-full accent-amber-400" /><div className="mt-3 flex justify-between text-[10px] text-slate-400"><span>0% Focused</span><span>50% Balanced</span><span>100% Exploratory</span></div></div></Question>}

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-800 pt-5">
          <button onClick={() => question === 0 && mode === 'settings' ? router.push('/') : setQuestion(Math.max(0, question - 1))} disabled={question === 0 && mode === 'onboarding'} className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-bold disabled:opacity-30">Back</button>
          <span aria-live="polite" className="text-xs text-emerald-400">{saved ? 'Progress saved' : ''}</span>
          {question === questions.length - 1 ? <button onClick={finish} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950">{mode === 'settings' ? 'Save Changes' : 'Start Reading'}</button> : <button onClick={next} className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950">Continue</button>}
        </div>
      </section>
    </div>
  </main>
}

function Question({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <fieldset><legend className="text-xl font-bold leading-snug sm:text-2xl">{title}</legend>{description && <p className="mb-5 mt-2 text-sm text-slate-400">{description}</p>}{!description && <div className="h-5" />}{children}</fieldset>
}
