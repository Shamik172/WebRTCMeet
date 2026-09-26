/**
 * ============================================================================
 * FILE: client/src/components/meeting/ParticipantsDrawer.jsx
 * PURPOSE: Glassmorphic Roster with Roles, Device Status, and In-Call Admissions
 * 
 * CORE RESPONSIBILITIES:
 * 1. Displays participants categorized by role: Host, Co-Host, Attendee.
 * 2. Real-time mic mute and camera status chips for each active participant.
 * 3. Shows pending waiting room queue for Hosts/Co-Hosts with one-click admission.
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { X, Users, Crown, Shield, Mic, MicOff, Video, VideoOff, Check } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

export const ParticipantsDrawer = ({ isOpen, onClose, peers = [] }) => {
  const {
    currentUser,
    isHost,
    isCoHost,
    participants = [],
    waitingUsers = [],
    approveUser,
  } = useRoom();

  const drawerRef = useRef(null);

  // Click & Touch outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        const isDockClick = e.target.closest('button[title="Participants"]');
        if (!isDockClick) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Unify local user with remote peers list
  const allUsers = [
    {
      name: `${currentUser?.name || 'You'} (You)`,
      isHost,
      isCoHost,
      isLocal: true,
      isMuted: false,
      isVideoOff: false,
    },
    ...peers.map((peer) => {
      const meta = participants.find((p) => (p.socketId || p.id || p.peerId) === peer.peerId);
      return {
        name: peer.name || meta?.name || 'Participant',
        isHost: Boolean(peer.isHost || meta?.isHost),
        isCoHost: Boolean(peer.isCoHost || meta?.isCoHost),
        isMuted: peer.isAudioMuted ?? meta?.isMuted ?? false,
        isVideoOff: peer.isVideoOff ?? meta?.isVideoOff ?? false,
        socketId: peer.peerId,
      };
    }),
  ];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 1. Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm sm:bg-black/20 sm:backdrop-blur-none pointer-events-auto transition-opacity" 
      />

      {/* 2. Drawer Card */}
      <aside 
        ref={drawerRef}
        className="absolute top-2 sm:top-3 right-2 sm:right-3 bottom-20 sm:bottom-24 w-[calc(100vw-16px)] sm:w-88 md:w-96 max-h-[calc(100dvh-92px)] sm:max-h-[calc(100dvh-108px)] animate-in slide-in-from-right duration-300 pointer-events-auto flex flex-col"
      >
        {/* Specular Optical Rim Container */}
        <div className="relative h-full w-full rounded-3xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden flex flex-col">
          
          {/* Ambient Inner Glows */}
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-cyan-500/15 blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-emerald-500/10 blur-[60px] pointer-events-none" />

          {/* Inner Liquid Glass Shell */}
          <div className="relative z-10 h-full flex flex-col bg-slate-950/85 backdrop-blur-2xl rounded-[23px] p-3.5 sm:p-4 overflow-hidden">
            
            {/* Drawer Header (Strictly pinned at top with shrink-0) */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                    Participants
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                      {allUsers.length}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">Peer-to-Peer Roster</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95 border border-transparent hover:border-white/10"
                title="Close Panel (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Host/Co-Host Waiting Room Admission Queue */}
            {(isHost || isCoHost) && waitingUsers.length > 0 && (
              <div className="my-2.5 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 shrink-0 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Waiting Room ({waitingUsers.length})
                  </span>
                  <span className="text-[9px] text-amber-300/80 font-mono">Host Action</span>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                  {waitingUsers.map((u) => (
                    <div
                      key={u.socketId || u.id}
                      className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 gap-2"
                    >
                      <span className="text-xs font-medium text-slate-200 truncate">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => approveUser(u.socketId || u.id)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500/25 to-teal-500/25 hover:from-emerald-500/35 hover:to-teal-500/35 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 shadow-sm"
                      >
                        <Check className="w-3 h-3" /> Admit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participant List: min-h-0 prevents flexbox from pushing the header out */}
            <div className="flex-1 min-h-0 overflow-y-auto py-2.5 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {allUsers.map((u, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] transition-all"
                >
                  {/* User Info & Avatar */}
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/10 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 shadow-inner">
                      {u.name[0]?.toUpperCase() || 'U'}
                      {!u.isMuted && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                      )}
                    </div>

                    <div className="flex flex-col truncate">
                      <span className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                        {u.name}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        {u.isHost ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Host
                          </span>
                        ) : u.isCoHost ? (
                          <span className="text-cyan-400 font-semibold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Co-Host
                          </span>
                        ) : (
                          'Attendee'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Real-Time Hardware State Indicators */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Mic Status */}
                    <div
                      className={`p-1.5 rounded-lg border transition-colors ${
                        u.isMuted
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                      title={u.isMuted ? 'Muted' : 'Microphone Active'}
                    >
                      {u.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    </div>

                    {/* Cam Status */}
                    <div
                      className={`p-1.5 rounded-lg border transition-colors ${
                        u.isVideoOff
                          ? 'bg-slate-800/80 text-slate-500 border-white/5'
                          : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                      }`}
                      title={u.isVideoOff ? 'Camera Paused' : 'Camera Active'}
                    >
                      {u.isVideoOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    </div>
                  </div>

                </div>
              ))}
            </div>

            {/* Footer Metadata */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0">
              <span>Direct Mesh Channel</span>
              <span>Zero Server Relay</span>
            </div>

          </div>
        </div>
      </aside>
    </div>
  );
};