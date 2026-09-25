/**
 * ============================================================================
 * FILE: client/src/components/lobby/JoinCard.jsx
 * PURPOSE: VisionOS-Style Meeting Join Form & Host Passcode Input
 * 
 * CORE RESPONSIBILITIES:
 * 1. Collects participant display name and meeting Room ID.
 * 2. Provides an expandable "Organizer / Host Options" accordion to enter
 *    the hostPasscode without confusing normal participants.
 * 3. Triggers RoomContext.joinRoom on submit.
 * ============================================================================
 */

import React, { useState } from 'react';
import { KeyRound, ArrowRight, Sparkles, User, Hash, ShieldCheck } from 'lucide-react';

export const JoinCard = ({ onJoin, isWaitingApproval, onNameChange }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [hostPasscode, setHostPasscode] = useState('');
  const [showHostKey, setShowHostKey] = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    if (onNameChange) onNameChange(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) return;

    onJoin({
      roomCode: roomId.trim().toLowerCase(),
      user: { name: name.trim() },
      hostPasscode: hostPasscode.trim(),
    });
  };

  return (
    <div className="relative w-full rounded-3xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-md">
      <div className="bg-slate-950/40 backdrop-blur-xl rounded-[23px] p-5 sm:p-7 space-y-4">
        
        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Encrypted Room</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Ready to join?
          </h2>
          <p className="text-xs text-slate-300/80">Connect to pure low-latency WebRTC streams</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" /> Your Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Alex Morgan"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-400 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>

          {/* Room ID Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-cyan-400" /> Meeting Room Code
            </label>
            <input
              type="text"
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. interview-101"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-400 focus:bg-white/[0.08] focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
            />
          </div>

          {/* Optional Host Passcode Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowHostKey(!showHostKey)}
              className="group text-xs text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-2 font-medium cursor-pointer"
            >
              <div className="p-1 rounded-md bg-white/5 border border-white/10 group-hover:border-cyan-500/40 transition-colors">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span>{showHostKey ? 'Hide Host Passcode' : 'I am the Organizer / Co-Host'}</span>
            </button>

            {showHostKey && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-900/60 border border-cyan-500/30 space-y-1.5 animate-in fade-in duration-200 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Host Admission
                </div>
                <input
                  type="password"
                  value={hostPasscode}
                  onChange={(e) => setHostPasscode(e.target.value)}
                  placeholder="Enter Host Key (e.g. 1234)"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-cyan-500/40 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Bypasses the waiting room and unlocks host admission controls.
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isWaitingApproval}
            className="group relative w-full mt-2 py-3 px-5 rounded-xl overflow-hidden font-semibold text-sm transition-all duration-300 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed shadow-[0_0_25px_rgba(6,182,212,0.35)]"
          >
            <div className={`absolute inset-0 transition-opacity duration-300 ${
              isWaitingApproval
                ? 'bg-slate-800'
                : 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95'
            }`} />

            <div className="absolute inset-x-0 top-0 h-px bg-white/50" />

            <div className="relative z-10 flex items-center justify-center gap-2 text-slate-950 font-bold">
              {isWaitingApproval ? (
                <span className="flex items-center gap-2 text-amber-900 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Waiting for Host Approval...
                </span>
              ) : (
                <>
                  <span>Enter Meeting</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>

      </div>
    </div>
  );
};