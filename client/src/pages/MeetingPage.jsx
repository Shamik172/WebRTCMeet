/**
 * ============================================================================
 * FILE: client/src/pages/MeetingPage.jsx
 * PURPOSE: Full In-Call Meeting View (VisionOS Glassmorphism)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Calls original useWebRTCMesh(socket, localStream) without breaking its signature.
 * 2. Bridges incoming socket signaling events directly to mesh hook handlers.
 * 3. Builds remote peer tiles from RoomContext participants + remoteStreams Map.
 * 4. Mounts MeetingGrid, ControlDock, ChatDrawer, ParticipantsDrawer, and ReactionOverlay.
 * 5. Isolates grid viewport space to prevent overlap with the bottom floating dock.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { useWebRTCMesh } from '../hooks/useWebRTCMesh';
import { useScreenShare } from '../hooks/useScreenShare';
import { MeetingGrid } from '../components/meeting/MeetingGrid';
import { ControlDock } from '../components/meeting/ControlDock';
import { ChatDrawer } from '../components/meeting/ChatDrawer';
import { ParticipantsDrawer } from '../components/meeting/ParticipantsDrawer';
import { ReactionOverlay } from '../components/meeting/ReactionOverlay';
import { Radio, Users, Check } from 'lucide-react';

export const MeetingPage = ({ mediaStreamState }) => {
  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    hasCamHardware,
    toggleAudio,
    toggleVideo,
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
    muteAll,
    broadcastMediaState,
    leaveCall,
    sendReaction,
    showToast,
  } = useRoom();

  const [activePanel, setActivePanel] = useState(null); // 'chat' | 'people' | null
  const [unreadCount, setUnreadCount] = useState(0);

  // 1. Broadcast mic & cam hardware changes to remote peers
  useEffect(() => {
    if (broadcastMediaState) {
      broadcastMediaState(isAudioMuted, isVideoOff);
    }
  }, [isAudioMuted, isVideoOff, broadcastMediaState]);

  // 2. Call original useWebRTCMesh with positional arguments
  const {
    remoteStreams,
    peerConnectionsRef,
    initiateCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
  } = useWebRTCMesh(socket, localStream);

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
    if (!peerConnectionsRef?.current) return;
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (videoSender && newTrack) {
        videoSender.replaceTrack(newTrack).catch((err) => {
          console.error('[💥 ERROR] Track replace failed:', err);
        });
      }
    });
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
      <header className="relative z-20 w-full shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 backdrop-blur-xl border border-white/10 shadow-lg">
          <div className="w-6 h-6 rounded-lg bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="font-bold tracking-tight text-white text-xs sm:text-sm">MeetSphere</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 ml-1">
            {roomId}
          </span>
        </div>

        {/* Host/Co-Host Waiting Room Admission Banner */}
        {(isHost || isCoHost) && Array.isArray(waitingUsers) && waitingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs backdrop-blur-xl animate-in fade-in">
            <Users className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{waitingUsers.length} waiting to join</span>
            <button
              type="button"
              onClick={() => approveUser && approveUser(waitingUsers[0]?.socketId || waitingUsers[0]?.id)}
              className="ml-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer transition-all"
            >
              <Check className="w-3 h-3" /> Admit {waitingUsers[0]?.name || 'Guest'}
            </button>
          </div>
        )}
      </header>

      {/* Grid Canvas: Isolated viewport taking full vertical room above dock */}
      <main className="relative z-10 flex-1 w-full min-h-0 flex items-center justify-center px-2 sm:px-4 lg:px-6 pt-1 pb-20 sm:pb-24">
        <MeetingGrid
          localStream={localStream}
          currentUser={currentUser}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isHost={isHost}
          peers={remotePeers}
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
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
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