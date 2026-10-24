'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [community, setCommunity] = useState('Oulu Tech Hub');

  const communities = [
    'Oulu Tech Hub', 'Northern Photographers', 'Oulu Food & Culture', 
    'Oulu Startup Founders', 'University Students Oulu', 'Northern Finland Real Estate'
  ];

  const handleSignup = (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      alert("Please complete all fields.");
      return;
    }
    // Mock customer registration action
    alert(`Account created successfully for ${name} (@${community})!`);
    window.location.href = '/';
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-black tracking-wider text-amber-400 mb-1">
            JOIN KALEVA <span className="text-white text-xs font-normal">MICRO</span>
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
            Create Account ✨
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
