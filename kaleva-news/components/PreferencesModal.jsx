'use client';
import { useEffect, useState } from 'react';
import { loadPreferences, savePreferences } from '@/app/actions/preferences';
import { ARTICLE_LENGTHS, DEFAULT_PREFERENCES, SUPPORTED_LANGUAGES } from '@/lib/preferences/config';

export default function PreferencesModal({ userId, open, onClose, onSaved }) {
  const [values, setValues] = useState(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) loadPreferences(userId).then(setValues).catch(() => setMessage('Could not load preferences.'));
  }, [open, userId]);

  if (!open) return null;
  const update = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const result = await savePreferences(userId, values);
      setValues(result.preferences);
      setMessage(`Saved. ${result.queuedArticles} articles are being prepared; each button activates when its audio is ready.`);
      onSaved?.(result.preferences);
    } catch (error) { setMessage(error?.message || 'Could not save preferences.'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center">
    <form onSubmit={submit} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4">
      <div className="flex justify-between items-start"><div><h2 className="text-lg font-bold text-white">Preferences</h2><p className="text-xs text-slate-400">Choose how articles and audio are generated for you.</p></div><button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button></div>
      <PreferenceSelect label="Article language" value={values.articleLanguage} onChange={update('articleLanguage')} options={SUPPORTED_LANGUAGES} />
      <PreferenceSelect label="Article length" value={values.articleLength} onChange={update('articleLength')} options={ARTICLE_LENGTHS} />
      <PreferenceSelect label="Audio language" value={values.audioLanguage} onChange={update('audioLanguage')} options={SUPPORTED_LANGUAGES} />
      {message && <p className="text-xs text-amber-300 bg-amber-400/10 rounded-xl p-3">{message}</p>}
      <button disabled={saving} className="w-full bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs">{saving ? 'Saving and queueing…' : 'Save preferences'}</button>
    </form>
  </div>;
}

function PreferenceSelect({ label, options, ...props }) {
  return <label className="block text-xs font-bold text-slate-300">{label}<select {...props} className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
