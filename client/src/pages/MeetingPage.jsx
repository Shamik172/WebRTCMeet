/**
 * ============================================================================
 * FILE: client/src/pages/MeetingPage.jsx
 * PURPOSE: Full In-Call Meeting View (VisionOS Glassmorphism)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Bridges useMediaStream with useWebRTCMesh.
 * 2. [HARDWARE_TRACK_HOTSWAP]: Intercepts mic & video toggles to call
 *    replaceSenderTrack across all active peer transceivers whenever hardware
 *    is acquired or stopped.
 * 3. Bridges incoming socket signaling events directly to mesh hook handlers.
 * 4. Builds remote peer tiles from RoomContext participants + remoteStreams Map.
 * 5. Mounts MeetingGrid, ControlDock, ChatDrawer, ParticipantsDrawer, ReactionOverlay.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import { useWebRTCMesh } from '../hooks/useWebRTCMesh';
import { useScreenShare } from '../hooks/useScreenShare';
import { MeetingGrid } from '../components/meeting/MeetingGrid';
import { ControlDock } from '../components/meeting/ControlDock';
import { ChatDrawer } from '../components/meeting/ChatDrawer';
import { ParticipantsDrawer } from '../components/meeting/ParticipantsDrawer';
import { ReactionOverlay } from '../components/meeting/ReactionOverlay';
import { Radio, Users, Check, X, Copy, CheckCheck } from 'lucide-react';

export const MeetingPage = ({ mediaStreamState }) => {
  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    hasCamHardware,
    toggleAudio: baseToggleAudio,
    toggleVideo: baseToggleVideo,
  } = mediaStreamState;

  const {
    socket,
    roomId,
    currentUser,
    isHost,
    isCoHost,
    participants = [],
    waitingUsers = [],
    approveUser,
    rejectUser,
    muteAll,
    broadcastMediaState,
    leaveCall,
    sendReaction,
    showToast,
  } = useRoom();

  const [activePanel, setActivePanel] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copiedMeetingId, setCopiedMeetingId] = useState(false);

  // 1. Broadcast mic & cam hardware changes to remote peers via signaling
  useEffect(() => {
    if (broadcastMediaState) {
      console.log(`[📡 SIGNAL] Broadcasting media state: AudioMuted=${isAudioMuted}, VideoOff=${isVideoOff}`);
      broadcastMediaState(isAudioMuted, isVideoOff);
    }
  }, [isAudioMuted, isVideoOff, broadcastMediaState]);

  // 2. Instantiate WebRTC Mesh manager with replaceSenderTrack capability
  const {
    remoteStreams,
    peerConnectionsRef,
    replaceSenderTrack,
    initiateCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
  } = useWebRTCMesh(socket, localStream);

  /**
   * [HARDWARE_TRACK_HOTSWAP]: Wrapped Toggle Audio
   * Stops OS track or gets fresh track, then updates all WebRTC transceivers.
   */
  const handleToggleAudio = useCallback(async () => {
    console.log('[🎙️ AUDIO] [HARDWARE_TRACK_HOTSWAP] Triggering audio toggle...');
    const track = await baseToggleAudio();
    // track is null on mute, or a fresh MediaStreamTrack on unmute
    await replaceSenderTrack('audio', track);
  }, [baseToggleAudio, replaceSenderTrack]);

  /**
   * [HARDWARE_TRACK_HOTSWAP]: Wrapped Toggle Video
   * Stops OS camera LED or gets fresh track, then updates all WebRTC transceivers.
   */
  const handleToggleVideo = useCallback(async () => {
    console.log('[📷 VIDEO] [HARDWARE_TRACK_HOTSWAP] Triggering video toggle...');
    const track = await baseToggleVideo();
    // track is null when turning off, or a fresh MediaStreamTrack when turning on
    if (typeof replaceSenderTrack === 'function') {
      await replaceSenderTrack('video', track);
    }
  }, [baseToggleVideo, replaceSenderTrack]);

  // 3. Connect socket signaling events to hook handlers
  useEffect(() => {
    if (!socket) return;

    const onUserJoined = ({ user }) => {
      const targetId = user?.socketId || user?.id || user?.peerId;
      if (targetId && targetId !== socket.id) {
        console.log(`[👋 PEER] Initiating WebRTC call to joined user: ${targetId}`);
        initiateCall(targetId);
      }
    };

    const onOffer = ({ callerSocketId, offer }) => {
      handleOffer(callerSocketId, offer);
    };

    const onAnswer = ({ responderSocketId, answer }) => {
      handleAnswer(responderSocketId, answer);
    };

    const onIceCandidate = ({ senderSocketId, candidate }) => {
      handleIceCandidate(senderSocketId, candidate);
    };

    const onUserLeft = ({ socketId }) => {
      removePeer(socketId);
    };

    socket.on('user-joined', onUserJoined);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice-candidate', onIceCandidate);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('user-joined', onUserJoined);
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice-candidate', onIceCandidate);
      socket.off('user-left', onUserLeft);
    };
  }, [socket, initiateCall, handleOffer, handleAnswer, handleIceCandidate, removePeer]);

  // 4. Hot-swap video track for screen presentation across active mesh connections
  const handleTrackReplace = (newTrack) => {
    console.log('[🖥️ SCREEN] [HARDWARE_TRACK_HOTSWAP] Hot-swapping screen share track...');
    replaceSenderTrack('video', newTrack);
  };

  const { isScreenSharing, toggleScreenShare } = useScreenShare({
    localStream,
    onTrackReplace: handleTrackReplace,
    showToast,
  });

  const handleTogglePanel = (panelName) => {
    setActivePanel((prev) => (prev === panelName ? null : panelName));
    if (panelName === 'chat') setUnreadCount(0);
  };

  const handleCopyMeetingId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedMeetingId(true);
      if (showToast) showToast('Meeting ID copied');
      setTimeout(() => setCopiedMeetingId(false), 1800);
    } catch (err) {
      console.error('[💥 ERROR] Failed to copy meeting ID:', err);
    }
  };

  // 5. Build remote peer list from RoomContext participants + remoteStreams Map
  const myId = socket?.id;
  const safeParticipants = Array.isArray(participants) ? participants : [];

  const remotePeers = safeParticipants
    .filter((p) => {
      const pId = p.socketId || p.id || p.peerId;
      return pId && pId !== myId && pId !== 'local-user';
    })
    .map((peer) => {
      const pId = peer.socketId || peer.id || peer.peerId;
      const stream = remoteStreams instanceof Map ? remoteStreams.get(pId) : null;

      return {
        peerId: pId,
        name: peer.name || 'Participant',
        stream: stream || null,
        isHost: Boolean(peer.isHost),
        isCoHost: Boolean(peer.isCoHost),
        isAudioMuted: peer.isMuted ?? false,
        isVideoOff: peer.isVideoOff ?? false,
      };
    });

  return (
    <div className="relative h-[100dvh] w-screen bg-[#07090e] text-slate-100 flex flex-col justify-between overflow-hidden selection:bg-cyan-500 selection:text-black font-sans antialiased">
      {/* Background Vignettes */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[350px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[350px] bg-emerald-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full shrink-0 px-2 sm:px-4 pt-2">
        <div className="w-full h-12 sm:h-13 px-2 sm:px-3 rounded-2xl bg-slate-950/70 backdrop-blur-2xl border border-white/10 shadow-lg flex items-center justify-between gap-1.5">
          {/* Left: Brand & Copy Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
              </div>
              <span className="font-bold text-white text-xs sm:text-sm tracking-tight hidden min-[360px]:inline">
                MeetSphere
              </span>
            </div>

            <div className="h-4 w-px bg-white/10 shrink-0" />

            {/* Click-to-copy Room ID Pill */}
            <button
              type="button"
              onClick={handleCopyMeetingId}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer active:scale-95 min-w-0 max-w-[130px] min-[400px]:max-w-[160px] sm:max-w-none ${
                copiedMeetingId
                  ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300'
              }`}
              title="Click to copy Meeting ID"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="truncate">{roomId}</span>
              {copiedMeetingId ? (
                <CheckCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Right: Waiting Room Admissions (Admins Only) */}
          {(isHost || isCoHost) && Array.isArray(waitingUsers) && waitingUsers.length > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-1">
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium">
                <Users className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{waitingUsers.length}</span>
              </div>

              <button
                type="button"
                onClick={() => approveUser && approveUser(waitingUsers[0]?.socketId || waitingUsers[0]?.id)}
                className="h-7 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title={`Admit ${waitingUsers[0]?.name || 'Guest'}`}
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span className="max-w-[50px] min-[420px]:max-w-[80px] sm:max-w-[100px] truncate">
                  {waitingUsers[0]?.name || 'Admit'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => rejectUser && rejectUser(waitingUsers[0]?.socketId || waitingUsers[0]?.id)}
                className="w-7 h-7 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
                title="Decline request"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Grid Canvas */}
      <main className="relative z-10 flex-1 w-full min-h-0 flex items-center justify-center px-2 sm:px-4 lg:px-6 pt-1 pb-20 sm:pb-24">
        <MeetingGrid
          localStream={localStream}
          currentUser={currentUser}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isHost={isHost}
          peers={remotePeers}
          onOpenPeople={() => handleTogglePanel('people')}
        />
      </main>

      {/* Floating Control Dock */}
      <ControlDock
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isHost={isHost || isCoHost}
        hasCamHardware={hasCamHardware}
        unreadCount={unreadCount}
        participantCount={remotePeers.length + 1}
        activePanel={activePanel}
        toggleAudio={handleToggleAudio}
        toggleVideo={handleToggleVideo}
        toggleScreenShare={toggleScreenShare}
        togglePanel={handleTogglePanel}
        onSendReaction={sendReaction}
        onMuteAll={muteAll}
        onLeaveCall={leaveCall || (() => { window.location.href = window.location.pathname; })}
      />

      {/* In-Call Drawers & Floating Overlays */}
      <ChatDrawer
        isOpen={activePanel === 'chat'}
        onClose={() => setActivePanel(null)}
      />

      <ParticipantsDrawer
        isOpen={activePanel === 'people'}
        onClose={() => setActivePanel(null)}
        peers={remotePeers}
      />

      <ReactionOverlay />
    </div>
  );
};