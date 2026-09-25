/**
 * ============================================================================
 * FILE: client/src/components/lobby/JoinCard.jsx
 * PURPOSE: VisionOS Glassmorphic Join Form with Automated Room & Key Generators
 *          and One-Click Full Invitation Copying
 * 
 * CORE RESPONSIBILITIES:
 * 1. Collects participant display name and meeting Room ID.
 * 2. Instant Room ID Generator: Produces readable 'meet-xxx-xxx' room slugs.
 * 3. Instant Host Key Generator: Produces secure 4-digit numeric host keys.
 * 4. Passcode Reclamation Drawer: Allows organizers to enter host keys to bypass
 *    waiting rooms and acquire admin controls.
 * 5. One-Click Full Invitation Copy: Copies formatted room credentials + join URL.
 * 6. Cancel Waiting Room Option: Allows co-hosts who forgot key to back out and retry.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { KeyRound, ArrowRight, Sparkles, Wand2, Shield, Copy, Check, X, Share2 } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

export const JoinCard = ({ onJoin, isWaitingApproval, onNameChange }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [hostPasscode, setHostPasscode] = useState('');
  const [showHostKey, setShowHostKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const { showToast, cancelWaitingRequest } = useRoom();

  /**
   * Generates a Google Meet-style alphanumeric room code: meet-abc-xyz
   * and automatically generates a 4-digit Host Key simultaneously
   */
  const handleGenerateRoomId = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    const segment = (len) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    
    const newRoomCode = `meet-${segment(3)}-${segment(3)}`;
    const newKey = Math.floor(1000 + Math.random() * 9000).toString();

    setRoomId(newRoomCode);
    setHostPasscode(newKey);
    setShowHostKey(true);

    if (showToast) {
      showToast(`Generated Room: ${newRoomCode} | Key: ${newKey}`, 'host');
    }
  };

  /**
   * Shuffles / Generates a fresh random 4-digit numeric host key (1000-9999)
   */
  const handleGenerateHostKey = () => {
    const newKey = Math.floor(1000 + Math.random() * 9000).toString();
    setHostPasscode(newKey);

    if (showToast) {
      showToast(`New Host Key: ${newKey}`, 'host');
    }
  };

  // Copy Individual Room Code
  const handleCopyCode = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    if (showToast) showToast('Room code copied', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Individual Host Key
  const handleCopyKey = async () => {
    if (!hostPasscode) return;
    await navigator.clipboard.writeText(hostPasscode);
    setCopiedKey(true);
    if (showToast) showToast('Host key copied', 'success');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Copy Full Pre-Formatted Meeting Invitation Card
  const handleCopyFullInvitation = async () => {
    if (!roomId.trim()) return;

    const currentOrigin = window.location.origin;
    const inviteUrl = `${currentOrigin}/?room=${roomId.trim()}`;

    let inviteText = `✨ MeetSphere Video Invitation\n`;
    inviteText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    inviteText += `📍 Room Code : ${roomId.trim()}\n`;
    if (hostPasscode.trim()) {
      inviteText += `🔑 Host Key  : ${hostPasscode.trim()}\n`;
    }
    inviteText += `👉 Join Link : ${inviteUrl}\n`;
    inviteText += `━━━━━━━━━━━━━━━━━━━━━━`;

    try {
      await navigator.clipboard.writeText(inviteText);
      setCopiedInvite(true);
      if (showToast) {
        showToast('Full meeting invite copied to clipboard!', 'success');
      }
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch (err) {
      console.error('[💥 ERROR] Clipboard write failed:', err);
    }
  };

  const handleNameInput = (e) => {
    const val = e.target.value;
    setName(val);
    if (onNameChange) {
      onNameChange(val);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !roomId.trim()) {
      if (showToast) showToast('Please enter both your name and room code', 'warning');
      return;
    }

    onJoin({
      roomCode: roomId.trim().toLowerCase(),
      user: { name: name.trim() },
      hostPasscode: hostPasscode.trim(),
    });
  };

  // Check for ?room=xxx in URL on mount and auto pre-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam.toLowerCase().trim());
      if (showToast) {
        showToast(`Invite code pre-filled from URL: ${roomParam}`, 'info');
      }
    }
  }, []);

  return (
    <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-white/20 via-white/5 to-transparent border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="bg-slate-950/60 backdrop-blur-xl rounded-[23px] p-6 sm:p-7 space-y-5">
        
        {/* Card Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-[10px] font-semibold tracking-wide">
            <Sparkles className="w-3 h-3" />
            <span>Lobby Check-in</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Ready to connect?
          </h2>
          <p className="text-xs text-slate-400">
            Enter your display name and meeting coordinates below.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Your Display Name</label>
            <input
              type="text"
              required
              disabled={isWaitingApproval}
              value={name}
              onChange={handleNameInput}
              placeholder="e.g. Alex Morgan"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all disabled:opacity-50"
            />
          </div>

          {/* 2. Room Code with Instant Generator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Meeting Room Code</label>
              {!isWaitingApproval && (
                <button
                  type="button"
                  onClick={handleGenerateRoomId}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Generate New</span>
                </button>
              )}
            </div>
            
            <div className="relative flex items-center">
              <input
                type="text"
                required
                disabled={isWaitingApproval}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. meet-8x2-9ka"
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all disabled:opacity-50"
              />
              {roomId && !isWaitingApproval && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Room Code Only"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* 3. Organizer Drawer with 4-Digit Host Key Generator */}
          <div className="pt-0.5">
            {!isWaitingApproval && (
              <button
                type="button"
                onClick={() => setShowHostKey(!showHostKey)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {showHostKey ? 'Hide Organizer Options' : 'I am the Meeting Organizer / Co-Host'}
              </button>
            )}

            {showHostKey && !isWaitingApproval && (
              <div className="mt-2.5 p-3.5 rounded-2xl bg-white/[0.03] border border-cyan-400/25 space-y-2.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" /> 4-Digit Host Key
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateHostKey}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Shuffle Key</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    maxLength={4}
                    value={hostPasscode}
                    onChange={(e) => setHostPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 4821"
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs font-mono tracking-widest focus:outline-none focus:border-cyan-400 transition-all"
                  />
                  {hostPasscode && (
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy Host Key Only"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Keep this key safe. Entering it allows you to bypass the waiting room and claim the host seat immediately.
                </p>
              </div>
            )}
          </div>

          {/* 4. One-Click Copy Full Invitation Banner (Appears when room exists) */}
          {roomId.trim() && !isWaitingApproval && (
            <div className="pt-0.5 animate-in fade-in">
              <button
                type="button"
                onClick={handleCopyFullInvitation}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:text-cyan-200 text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
              >
                {copiedInvite ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">Invitation Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy Full Invitation (Code + Key + Link)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 5. Action Buttons (Submit vs Cancel Waiting Queue) */}
          {!isWaitingApproval ? (
            <button
              type="submit"
              disabled={!name.trim() || !roomId.trim()}
              className="group relative w-full mt-2 py-3 px-4 rounded-xl overflow-hidden font-bold text-sm transition-all shadow-[0_0_25px_rgba(6,182,212,0.25)] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95" />
              <div className="absolute inset-x-0 top-0 h-px bg-white/60" />

              <span className="relative z-10 flex items-center justify-center gap-2 text-slate-950 font-bold">
                Enter Meeting <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          ) : (
            <div className="space-y-2.5 pt-1 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span>Waiting for the Host to admit you to the room...</span>
              </div>

              {/* Cancel Waiting Request Button */}
              <button
                type="button"
                onClick={cancelWaitingRequest}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel & Enter Host Key</span>
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};