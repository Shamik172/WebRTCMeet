/**
 * ============================================================================
 * FILE: server/server.js
 * PURPOSE: WebRTC Mesh Signaling Server with Multi-Admin Waiting Room & Roles
 * 
 * CORE RESPONSIBILITIES:
 * 1. Differentiates Primary Host vs. Co-Hosts without role-stealing bugs.
 * 2. Broadcasts waiting room updates to ALL active Hosts and Co-Hosts.
 * 3. Handles both 'approve-user' and 'reject-user' actions.
 * 4. Manages WebRTC relays, in-call chat, and reactions.
 * ============================================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Memory store: roomId -> { hostPasscode, primaryHostSocketId, participants: Map, waitingRoom: Map }
const rooms = new Map();

// Helper: Broadcast updated waiting queue to all Hosts and Co-Hosts
function broadcastWaitingQueue(room) {
  const waitingList = Array.from(room.waitingRoom.values());
  for (const [socketId, p] of room.participants.entries()) {
    if (p.isHost || p.isCoHost) {
      io.to(socketId).emit('waiting-room-update', { waitingUsers: waitingList });
    }
  }
}

io.on('connection', (socket) => {
  console.log(`[🔌 SIGNAL] New socket connected: ${socket.id}`);

  // --------------------------------------------------------------------------
  // 1. JOIN ROOM REQUEST
  // --------------------------------------------------------------------------
  socket.on('join-room-request', ({ roomId, user, hostPasscode }) => {
    console.log(`[🔌 SIGNAL] join-room-request from ${socket.id} (${user?.name}) for room: ${roomId}`);

    const trimmedKey = hostPasscode ? hostPasscode.trim() : '';
    const hasProvidedKey = trimmedKey.length > 0;

    // CASE A: Room does not exist yet
    if (!rooms.has(roomId)) {
      if (hasProvidedKey) {
        // First organizer becomes Primary Host
        const hostData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
          isHost: true,
          isCoHost: false,
        };

        rooms.set(roomId, {
          hostPasscode: trimmedKey,
          primaryHostSocketId: socket.id,
          participants: new Map([[socket.id, hostData]]),
          waitingRoom: new Map(),
        });

        socket.join(roomId);
        socket.emit('room-joined', {
          roomId,
          isHost: true,
          isCoHost: false,
          participants: [hostData],
        });

        console.log(`[👑 HOST] Room ${roomId} created by HOST: ${user?.name} (${socket.id})`);
        return;
      } else {
        // Regular attendee arrived before host -> Place into waiting room
        const waitingData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
        };

        rooms.set(roomId, {
          hostPasscode: '1234',
          primaryHostSocketId: null,
          participants: new Map(),
          waitingRoom: new Map([[socket.id, waitingData]]),
        });

        socket.emit('waiting-approval');
        console.log(`[⏳ WAITING] ${user?.name} (${socket.id}) queued. Awaiting room host.`);
        return;
      }
    }

    const room = rooms.get(roomId);

    // CASE B: User entered with a passcode -> Validate
    if (hasProvidedKey) {
      if (trimmedKey === room.hostPasscode) {
        const isFirstHost = !room.primaryHostSocketId;
        if (isFirstHost) room.primaryHostSocketId = socket.id;

        const participantData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
          isHost: isFirstHost,
          isCoHost: !isFirstHost, // Secondary key entrants are Co-Hosts
        };

        room.participants.set(socket.id, participantData);
        socket.join(roomId);

        socket.emit('room-joined', {
          roomId,
          isHost: participantData.isHost,
          isCoHost: participantData.isCoHost,
          participants: Array.from(room.participants.values()),
        });

        // Send current waiting list to this new admin
        socket.emit('waiting-room-update', {
          waitingUsers: Array.from(room.waitingRoom.values()),
        });

        socket.to(roomId).emit('user-joined', { user: participantData });
        console.log(`[🛡️ AUTH] ${user?.name} admitted as ${isFirstHost ? 'Host' : 'Co-Host'}`);
        return;
      } else {
        // Incorrect host passcode
        socket.emit('invalid-host-passcode', {
          message: 'Incorrect Host Key. Please try again or join as an attendee.',
        });
        console.log(`[❌ REJECT] Wrong passcode by ${user?.name} (${socket.id}) in ${roomId}`);
        return;
      }
    }

    // CASE C: Standard Attendee (No key) -> Put into waiting room
    const candidateData = {
      ...user,
      id: socket.id,
      socketId: socket.id,
      peerId: socket.id,
    };

    room.waitingRoom.set(socket.id, candidateData);
    socket.emit('waiting-approval');

    // Notify all active Hosts and Co-Hosts
    broadcastWaitingQueue(room);
    console.log(`[⏳ WAITING] ${user?.name} (${socket.id}) queued in waiting room for ${roomId}`);
  });

  // --------------------------------------------------------------------------
  // 2. WAITING ROOM ADMISSION (APPROVE / REJECT)
  // --------------------------------------------------------------------------
  // Approve candidate
  socket.on('approve-user', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const caller = room.participants.get(socket.id);
    if (!caller || (!caller.isHost && !caller.isCoHost)) {
      console.warn(`[⚠️ WARN] Unauthorized approval attempt by socket: ${socket.id}`);
      return;
    }

    const user = room.waitingRoom.get(targetSocketId);
    if (user) {
      room.waitingRoom.delete(targetSocketId);
      const approvedParticipant = {
        ...user,
        id: targetSocketId,
        socketId: targetSocketId,
        peerId: targetSocketId,
        isHost: false,
        isCoHost: false,
      };
      room.participants.set(targetSocketId, approvedParticipant);

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(roomId);
      }

      // Refresh waiting queue across all admins
      broadcastWaitingQueue(room);

      // Send room confirmation with full roster to the approved candidate
      io.to(targetSocketId).emit('room-joined', {
        roomId,
        isHost: false,
        isCoHost: false,
        participants: Array.from(room.participants.values()),
      });

      // Use io.to(roomId) instead of socket.to(roomId)
      // This ensures the person who clicked "Admit" (Host/Co-Host) also receives the event!
      io.to(roomId).emit('user-joined', { user: approvedParticipant });
      console.log(`[✅ ADMIT] User ${user.name} (${targetSocketId}) admitted by ${caller.name}`);
    }
  });

  // Reject / Decline candidate
  socket.on('reject-user', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const caller = room.participants.get(socket.id);
    if (!caller || (!caller.isHost && !caller.isCoHost)) {
      console.warn(`[⚠️ WARN] Unauthorized rejection attempt by socket: ${socket.id}`);
      return;
    }

    const user = room.waitingRoom.get(targetSocketId);
    if (user) {
      room.waitingRoom.delete(targetSocketId);

      // Notify candidate of rejection
      io.to(targetSocketId).emit('waiting-rejected', {
        message: 'The host declined your request to join this meeting.',
      });

      // Update remaining admins
      broadcastWaitingQueue(room);
      console.log(`[🚫 DECLINE] User ${user.name} (${targetSocketId}) declined by ${caller.name}`);
    }
  });

  // Candidate cancels their own waiting request from the lobby
  socket.on('cancel-waiting-request', ({ roomId }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.waitingRoom.delete(socket.id);
      socket.leave(roomId);

      broadcastWaitingQueue(room);
      console.log(`[⏳ WAITING] Socket ${socket.id} cancelled waiting for room: ${roomId}`);
    }
  });

  // --------------------------------------------------------------------------
  // 3. IN-CALL CONTROLS & TEARDOWN
  // --------------------------------------------------------------------------
  socket.on('host-mute-all', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const caller = room.participants.get(socket.id);
    if (!caller || (!caller.isHost && !caller.isCoHost)) return;

    console.log(`[🔇 MUTE-ALL] Mute all triggered by ${caller.name} in room: ${roomId}`);
    socket.to(roomId).emit('force-mute');
  });

  socket.on('media-state-change', ({ roomId, isAudioMuted, isVideoOff }) => {
    socket.to(roomId).emit('peer-media-state', {
      socketId: socket.id,
      isAudioMuted,
      isVideoOff,
    });
  });

  socket.on('leave-call', ({ roomId }) => {
    handleUserExit(socket, roomId);
  });

  // WebRTC Signaling Relays
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc-offer', { callerSocketId: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc-answer', { responderSocketId: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc-ice-candidate', { senderSocketId: socket.id, candidate });
  });

  // Chat & Reactions
  socket.on('send-message', ({ roomId, message }) => {
    io.to(roomId).emit('receive-message', {
      senderSocketId: socket.id,
      senderName: message.senderName,
      text: message.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  });

  socket.on('send-reaction', ({ roomId, emoji }) => {
    io.to(roomId).emit('receive-reaction', {
      senderSocketId: socket.id,
      emoji,
    });
  });

  // Disconnection cleanup
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      handleUserExit(socket, roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[🔌 SIGNAL] Socket disconnected: ${socket.id}`);
  });
});

function handleUserExit(socket, roomId) {
  if (!rooms.has(roomId)) return;
  const room = rooms.get(roomId);

  // Retrieve user metadata before deleting
  const existingUser = room.participants.get(socket.id);
  const userName = existingUser?.name || 'A participant';
  const isHost = Boolean(existingUser?.isHost);
  const isCoHost = Boolean(existingUser?.isCoHost);

  room.participants.delete(socket.id);
  room.waitingRoom.delete(socket.id);
  socket.leave(roomId);

  // Broadcast enriched departure event to all remaining participants
  io.to(roomId).emit('user-left', {
    socketId: socket.id,
    name: userName,
    isHost,
    isCoHost,
  });

  // Reassign primary host if the departing user held the primary host seat
  if (room.primaryHostSocketId === socket.id) {
    const nextAnchor = room.participants.keys().next().value;
    if (nextAnchor) {
      room.primaryHostSocketId = nextAnchor;
      const nextUser = room.participants.get(nextAnchor);
      if (nextUser) {
        nextUser.isHost = true;
        nextUser.isCoHost = false;
      }
      io.to(roomId).emit('host-changed', { newHostId: nextAnchor });
      console.log(`[⚓ ANCHOR] Host seat migrated to: ${nextAnchor}`);
    } else {
      rooms.delete(roomId);
      console.log(`[🗑️ PURGE] Room ${roomId} removed`);
    }
  }
}

// Housekeeping: Periodic Memory Cleanup
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && room.waitingRoom.size === 0) {
      rooms.delete(roomId);
    }
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server active on port ${PORT}`);
});