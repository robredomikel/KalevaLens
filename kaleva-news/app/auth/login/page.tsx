// @ts-nocheck -- legacy JSX page is incrementally typed.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { loginUser } from '@/app/actions/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await loginUser({ email, password });

      if (response.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('kaleva_current_user', JSON.stringify({ 
            userId: response.user.id, 
            email: response.user.email,
            name: response.user.name,
            community: response.user.community,
            role: response.user.role // <-- Added role here!
          }));
        }

        // Role-based routing: send moderators to Kanban, readers to feed
        if (response.user.role === 'MODERATOR') {
          window.location.href = '/moderator/kanban';
        } else {
          window.location.href = '/?signedIn=true';
        }
      } else {
        alert(response.error);
        setLoading(false);
      }
    } catch (error) {
      alert("Sign in failed. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-black tracking-wider text-amber-400 mb-1">
            KALEVA <span className="text-white text-xs font-normal">LENS</span>
          </h1>
          <p className="text-xs text-slate-400">Sign in to sync your community subscriptions & stories</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Email Address</label>
            <input 
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg mt-2 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In 🚀'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-amber-400 font-bold hover:underline">
            Create account
          </Link>
        </div>

      </div>
    </main>
  );
}
