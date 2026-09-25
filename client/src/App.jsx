/**
 * ============================================================================
 * FILE: client/src/App.jsx
 * PURPOSE: Main Application Entry & Routing Wrapper
 * ============================================================================
 */

import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
          ✨
        </div>
        <h1 className="text-2xl font-bold tracking-tight">WebRTCMeet</h1>
        <p className="text-slate-400 text-sm">
          Signal server connected. Lobby & Meeting components coming up next!
        </p>
      </div>
    </main>
  );
}