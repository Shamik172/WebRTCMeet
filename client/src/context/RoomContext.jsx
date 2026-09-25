/**
 * ============================================================================
 * FILE: client/src/context/RoomContext.jsx
 * PURPOSE: Global Meeting State & Socket.io Signaling Coordinator
 * 
 * CORE RESPONSIBILITIES:
 * 1. Manages room state: participants, host identity, waiting room queue, and active room ID.
 * 2. Connects to backend Socket.io server using VITE_SIGNALING_SERVER_URL.
 * 3. Handles Host Passcode submission for room creation and role reclamation.
 * 4. Bridges Socket.io signaling events directly to the WebRTC mesh and components.
 * 5. Provides global toast notifications for user events (joins, leaves, admissions).
 * 6. Coordinates Remote Force-Mute events triggered by the room Host.
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

  // Socket instance reference to prevent re-initialization loops
  const socketRef = useRef(null);

  /**
   * Helper: Dispatches a temporary floating UI toast alert.
   */
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // --------------------------------------------------------------------------
  // 1. INITIALIZE SOCKET CONNECTION & REGISTER LISTENERS
  // --------------------------------------------------------------------------
  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:5000';
    console.log('[🔌 SIGNAL] Connecting to signaling server at:', serverUrl);

    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Socket Event: Successfully entered room (either as Host or approved candidate)
    newSocket.on('room-joined', ({ isHost: hostStatus, participants: roomPeers }) => {
      console.log('[✅ JOINED] Admitted to room. Host status:', hostStatus);
      setIsHost(hostStatus);
      setParticipants(roomPeers);
      setIsWaitingApproval(false);
      showToast(hostStatus ? '👑 You are the Host' : '👋 Joined the meeting', 'success');
    });

    // Socket Event: User routed to waiting queue
    newSocket.on('waiting-approval', () => {
      console.log('[⏳ WAITING] Placed in waiting queue. Awaiting host admission.');
      setIsWaitingApproval(true);
      showToast('⏳ Waiting for host to admit you...', 'warning');
    });

    // Socket Event: Host receives updated waiting list
    newSocket.on('waiting-room-update', ({ waitingUsers: queue }) => {
      console.log('[👥 WAITING-LIST] Updated waiting queue length:', queue.length);
      setWaitingUsers(queue);
    });

    // Socket Event: New user entered the active call
    newSocket.on('user-joined', ({ user }) => {
      console.log('[👋 PEER] User joined room:', user.name);
      setParticipants((prev) => [...prev.filter((p) => p.socketId !== user.socketId), user]);
      showToast(`${user.name} joined the meeting`);
    });

    // Socket Event: User left the room
    newSocket.on('user-left', ({ socketId }) => {
      console.log('[🚪 LEFT] User left room:', socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      setWaitingUsers((prev) => prev.filter((u) => u.socketId !== socketId));
      showToast('A participant left the meeting');
    });

    // Socket Event: Host role was reassigned
    newSocket.on('host-changed', ({ newHostId }) => {
      console.log('[👑 HOST] Host changed to socket:', newHostId);
      setIsHost(newSocket.id === newHostId);
      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          isHost: p.socketId === newHostId,
        }))
      );
      if (newSocket.id === newHostId) {
        showToast('👑 You are now the host', 'warning');
      }
    });

    // Socket Event: Host remotely muted all participants
    newSocket.on('force-mute', () => {
      console.log('[🔇 FORCE-MUTE] Received remote mute instruction from Host');
      setForceMuteTrigger((prev) => prev + 1);
      showToast('The host muted everyone', 'warning');
    });

    // Socket Event: In-call Chat Message received
    newSocket.on('receive-message', (message) => {
      console.log('[💬 CHAT] Message received from:', message.senderName);
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      console.log('[🔌 SIGNAL] Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []);

  // --------------------------------------------------------------------------
  // ACTIONS: Helper methods exposed to UI components
  // --------------------------------------------------------------------------

  // Join Room with optional Host Passcode
  const joinRoom = ({ roomCode, user, hostPasscode = '' }) => {
    if (!socketRef.current) return;
    setRoomId(roomCode);
    setCurrentUser(user);

    console.log(`[🔌 SIGNAL] Emitting join-room-request for room: ${roomCode}`);
    socketRef.current.emit('join-room-request', {
      roomId: roomCode,
      user,
      hostPasscode,
    });
  };

  // Host Admits Waiting User
  const approveUser = (targetSocketId) => {
    if (!socketRef.current || !isHost) return;
    console.log(`[👑 HOST] Approving user socket: ${targetSocketId}`);
    socketRef.current.emit('approve-user', {
      roomId,
      targetSocketId,
    });
  };

  // Host Mutes Everyone in the Call
  const muteAll = () => {
    if (!socketRef.current || !isHost) return;
    console.log('[👑 HOST] Broadcasting host-mute-all command');
    socketRef.current.emit('host-mute-all', { roomId });
    showToast('You muted everyone in the meeting', 'info');
  };

  // Send In-Call Chat Message
  const sendMessage = (text) => {
    if (!socketRef.current || !text.trim() || !currentUser) return;
    console.log('[💬 CHAT] Sending text message to room:', roomId);
    socketRef.current.emit('send-message', {
      roomId,
      message: {
        senderName: currentUser.name,
        text,
      },
    });
  };

  // Broadcast Animated Reaction Emoji
  const sendReaction = (emoji) => {
    if (!socketRef.current) return;
    console.log('[✨ REACTION] Sending emoji reaction:', emoji);
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