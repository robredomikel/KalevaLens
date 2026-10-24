// @ts-nocheck -- legacy JSX page is incrementally typed.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { savePreferences } from '@/app/actions/preferences';
import { ARTICLE_LENGTHS, DEFAULT_PREFERENCES, SUPPORTED_LANGUAGES } from '@/lib/preferences/config';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [community, setCommunity] = useState('Oulu Tech Hub');
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);

  const communities = [
    'Oulu Tech Hub', 'Northern Photographers', 'Oulu Food & Culture', 
    'Oulu Startup Founders', 'University Students Oulu', 'Northern Finland Real Estate'
  ];

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      alert("Please complete all fields.");
      return;
    }
    setSaving(true);
    try {
      // Authentication is mocked in this demo, so the preferences use the same demo user as the feed.
      await savePreferences('123', preferences);
      alert(`Account created successfully for ${name} (@${community})!`);
      window.location.href = '/';
    } catch (error) {
      alert(error?.message || 'Could not create the account.');
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-black tracking-wider text-amber-400 mb-1">
            JOIN KALEVA <span className="text-white text-xs font-normal">LENS</span>
          </h1>
          <p className="text-xs text-slate-400">Create your citizen journalist & reader account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Full Name</label>
            <input 
              type="text" 
              placeholder="Jussi Virtanen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="border-t border-slate-800 pt-4 mt-4">
            <h2 className="text-xs font-bold text-amber-400 mb-1">Content preferences</h2>
            <p className="text-[10px] text-slate-500 mb-3">You can change these later from Preferences.</p>
            <div className="grid grid-cols-2 gap-3">
              <SignupSelect label="Article language" value={preferences.articleLanguage} options={SUPPORTED_LANGUAGES} onChange={(e) => setPreferences({ ...preferences, articleLanguage: e.target.value })} />
              <SignupSelect label="Article length" value={preferences.articleLength} options={ARTICLE_LENGTHS} onChange={(e) => setPreferences({ ...preferences, articleLength: e.target.value })} />
              <SignupSelect label="Audio language" value={preferences.audioLanguage} options={SUPPORTED_LANGUAGES} onChange={(e) => setPreferences({ ...preferences, audioLanguage: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Primary Community</label>
            <select 
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              {communities.map((comm) => (
                <option key={comm} value={comm}>@{comm}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit"
            className="w-full bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg mt-2"
          >
            {saving ? 'Creating account…' : 'Create Account ✨'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-amber-400 font-bold hover:underline">
            Sign in
          </Link>
        </div>

      </div>
    </main>
  );
}

function SignupSelect({ label, options, ...props }) {
  return <label className="block text-[10px] font-bold text-slate-300">{label}<select {...props} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
