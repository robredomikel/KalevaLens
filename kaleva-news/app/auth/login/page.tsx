'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    // Mock customer login action
    alert(`Welcome back, ${email}! Logging into Kaleva Micro-News...`);
    window.location.href = '/';
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-black tracking-wider text-amber-400 mb-1">
            KALEVA <span className="text-white text-xs font-normal">MICRO-NEWS</span>
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
            className="w-full bg-amber-400 text-slate-950 font-bold py-3 rounded-xl text-xs hover:bg-amber-300 transition shadow-lg mt-2"
          >
            Sign In 🚀
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-amber-400 font-bold hover:underline">
            Create account
          </Link>
        </div>

      </div>
    </main>
  );
}
