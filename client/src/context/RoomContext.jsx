/**
 * ============================================================================
 * FILE: client/src/context/RoomContext.jsx
 * PURPOSE: Global Meeting State & Socket.io Signaling Coordinator
 * 
 * CORE RESPONSIBILITIES:
 * 1. Holds roomId in pending state until admission (keeps candidate in Lobby).
 * 2. Manages room state: participants, host identity, and waiting queue.
 * 3. Handles invalid passcode errors, room admissions, and waiting cancellations.
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
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [forceMuteTrigger, setForceMuteTrigger] = useState(0);

  const socketRef = useRef(null);
  const pendingRoomRef = useRef(''); // Holds room ID during request without switching page

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

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

    // 1. Admitted to meeting room (Only NOW does roomId get committed)
    newSocket.on('room-joined', ({ roomId: joinedRoomId, isHost: hostStatus, participants: roomPeers }) => {
      console.log('[✅ JOINED] Admitted to room:', joinedRoomId, '| Host:', hostStatus);
      setRoomId(joinedRoomId || pendingRoomRef.current);
      setIsHost(hostStatus);
      setIsWaitingApproval(false);
      setParticipants(roomPeers || []);
      showToast(hostStatus ? '👑 You are the Host' : '👋 Admitted to the meeting', hostStatus ? 'host' : 'success');
    });

    // 2. Placed in Waiting Queue (Stays in Lobby!)
    newSocket.on('waiting-approval', () => {
      console.log('[⏳ WAITING] Placed in waiting queue. Remaining in lobby.');
      setIsWaitingApproval(true);
      showToast('Waiting for the host to admit you...', 'warning');
    });

    // 3. Rejected due to wrong Host Passcode
    newSocket.on('invalid-host-passcode', ({ message }) => {
      console.warn('[❌ REJECT] Invalid host key provided');
      setIsWaitingApproval(false);
      showToast(message || 'Incorrect Host Key. Please try again.', 'error');
    });

    // 4. Host receives updated waiting list
    newSocket.on('waiting-room-update', ({ waitingUsers: queue }) => {
      console.log('[👥 WAITING-LIST] Updated queue count:', queue?.length || 0);
      setWaitingUsers(queue || []);
    });

    // 5. Remote user joined
    newSocket.on('user-joined', ({ user }) => {
      console.log('[👋 PEER] Remote user joined:', user?.name);
      setParticipants((prev) => {
        const uid = user.socketId || user.id || user.peerId;
        if (prev.some((p) => (p.socketId || p.id || p.peerId) === uid)) return prev;
        return [...prev, user];
      });
      showToast(`${user?.name || 'Someone'} joined the meeting`, 'info');
    });

    // 6. Remote user left
    newSocket.on('user-left', ({ socketId }) => {
      console.log('[🚪 LEFT] User disconnected:', socketId);
      setParticipants((prev) => prev.filter((p) => (p.socketId || p.id || p.peerId) !== socketId));
      setWaitingUsers((prev) => prev.filter((u) => (u.socketId || u.id || u.peerId) !== socketId));
      showToast('A participant left the meeting', 'info');
    });

    // 7. Host changed
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
      if (isNewHost) {
        showToast('👑 You are now the meeting Host', 'host');
      }
    });

    // 8. Remote Force Mute
    newSocket.on('force-mute', () => {
      console.log('[🔇 FORCE-MUTE] Received remote mute instruction from Host');
      setForceMuteTrigger((prev) => prev + 1);
      showToast('The Host muted all participants', 'mute');
    });

    // 9. Chat Message
    newSocket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // 10. Reactions
    newSocket.on('receive-reaction', (data) => {
      console.log('[✨ REACTION] Received reaction:', data.emoji);
    });

    return () => {
      console.log('[🔌 SIGNAL] Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []);

  // Action: Request entry into room
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

  // Action: Cancel waiting request and return to interactive lobby form
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

  // Action: Host admits waiting candidate
  const approveUser = (targetSocketId) => {
    if (!socketRef.current || !roomId || !isHost) return;
    console.log(`[👑 HOST] Approving user socket: ${targetSocketId}`);
    socketRef.current.emit('approve-user', { roomId, targetSocketId });
  };

  // Action: Host mutes all
  const muteAll = () => {
    if (!socketRef.current || !roomId || !isHost) return;
    socketRef.current.emit('host-mute-all', { roomId });
    showToast('You muted everyone in the meeting', 'mute');
  };

  // Action: Send chat
  const sendMessage = (text) => {
    if (!socketRef.current || !roomId || !text.trim() || !currentUser) return;
    socketRef.current.emit('send-message', {
      roomId,
      message: { senderName: currentUser.name, text },
    });
  };

  // Action: Send reaction
  const sendReaction = (emoji) => {
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit('send-reaction', { roomId, emoji });
  };

  return (
    <RoomContext.Provider
      value={{
        socket,
        roomId,
        currentUser,
        isHost,
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