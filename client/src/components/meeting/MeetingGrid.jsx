/**
 * ============================================================================
 * FILE: client/src/components/meeting/MeetingGrid.jsx
 * PURPOSE: Dynamic Responsive Auto-Fitting Video Grid (VisionOS style)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Caps visible on-screen tiles to a maximum of 8 slots.
 * 2. Slot 8 transforms into a "+N others" overflow card when participants > 8.
 * 3. Enforces strict viewport bounding so tiles never overlap or clip.
 * 4. Responsive matrix: Desktop 4x2, Tablet 3x2/4x2, Mobile 2x2/2x3/2x4.
 * ============================================================================
 */

import React from 'react';
import { ParticipantTile } from './ParticipantTile';
import { Users, ArrowUpRight } from 'lucide-react';

export const MeetingGrid = ({
  localStream,
  currentUser,
  isAudioMuted,
  isVideoOff,
  isHost,
  peers = [],
  onOpenPeople,
}) => {
  const totalCount = peers.length + 1;
  const MAX_TILES = 8;
  const isOverflowing = totalCount > MAX_TILES;
  
  // If overflowing, show local user + first 6 peers (7 total), reserving 8th for overflow card
  const visiblePeers = isOverflowing ? peers.slice(0, MAX_TILES - 2) : peers;
  const overflowCount = totalCount - (MAX_TILES - 1);

  // Dynamic grid layouts constrained strictly by available height
  const getGridClasses = () => {
    switch (Math.min(totalCount, MAX_TILES)) {
      case 1:
        return 'grid-cols-1 grid-rows-1 max-w-3xl';
      case 2:
        return 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 max-w-5xl';
      case 3:
      case 4:
        return 'grid-cols-2 grid-rows-2 max-w-5xl';
      case 5:
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 max-w-6xl';
      case 7:
      case 8:
      default:
        return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 grid-rows-4 sm:grid-rows-3 lg:grid-rows-2 max-w-7xl';
    }
  };

  return (
    <div className={`w-full h-full grid gap-2 sm:gap-3 lg:gap-4 p-1 items-stretch justify-items-stretch ${getGridClasses()}`}>
      
      {/* 1. Local User Tile */}
      <div className="w-full h-full min-h-0 min-w-0">
        <ParticipantTile
          peerId="local-user"
          name={currentUser?.name || 'You'}
          stream={localStream}
          isLocal={true}
          isHost={isHost}
          isMuted={isAudioMuted}
          isVideoOff={isVideoOff}
        />
      </div>

      {/* 2. Visible Remote Peer Tiles (Up to 6 if overflowing, up to 7 otherwise) */}
      {visiblePeers.map((peer) => {
        const peerId = peer.socketId || peer.id || peer.peerId;
        return (
          <div key={peerId} className="w-full h-full min-h-0 min-w-0">
            <ParticipantTile
              peerId={peerId}
              name={peer.user?.name || peer.name || 'Participant'}
              stream={peer.stream}
              isLocal={false}
              isHost={peer.isHost}
              isCoHost={peer.isCoHost}
              isMuted={peer.isAudioMuted ?? peer.isMuted}
              isVideoOff={peer.isVideoOff}
              isSpeaking={peer.isSpeaking}
            />
          </div>
        );
      })}

      {/* 3. Slot 8: "+N Others" VisionOS Glass Overflow Card */}
      {isOverflowing && (
        <div 
          onClick={onOpenPeople}
          role="button"
          tabIndex={0}
          title="Click to view all participants"
          className="group relative w-full h-full min-h-0 min-w-0 rounded-2xl sm:rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl cursor-pointer transition-all duration-300 hover:scale-[0.99] active:scale-95"
        >
          <div className="relative w-full h-full rounded-[21px] sm:rounded-[23px] overflow-hidden bg-slate-950/65 backdrop-blur-2xl flex flex-col items-center justify-center p-3 sm:p-4 text-center group-hover:bg-slate-900/70 transition-colors">
            
            {/* Ambient Background Aura */}
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-emerald-500/10 opacity-70 group-hover:opacity-100 transition-opacity" />

            {/* Glowing Icon & Counter */}
            <div className="relative mb-1.5 sm:mb-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.25)] group-hover:border-cyan-400/50 transition-all">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 stroke-[1.75]" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>

            {/* Number Pill */}
            <h3 className="text-xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400 tracking-tight">
              +{overflowCount}
            </h3>
            
            <p className="text-[11px] sm:text-xs font-medium text-slate-300/80 mt-0.5">
              others in call
            </p>

            {/* Click to open badge */}
            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-[10px] text-cyan-300 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 transition-all">
              <span>View People</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};