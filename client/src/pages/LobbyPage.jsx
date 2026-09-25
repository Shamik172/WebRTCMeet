/**
 * ============================================================================
 * FILE: client/src/pages/LobbyPage.jsx
 * PURPOSE: Full Pre-Join Lobby View (VisionOS / iPadOS Glassmorphism)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Coordinates MediaPreview, JoinCard, and PermissionPrompt.
 * 2. Implements sequential hardware authorization for the modal.
 * 3. Displays active Mesh topology with SFU toggle disabled (Phase 2 preview).
 * 4. Responsive 2-column layout on Desktop, single-column stack on Mobile/Tablet.
 * ============================================================================
 */

import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { MediaPreview } from '../components/lobby/MediaPreview';
import { JoinCard } from '../components/lobby/JoinCard';
import { PermissionPrompt } from '../components/lobby/PermissionPrompt';
import { MeshNetworkCanvas } from '../components/lobby/MeshNetworkCanvas';
import { Radio, Server, Share2, Activity, Cpu, Lock } from 'lucide-react';

export const LobbyPage = ({ mediaStreamState }) => {
  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    hasCamHardware,
    audioAllowed,
    videoAllowed,
    permissionError,
    requestAudio,
    requestVideo,
    toggleAudio,
    toggleVideo,
  } = mediaStreamState;

  const { joinRoom, isWaitingApproval } = useRoom();
  const [dismissPrompt, setDismissPrompt] = useState(false);
  const [previewName, setPreviewName] = useState('');
  
  // Phase 1 Architecture: Mesh is active, SFU is under construction
  const [architecture] = useState('mesh');

  // Helper: Request both Mic and Camera consecutively
  const handleGrantBoth = async () => {
    console.log('[🎥 LOBBY] Requesting both audio and video sequentially...');
    await requestAudio();
    if (hasCamHardware) {
      await requestVideo();
    }
    setDismissPrompt(true);
  };

  return (
    <div className="relative min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-cyan-500 selection:text-black font-sans antialiased p-3 sm:p-5 lg:p-8">
      
      {/* 1. Interactive Mesh Canvas Background */}
      <MeshNetworkCanvas architecture={architecture} />

      {/* 2. Soft Ambient Lighting Vignettes */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/3 w-[350px] sm:w-[450px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] sm:w-[400px] h-[300px] bg-emerald-500/10 rounded-full blur-[130px]" />
      </div>

      {/* 3. Modal Permission Prompt */}
      {!dismissPrompt && (
        <PermissionPrompt
          audioAllowed={audioAllowed}
          videoAllowed={videoAllowed}
          hasCamHardware={hasCamHardware}
          onRequestAudio={requestAudio}
          onRequestVideo={requestVideo}
          onGrantBoth={handleGrantBoth}
          onProceed={() => setDismissPrompt(true)}
          error={permissionError}
        />
      )}

      {/* 4. Top Header & Architecture Selector (Universal Mobile/Tablet/Desktop Fluid Fit) */}
      <header className="relative z-20 max-w-5xl mx-auto w-full">
        <div className="backdrop-blur-2xl bg-slate-900/50 border border-white/10 rounded-2xl sm:rounded-3xl px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          
          {/* Logo & Platform Badge */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/10 border border-cyan-400/30 text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            </div>
            
            <span className="font-bold tracking-tight text-white text-sm sm:text-base select-none truncate">
              MeetSphere
            </span>

            <span className="hidden xs:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 shrink-0 select-none">
              P2P
            </span>
          </div>

          {/* Architecture Switcher: Mesh (Active) vs SFU (Phase 2 Locked) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 text-[11px] sm:text-xs shrink-0 backdrop-blur-md">
            
            {/* Active Mesh Engine */}
            <div className="px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1.5 bg-gradient-to-r from-cyan-500/20 to-teal-500/10 text-cyan-300 border border-cyan-400/30 font-semibold shadow-sm select-none cursor-default">
              <Share2 className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="inline">Mesh</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping hidden sm:inline-block ml-0.5" />
            </div>

            {/* Disabled SFU Button (Locked for Phase 2) */}
            <div className="relative group">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1 sm:gap-1.5 bg-white/[0.02] text-slate-500 border border-transparent cursor-not-allowed select-none transition-all opacity-80"
              >
                <Server className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="hidden sm:inline">SFU Relay</span>
                <span className="inline sm:hidden">SFU</span>
                
                {/* Lock Badge */}
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-pink-500/10 text-pink-400/80 border border-pink-500/20 flex items-center gap-0.5 ml-0.5">
                  <Lock className="w-2.5 h-2.5 shrink-0" />
                  <span className="hidden sm:inline">v2</span>
                </span>
              </button>

              {/* Responsive Tooltip: Mobile Safe Alignments */}
              <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 hidden group-hover:flex flex-col w-48 sm:w-56 p-2.5 rounded-xl backdrop-blur-2xl bg-slate-950/95 border border-pink-500/30 text-[11px] text-slate-300 shadow-[0_10px_25px_rgba(0,0,0,0.8)] z-50 pointer-events-none">
                <div className="flex items-center gap-1.5 text-pink-300 font-semibold mb-0.5">
                  <Lock className="w-3 h-3 text-pink-400" /> Phase 2 Roadmap
                </div>
                <p className="leading-snug text-slate-400">
                  SFU media router is under construction. Unlocks on the <span className="font-mono text-cyan-300">sfu</span> branch.
                </p>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* 5. Minimalist Glass Status Ribbon */}
      <div className="relative z-10 max-w-5xl mx-auto w-full px-1.5 pt-2 sm:pt-2.5 flex items-center justify-between text-[11px] text-slate-300/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          <span className="truncate">
            Active Topology: <strong className="text-white">Full Peer-to-Peer Mesh (v1)</strong>
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-cyan-400/90 shrink-0">&lt; 35ms direct socket latency</span>
      </div>

      {/* 6. Main Workspace: Video Preview & Join Card */}
      <main className="relative z-10 max-w-5xl mx-auto w-full my-auto py-3 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6 lg:gap-8 items-start">
        {/* Left: Device Preview Stage */}
        <div className="lg:col-span-7 flex flex-col justify-center w-full">
          <MediaPreview
            localStream={localStream}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            hasCamHardware={hasCamHardware}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            displayName={previewName}
          />
        </div>

        {/* Right: Join Form Card */}
        <div className="lg:col-span-5 flex flex-col justify-center w-full">
          <JoinCard 
            onJoin={joinRoom} 
            isWaitingApproval={isWaitingApproval} 
            onNameChange={setPreviewName}
          />
        </div>
      </main>

      {/* 7. Bottom Architecture Badge */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full pb-1 sm:pb-2 px-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-slate-900/40 border border-white/10 text-[11px] text-slate-400 max-w-full">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">Pure WebRTC DataChannels & MediaStreams • Dual Engine Ready</span>
        </div>
      </footer>

    </div>
  );
};