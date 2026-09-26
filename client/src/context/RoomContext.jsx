/**
 * ============================================================================
 * FILE: client/src/context/RoomContext.jsx
 * PURPOSE: Global Meeting State & Socket.io Signaling Coordinator
 * 
 * CORE RESPONSIBILITIES:
 * 1. Coordinates room state: participants, roles (Host/Co-Host/Attendee), and queues.
 * 2. Connects to the local signaling server at http://localhost:5000 (Render URL preserved).
 * 3. Bridges WebRTC offer, answer, and ICE candidate events across clients.
 * 4. Manages lobby waiting room rejection, admission, and cancel requests.
 * 5. Provides global toast notifications, remote force-mute directives, and media-state sync.
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const RoomContext = createContext(null);

export const RoomProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [forceMuteTrigger, setForceMuteTrigger] = useState(0);

  const socketRef = useRef(null);
  const pendingRoomRef = useRef(''); // Holds room ID during request without switching page early

  // Floating toast notification dispatcher
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // --------------------------------------------------------------------------
  // SOCKET CONNECTION & EVENT LISTENERS
  // --------------------------------------------------------------------------
  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL;
    // const serverUrl = 'http://localhost:5000';
    console.log('[🔌 SIGNAL] Connecting to signaling server at:', serverUrl);

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // 1. Admission confirmation (Lobby -> Meeting Page transition)
    newSocket.on('room-joined', ({ roomId: joinedRoomId, isHost: hostStatus, isCoHost: coHostStatus, participants: roomPeers }) => {
      console.log(`[✅ JOINED] Admitted to room: ${joinedRoomId} | Host: ${hostStatus} | CoHost: ${coHostStatus}`);
      setRoomId(joinedRoomId || pendingRoomRef.current);
      setIsHost(Boolean(hostStatus));
      setIsCoHost(Boolean(coHostStatus));
      setIsWaitingApproval(false);
      setParticipants(roomPeers || []);

      const roleBadge = hostStatus ? '👑 You are the Host' : coHostStatus ? '🛡️ You are a Co-Host' : '👋 Admitted to the meeting';
      showToast(roleBadge, hostStatus || coHostStatus ? 'host' : 'success');
    });

    // 2. Waiting room routing (Candidate stays in lobby)
    newSocket.on('waiting-approval', () => {
      console.log('[⏳ WAITING] Placed in waiting approval queue. Remaining in lobby.');
      setIsWaitingApproval(true);
      showToast('Waiting for the host to admit you to the room...', 'warning');
    });

    // 3. Invalid passcode rejection
    newSocket.on('invalid-host-passcode', ({ message }) => {
      console.warn('[❌ REJECT] Invalid host key provided');
      setIsWaitingApproval(false);
      showToast(message || 'Incorrect Host Key. Please try again.', 'error');
    });

    // 4. Host waiting room list updates
    newSocket.on('waiting-room-update', ({ waitingUsers: queue }) => {
      console.log('[👥 WAITING-LIST] Updated queue count:', queue?.length || 0);
      setWaitingUsers(queue || []);
    });

    // 5. Remote peer joined
    newSocket.on('user-joined', ({ user }) => {
      console.log('[👋 PEER] Remote user joined:', user?.name);
      setParticipants((prev) => {
        const uid = user.socketId || user.id || user.peerId;
        if (prev.some((p) => (p.socketId || p.id || p.peerId) === uid)) return prev;
        return [...prev, user];
      });
      showToast(`${user?.name || 'Someone'} joined the meeting`, 'info');
    });

    // 6. Remote peer left
    newSocket.on('user-left', ({ socketId }) => {
      console.log('[🚪 LEFT] User disconnected:', socketId);
      setParticipants((prev) => prev.filter((p) => (p.socketId || p.id || p.peerId) !== socketId));
      setWaitingUsers((prev) => prev.filter((u) => (u.socketId || u.id || u.peerId) !== socketId));
      showToast('A participant left the meeting', 'info');
    });

    // 7. Host role migration
    newSocket.on('host-changed', ({ newHostId }) => {
      console.log('[👑 HOST] Host changed to socket:', newHostId);
      const isNewHost = newSocket.id === newHostId;
      setIsHost(isNewHost);
      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          isHost: (p.socketId || p.id || p.peerId) === newHostId,
        }))
      );
      if (isNewHost) showToast('👑 You are now the meeting Host', 'host');
    });

    // 8. Remote media mute from Host
    newSocket.on('force-mute', () => {
      console.log('[🔇 FORCE-MUTE] Received remote mute instruction from Host');
      setForceMuteTrigger((prev) => prev + 1);
      showToast('The Host muted all participants', 'mute');
    });

    // 9. Remote peer mic/video hardware toggle sync
    newSocket.on('peer-media-state', ({ socketId, isAudioMuted, isVideoOff }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if ((p.socketId || p.id || p.peerId) === socketId) {
            return { ...p, isMuted: isAudioMuted, isVideoOff };
          }
          return p;
        })
      );
    });

    // 10. In-call chat messages
    newSocket.on('receive-message', (message) => {
      console.log('[💬 CHAT] Message received from:', message.senderName);
      setMessages((prev) => [...prev, message]);
    });

    // 11. Reaction animations
    newSocket.on('receive-reaction', (data) => {
      console.log('[✨ REACTION] Emitted reaction received:', data?.emoji);
    });

    // 12. Cleanup on unmount
    return () => {
      console.log('[🔌 SIGNAL] Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []);

  // --------------------------------------------------------------------------
  // CONTEXT ACTIONS & DISPATCHERS
  // --------------------------------------------------------------------------

  // Join or request room entry
  const joinRoom = ({ roomCode, user, hostPasscode = '' }) => {
    if (!socketRef.current) return;
    pendingRoomRef.current = roomCode;
    setCurrentUser(user);

    console.log(`[🔌 SIGNAL] Emitting join-room-request for: ${roomCode}`);
    socketRef.current.emit('join-room-request', {
      roomId: roomCode,
      user,
      hostPasscode,
    });
  };

  // Cancel waiting room request from lobby
  const cancelWaitingRequest = () => {
    if (!socketRef.current) return;
    const roomParam = new URLSearchParams(window.location.search).get('room');
    const targetRoom = pendingRoomRef.current || roomId || roomParam;

    console.log(`[⏳ WAITING] Cancelling waiting request for room: ${targetRoom}`);
    socketRef.current.emit('cancel-waiting-request', { roomId: targetRoom });
    setIsWaitingApproval(false);
    pendingRoomRef.current = '';
    showToast('Cancelled waiting request. You can now enter host key.', 'info');
  };

  // Host/Co-Host admits waiting attendee
  const approveUser = (targetSocketId) => {
    if (!socketRef.current || !roomId || (!isHost && !isCoHost)) return;
    console.log(`[👑 HOST] Approving user socket: ${targetSocketId}`);
    socketRef.current.emit('approve-user', { roomId, targetSocketId });
  };

  // Host/Co-Host mutes all participants
  const muteAll = () => {
    if (!socketRef.current || !roomId || (!isHost && !isCoHost)) return;
    console.log('[👑 HOST] Broadcasting host-mute-all command');
    socketRef.current.emit('host-mute-all', { roomId });
    showToast('You muted everyone in the meeting', 'mute');
  };

  // Broadcast mic/camera hardware toggle states
  const broadcastMediaState = (isAudioMuted, isVideoOff) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit('media-state-change', { roomId, isAudioMuted, isVideoOff });
  };

  // Immediate departure teardown
  const leaveCall = () => {
    if (socketRef.current && roomId) {
      console.log(`[🚪 LEAVE] Leaving active call in room: ${roomId}`);
      socketRef.current.emit('leave-call', { roomId });
    }
    window.location.href = window.location.pathname;
  };

  // In-call text messaging
  const sendMessage = (text) => {
    if (!socketRef.current || !roomId || !text.trim() || !currentUser) return;
    console.log('[💬 CHAT] Sending message to room:', roomId);
    socketRef.current.emit('send-message', {
      roomId,
      message: { senderName: currentUser.name, text },
    });
  };

  // Broadcast floating emoji reaction
  const sendReaction = (emoji) => {
    if (!socketRef.current || !roomId) return;
    console.log('[✨ REACTION] Emitting reaction:', emoji);
    socketRef.current.emit('send-reaction', { roomId, emoji });
  };

  return (
    <RoomContext.Provider
      value={{
        socket,
        roomId,
        currentUser,
        isHost,
        isCoHost,
        isWaitingApproval,
        participants,
        waitingUsers,
        messages,
        toasts,
        forceMuteTrigger,
        showToast,
        joinRoom,
        cancelWaitingRequest,
        approveUser,
        muteAll,
        broadcastMediaState,
        leaveCall,
        sendMessage,
        sendReaction,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};