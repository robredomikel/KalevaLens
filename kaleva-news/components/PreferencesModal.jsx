// @ts-nocheck -- legacy JSX page is incrementally typed.
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadPreferences, savePreferences } from '@/app/actions/preferences';
import { DEFAULT_PREFERENCES, LANGUAGE_LEVELS, SUPPORTED_LANGUAGES } from '@/lib/preferences/config';

export default function PreferencesModal({ userId, open, onClose, onSaved }) {
  const router = useRouter();
  const [values, setValues] = useState(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) loadPreferences(userId).then(setValues).catch(() => setMessage('Could not load preferences.'));
  }, [open, userId]);

  if (!open) return null;

  const updateField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key, item) => {
    setValues((prev) => {
      const list = prev[key] || [];
      const updated = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
      return { ...prev, [key]: updated };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const result = await savePreferences(userId, { ...values, onboardingCompleted: true });
      setValues(result.preferences);
      setMessage(`Saved preferences! ${result.queuedArticles} articles updated in queue.`);
      onSaved?.(result.preferences);
      setTimeout(() => {
        onClose?.();
      }, 1200);
    } catch (error) {
      setMessage(error?.message || 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kaleva_current_user');
    }
    router.push('/auth/login');
  };

  const allTopics = [
    'Science & technology', 'Local news & events', 'Politics & society',
    'Culture & traditions', 'Education & careers', 'Economy & business',
    'Nature & environment', 'Sports & leisure'
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[85vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Profile & Preferences</h2>
            <p className="text-xs text-slate-400">Personalize how AI translates and contextualizes news for you.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 text-base">✕</button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          
          {/* Language & Proficiency Level */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-amber-400">Language & Proficiency Level</h3>
            
            <PreferenceSelect
              label="Preferred Language"
              value={values.preferredLanguage}
              onChange={(e) => updateField('preferredLanguage', e.target.value)}
              options={SUPPORTED_LANGUAGES}
            />

            {values.preferredLanguage === 'Other language' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Custom Language Name</label>
                <input
                  type="text"
                  placeholder="e.g., German, French..."
                  value={values.customLanguage || ''}
                  onChange={(e) => updateField('customLanguage', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            <PreferenceSelect
              label="Language Proficiency Level (A1 to C1)"
              value={values.preferredLanguageLevel}
              onChange={(e) => updateField('preferredLanguageLevel', e.target.value)}
              options={LANGUAGE_LEVELS}
            />
          </div>

          {/* Finnish Practice Settings */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-amber-400">Finnish Practice Settings</h3>
            
            <PreferenceSelect
              label="Finnish Practice Frequency"
              value={values.finnishPracticeFrequency}
              onChange={(e) => updateField('finnishPracticeFrequency', e.target.value)}
              options={[
                { value: 'none', label: 'No practice (Preferred language only)' },
                { value: 'occasionally', label: 'Occasionally practice Finnish' },
                { value: 'regularly', label: 'Regularly practice Finnish' },
              ]}
            />

            {values.finnishPracticeFrequency !== 'none' && (
              <PreferenceSelect
                label="Practice Mode"
                value={values.finnishPracticeMode || 'translation'}
                onChange={(e) => updateField('finnishPracticeMode', e.target.value)}
                options={[
                  { value: 'translation', label: 'Finnish with translation available' },
                  { value: 'simplified', label: 'Simplified Finnish (Selkosuomi)' },
                  { value: 'original', label: 'Original Finnish articles' },
                ]}
              />
            )}
          </div>

          {/* Context & Society Familiarity */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-amber-400">Context & Explanations</h3>
            
            <PreferenceSelect
              label="Familiarity with Finnish Society"
              value={values.finnishSocietyFamiliarity}
              onChange={(e) => updateField('finnishSocietyFamiliarity', e.target.value)}
              options={[
                { value: 'beginner', label: 'Beginner (Starting to learn)' },
                { value: 'basic', label: 'Basic (Understand everyday life)' },
                { value: 'intermediate', label: 'Intermediate (Know quite a lot)' },
                { value: 'advanced', label: 'Advanced (Very familiar)' },
              ]}
            />

            <PreferenceSelect
              label="Explanatory Context Depth"
              value={values.contextLevel}
              onChange={(e) => updateField('contextLevel', e.target.value)}
              options={[
                { value: 'brief', label: 'Brief — Essentials only' },
                { value: 'balanced', label: 'Balanced — Unfamiliar concepts explained' },
                { value: 'detailed', label: 'Detailed — Historical & cultural background' },
                { value: 'adaptive', label: 'Adaptive — App decides based on user knowledge' },
              ]}
            />
          </div>

          {/* Topic Interests */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-400 mb-1">Topic Interests</h3>
            <div className="grid grid-cols-2 gap-2">
              {allTopics.map((topic) => {
                const checked = (values.topicInterests || []).includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleArrayItem('topicInterests', topic)}
                    className={`p-2 rounded-xl text-[11px] font-semibold text-left border transition ${
                      checked
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {checked ? '✓ ' : '+ '}{topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discovery Openness Slider */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-bold">
              <span className="text-amber-400">Discovery Openness:</span>
              <span className="text-white font-mono">{values.discoveryOpenness || 50}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={values.discoveryOpenness || 50}
              onChange={(e) => updateField('discoveryOpenness', Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

        </div>

        {/* Message Notice */}
        {message && (
          <p className="text-xs text-amber-300 bg-amber-400/10 rounded-xl p-2.5 border border-amber-400/20">
            {message}
          </p>
        )}

        {/* Action Buttons: Save All Preferences & Sign Out */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold py-3 rounded-xl text-xs hover:bg-rose-500/30 transition shadow-lg"
          >
            🚪 Sign Out
          </button>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg"
          >
            {saving ? 'Saving…' : 'Save all preferences'}
          </button>
        </div>

      </form>
    </div>
  );
}

function PreferenceSelect({ label, options, ...props }) {
  return (
    <label className="block text-xs font-bold text-slate-300">
      {label}
      <select
        {...props}
        className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
