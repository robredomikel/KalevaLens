'use client';

import { useState, useEffect } from 'react';
import { savePreferences } from '@/app/actions/preferences';
import { LANGUAGE_LEVELS } from '@/lib/preferences/config';

const LOCAL_STORAGE_KEY = 'kaleva_onboarding_draft_v1';

export default function OnboardingWizard({ userId, onComplete, onCancel }) {
  const [answers, setAnswers] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId || 'anon'}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      preferredLanguage: 'English',
      preferredLanguageLevel: 'B2',
      customLanguage: '',
      finnishPracticeFrequency: 'none',
      finnishPracticeMode: null,
      userSituation: 'Working professional',
      timeInFinland: '6 months – 2 years',
      finnishSocietyFamiliarity: 'basic',
      topicInterests: ['Local news & events', 'Science & technology'],
      newsGoals: ["Understand what's happening around me"],
      contextLevel: 'balanced',
      discoveryOpenness: 50,
    };
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-save draft in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && userId) {
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, JSON.stringify(answers));
      } catch {}
    }
  }, [answers, userId]);

  // Determine if Question 3 (Finnish Practice Mode) should be shown
  const isFinnishPracticeEnabled = answers.finnishPracticeFrequency !== 'none';

  // Calculate visible total steps
  // Total base questions: 10. If finnishPracticeFrequency is 'none', Q3 is skipped.
  const totalSteps = isFinnishPracticeEnabled ? 10 : 9;

  // Map internal step counter to logical question index (1..10)
  const getQuestionNumber = (step) => {
    if (!isFinnishPracticeEnabled && step >= 3) {
      return step + 1; // skips Q3
    }
    return step;
  };

  const questionNum = getQuestionNumber(currentStep);

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setErrorMsg('');
  };

  const toggleArraySelection = (key, option) => {
    setAnswers((prev) => {
      const list = prev[key] || [];
      const exists = list.includes(option);
      const updated = exists ? list.filter((item) => item !== option) : [...list, option];
      return { ...prev, [key]: updated };
    });
    setErrorMsg('');
  };

  const validateCurrentStep = () => {
    if (questionNum === 1) {
      if (answers.preferredLanguage === 'Other language' && !answers.customLanguage.trim()) {
        setErrorMsg('Please specify your preferred language.');
        return false;
      }
      if (!answers.preferredLanguageLevel) {
        setErrorMsg('Please select your proficiency level in this language.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const finalPayload = {
        ...answers,
        finnishPracticeMode: answers.finnishPracticeFrequency === 'none' ? null : (answers.finnishPracticeMode || 'translation'),
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      };

      const result = await savePreferences(userId || '123', finalPayload);
      if (typeof window !== 'undefined' && userId) {
        try {
          localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${userId}`);
        } catch {}
      }
      onComplete?.(result.preferences);
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col my-auto relative">
        
        {/* Header with Title and Cancel button if allowed */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
              Personalize Your Experience • Step {currentStep} of {totalSteps}
            </span>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 transition"
            >
              Skip for now ✕
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-6 border border-slate-800/80">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Dynamic Question Render */}
        <div className="flex-1 min-h-[340px] flex flex-col justify-between">
          <div>
            {questionNum === 1 && (
              <Question1Language
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 2 && (
              <Question2FinnishPractice
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 3 && (
              <Question3FinnishMode
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 4 && (
              <Question4Situation
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 5 && (
              <Question5TimeInFinland
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 6 && (
              <Question6Familiarity
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 7 && (
              <Question7Interests
                answers={answers}
                toggleArraySelection={toggleArraySelection}
              />
            )}

            {questionNum === 8 && (
              <Question8Goals
                answers={answers}
                toggleArraySelection={toggleArraySelection}
              />
            )}

            {questionNum === 9 && (
              <Question9ContextLevel
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}

            {questionNum === 10 && (
              <Question10Openness
                answers={answers}
                updateAnswer={updateAnswer}
              />
            )}
          </div>

          {/* Error Message display */}
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              ← Back
            </button>

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20 transition"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50 shadow-lg shadow-amber-400/20 transition flex items-center gap-1.5"
              >
                {saving ? 'Saving Profile…' : 'Complete Onboarding 🚀'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ───────────────────── QUESTION SUB-COMPONENTS ───────────────────── */

function Question1Language({ answers, updateAnswer }) {
  const languageOptions = [
    'English',
    'Finnish',
    'Swedish',
    'Spanish',
    'Arabic',
    'Other language',
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          What language would you prefer to read the news in?
        </h2>
        <p className="text-xs text-slate-400">
          Choose the language you’re most comfortable with. You can always change it later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {languageOptions.map((lang) => {
          const selected = answers.preferredLanguage === lang;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => updateAnswer('preferredLanguage', lang)}
              className={`p-3 rounded-2xl text-xs font-semibold text-left border transition ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              {lang}
            </button>
          );
        })}
      </div>

      {answers.preferredLanguage === 'Other language' && (
        <div className="pt-2">
          <label className="block text-[11px] font-bold text-slate-300 mb-1">
            Specify your preferred language
          </label>
          <input
            type="text"
            placeholder="e.g., German, French, Ukrainian..."
            value={answers.customLanguage || ''}
            onChange={(e) => updateAnswer('customLanguage', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>
      )}

      {/* Language Proficiency Level (A1 to C1) */}
      <div className="pt-3 border-t border-slate-800/80">
        <label className="block text-xs font-bold text-amber-400 mb-1">
          Select your proficiency level in {answers.preferredLanguage === 'Other language' ? (answers.customLanguage || 'your chosen language') : answers.preferredLanguage}:
        </label>
        <p className="text-[11px] text-slate-400 mb-2">
          Our AI agents adapt sentence complexity, vocabulary, and grammar to match your level.
        </p>
        <div className="space-y-2">
          {LANGUAGE_LEVELS.map((level) => {
            const isSelected = answers.preferredLanguageLevel === level.value;
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => updateAnswer('preferredLanguageLevel', level.value)}
                className={`w-full p-2.5 rounded-xl text-xs text-left border transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{level.label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isSelected ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  {level.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Question2FinnishPractice({ answers, updateAnswer }) {
  const isFinnishPrimary = answers.preferredLanguage === 'Finnish';

  const options = [
    {
      value: 'none',
      label: isFinnishPrimary ? 'Read in standard Finnish only' : 'No, only in my preferred language',
      desc: isFinnishPrimary ? 'Keep news in full natural Finnish' : 'All news rendered in your preferred language',
    },
    {
      value: 'occasionally',
      label: 'Yes, occasionally',
      desc: 'Mix in Finnish language articles or bilingual helpers once in a while',
    },
    {
      value: 'regularly',
      label: "Yes, I’d like to practice regularly",
      desc: 'Regular Finnish practice articles with vocabulary & translation assistance',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          {isFinnishPrimary
            ? 'Would you like language learning support in Finnish?'
            : 'Would you like to occasionally read news in Finnish to practice the language?'}
        </h2>
        <p className="text-xs text-slate-400">
          Kaleva Lens can tailor Finnish news with translations or simplified phrasing to support your learning goals.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        {options.map((opt) => {
          const selected = answers.finnishPracticeFrequency === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateAnswer('finnishPracticeFrequency', opt.value)}
              className={`w-full p-3.5 rounded-2xl text-left border transition flex flex-col ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold text-white">{opt.label}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question3FinnishMode({ answers, updateAnswer }) {
  const options = [
    {
      value: 'translation',
      label: 'Finnish with translation available',
      desc: 'Full Finnish text with inline/hover English or preferred translations',
    },
    {
      value: 'simplified',
      label: 'Simplified Finnish (Selkosuomi)',
      desc: 'Easy-to-read Finnish using simplified grammar and common vocabulary',
    },
    {
      value: 'original',
      label: 'Original Finnish articles',
      desc: 'Standard authentic journalistic Finnish articles',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          How would you like to practice?
        </h2>
        <p className="text-xs text-slate-400">
          Select how Finnish articles should be adapted when you practice.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        {options.map((opt) => {
          const selected = answers.finnishPracticeMode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateAnswer('finnishPracticeMode', opt.value)}
              className={`w-full p-3.5 rounded-2xl text-left border transition flex flex-col ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold text-white">{opt.label}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question4Situation({ answers, updateAnswer }) {
  const options = [
    'International student or PhD researcher',
    'Working professional',
    'Looking for work',
    'Living with family',
    'Finnish resident',
    'Other / Prefer not to say',
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          What best describes your current situation in Finland?
        </h2>
        <p className="text-xs text-slate-400">
          This helps prioritize relevant local events, municipal news, and practical guides.
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {options.map((opt) => {
          const selected = answers.userSituation === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => updateAnswer('userSituation', opt)}
              className={`w-full p-3 rounded-xl text-xs font-semibold text-left border transition ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question5TimeInFinland({ answers, updateAnswer }) {
  const options = [
    'I haven’t moved yet',
    'Less than 6 months',
    '6 months – 2 years',
    '2 – 5 years',
    'More than 5 years',
    'I’ve always lived here',
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          How long have you lived in Finland?
        </h2>
        <p className="text-xs text-slate-400">
          Helps us adjust how much introductory or background context to provide.
        </p>
      </div>

      <div className="space-y-2 pt-2">
        {options.map((opt) => {
          const selected = answers.timeInFinland === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => updateAnswer('timeInFinland', opt)}
              className={`w-full p-3 rounded-xl text-xs font-semibold text-left border transition ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question6Familiarity({ answers, updateAnswer }) {
  const options = [
    {
      value: 'beginner',
      title: 'I’m just starting to learn',
      desc: 'Need explanations for local institutions, cultural references, and names.',
    },
    {
      value: 'basic',
      title: 'I understand everyday life, but not politics or culture',
      desc: 'Comfortable with daily basics, but political context is helpful.',
    },
    {
      value: 'intermediate',
      title: 'I know quite a lot, but some topics are unfamiliar',
      desc: 'Good knowledge base with occasional contextual notes.',
    },
    {
      value: 'advanced',
      title: 'I’m very familiar with Finland',
      desc: 'In-depth direct news with minimal background explanation.',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          How familiar are you with Finnish society?
        </h2>
        <p className="text-xs text-slate-400">
          This key signal determines how news explanations and background summaries are structured.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        {options.map((opt) => {
          const selected = answers.finnishSocietyFamiliarity === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateAnswer('finnishSocietyFamiliarity', opt.value)}
              className={`w-full p-3.5 rounded-2xl text-left border transition flex flex-col ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold text-white">{opt.title}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question7Interests({ answers, toggleArraySelection }) {
  const topicOptions = [
    'Science & technology',
    'Local news & events',
    'Politics & society',
    'Culture & traditions',
    'Education & careers',
    'Economy & business',
    'Nature & environment',
    'Sports & leisure',
  ];

  const selectedList = answers.topicInterests || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          Which topics are you most interested in?
        </h2>
        <p className="text-xs text-slate-400">
          Choose as many as you want (multiple selection).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-2">
        {topicOptions.map((topic) => {
          const isSelected = selectedList.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              onClick={() => toggleArraySelection('topicInterests', topic)}
              className={`p-3 rounded-2xl text-xs font-semibold text-left border transition flex items-center justify-between ${
                isSelected
                  ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>{topic}</span>
              <span className={`text-xs ${isSelected ? 'text-amber-400 font-bold' : 'text-slate-600'}`}>
                {isSelected ? '✓' : '+'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question8Goals({ answers, toggleArraySelection }) {
  const goalOptions = [
    'Understand what’s happening around me',
    'Learn how Finnish society works',
    'Discover local events and activities',
    'Connect with people in my community',
    'Understand different perspectives',
    'Find practical information for everyday life',
  ];

  const selectedList = answers.newsGoals || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          What would you like to get out of local news?
        </h2>
        <p className="text-xs text-slate-400">
          Select all that align with your goals.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        {goalOptions.map((goal) => {
          const isSelected = selectedList.includes(goal);
          return (
            <button
              key={goal}
              type="button"
              onClick={() => toggleArraySelection('newsGoals', goal)}
              className={`w-full p-3 rounded-xl text-xs font-semibold text-left border transition flex items-center justify-between ${
                isSelected
                  ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span>{goal}</span>
              <span className={`text-xs ${isSelected ? 'text-amber-400 font-bold' : 'text-slate-600'}`}>
                {isSelected ? '✓' : '+'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question9ContextLevel({ answers, updateAnswer }) {
  const options = [
    {
      value: 'brief',
      label: 'Brief — just the essentials',
      desc: 'Concise key facts, minimal background.',
    },
    {
      value: 'balanced',
      label: 'Balanced — explain unfamiliar people and concepts',
      desc: 'Standard depth with helpful context on names, places, and terms.',
    },
    {
      value: 'detailed',
      label: 'Detailed — include historical and cultural background',
      desc: 'In-depth articles with historical roots and cultural insights.',
    },
    {
      value: 'adaptive',
      label: 'Adaptive — let the app decide based on what I know',
      desc: 'Dynamically adapts based on topic complexity and your society familiarity.',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          How much context would you like when reading news?
        </h2>
        <p className="text-xs text-slate-400">
          You can always ask for more or less explanation while reading.
        </p>
      </div>

      <div className="space-y-2.5 pt-2">
        {options.map((opt) => {
          const selected = answers.contextLevel === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateAnswer('contextLevel', opt.value)}
              className={`w-full p-3.5 rounded-2xl text-left border transition flex flex-col ${
                selected
                  ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-bold text-white">{opt.label}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Question10Openness({ answers, updateAnswer }) {
  const val = typeof answers.discoveryOpenness === 'number' ? answers.discoveryOpenness : 50;

  const getLabelAndDesc = (percentage) => {
    if (percentage <= 30) {
      return {
        mode: '0% — Focused',
        desc: 'Mostly show news matching my selected interests.',
      };
    } else if (percentage <= 70) {
      return {
        mode: '50% — Balanced',
        desc: 'Mix my interests with occasional new topics.',
      };
    } else {
      return {
        mode: '100% — Exploratory',
        desc: 'Help me discover a wide variety of topics and perspectives.',
      };
    }
  };

  const { mode, desc } = getLabelAndDesc(val);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          How open are you to discovering topics outside your interests?
        </h2>
        <p className="text-xs text-slate-400">
          Adjust the slider to control recommendation diversity.
        </p>
      </div>

      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400">Discovery openness:</span>
          <span className="text-amber-400 text-sm font-mono">{val}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={val}
          onChange={(e) => updateAnswer('discoveryOpenness', Number(e.target.value))}
          className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
        />

        <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-xl">
          <h4 className="text-xs font-bold text-amber-300">{mode}</h4>
          <p className="text-[11px] text-slate-300 mt-0.5">{desc}</p>
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0% Focused</span>
          <span>50% Balanced</span>
          <span>100% Exploratory</span>
        </div>
      </div>
    </div>
  );
}
