/**
 * ============================================================================
 * FILE: server/server.js
 * PURPOSE: WebRTC Mesh Signaling Server with Host Passcode & Role Reclamation
 * 
 * CORE RESPONSIBILITIES:
 * 1. Room Lifecycle: Tracks hostPasscode, active participants, and waiting queues.
 * 2. Host Key Validation: Validates passcodes so original organizers bypass waiting
 *    rooms and reclaim host controls.
 * 3. WebRTC Relays: Mailbox forwarding for SDP offers, answers, and ICE candidates.
 * 4. Waiting Room Enforcement: Holds candidates without keys in queue until host arrives.
 * 5. Disconnect Handling: Prevents non-host candidates from getting admin rights.
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

// Memory store: roomId -> { hostPasscode, hostSocketId, participants: Map, waitingRoom: Map }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[🔌 SIGNAL] New socket connected: ${socket.id}`);

  // 1. Join Room Request
  socket.on('join-room-request', ({ roomId, user, hostPasscode }) => {
    console.log(`[🔌 SIGNAL] join-room-request from ${socket.id} (${user?.name}) for room: ${roomId}`);

    const trimmedKey = hostPasscode ? hostPasscode.trim() : '';
    const hasProvidedKey = trimmedKey.length > 0;

    // ------------------------------------------------------------------------
    // CASE A: ROOM DOES NOT EXIST YET
    // ------------------------------------------------------------------------
    if (!rooms.has(roomId)) {
      if (hasProvidedKey) {
        // Organizer creates room with their specified key
        const hostData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
          isHost: true,
        };

        rooms.set(roomId, {
          hostPasscode: trimmedKey,
          hostSocketId: socket.id,
          participants: new Map([[socket.id, hostData]]),
          waitingRoom: new Map(),
        });

        socket.join(roomId);
        socket.emit('room-joined', {
          roomId,
          isHost: true,
          participants: [hostData],
        });

        console.log(`[👑 HOST] Room ${roomId} created by HOST: ${user?.name} (${socket.id})`);
        return;
      } else {
        // Regular participant arrived before any host -> Hold in waiting room
        const waitingData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
        };

        rooms.set(roomId, {
          hostPasscode: '1234', // Default key until host arrives
          hostSocketId: null,
          participants: new Map(),
          waitingRoom: new Map([[socket.id, waitingData]]),
        });

        socket.emit('waiting-approval');
        console.log(`[⏳ WAITING] ${user?.name} (${socket.id}) queued. Room ${roomId} has no active host yet.`);
        return;
      }
    }

    const room = rooms.get(roomId);

    // ------------------------------------------------------------------------
    // CASE B: USER SUPPLIED A KEY -> VALIDATE IT
    // ------------------------------------------------------------------------
    if (hasProvidedKey) {
      if (trimmedKey === room.hostPasscode) {
        // Correct key: Admit directly as Host / Co-Host
        const isAnchor = !room.hostSocketId;
        if (isAnchor) room.hostSocketId = socket.id; // <-- The host claims the seat!

        const participantData = {
          ...user,
          id: socket.id,
          socketId: socket.id,
          peerId: socket.id,
          isHost: true,
        };

        room.participants.set(socket.id, participantData);
        socket.join(roomId);

        socket.emit('room-joined', {
          roomId,
          isHost: true,
          participants: Array.from(room.participants.values()),
        });

        // Send existing waiting room queue to the host
        socket.emit('waiting-room-update', {
          waitingUsers: Array.from(room.waitingRoom.values()),
        });

        socket.to(roomId).emit('user-joined', { user: participantData });
        io.to(roomId).emit('host-changed', { newHostId: socket.id });

        console.log(`[👑 HOST] Host/Co-host admitted by key: ${user?.name} (${socket.id}) in ${roomId}`);
        return;
      } else {
        // Explicitly WRONG key: Reject immediately, do NOT dump into waiting room
        socket.emit('invalid-host-passcode', {
          message: 'Incorrect Host Key. Please re-check the 4-digit key or join as a participant.',
        });
        console.log(`[❌ REJECT] Wrong host passcode attempted by ${user?.name} (${socket.id}) in ${roomId}`);
        return;
      }
    }

    // ------------------------------------------------------------------------
    // CASE C: STANDARD PARTICIPANT (NO KEY) -> QUEUE IN WAITING ROOM
    // ------------------------------------------------------------------------
    const candidateData = {
      ...user,
      id: socket.id,
      socketId: socket.id,
      peerId: socket.id,
    };

    room.waitingRoom.set(socket.id, candidateData);

    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });
    }

    socket.emit('waiting-approval');
    console.log(`[⏳ WAITING] ${user?.name} (${socket.id}) queued in waiting room for ${roomId}`);
  });

  // --------------------------------------------------------------------------
  // CANCEL WAITING ROOM REQUEST
  // --------------------------------------------------------------------------
  socket.on('cancel-waiting-request', ({ roomId }) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.waitingRoom.delete(socket.id);
      socket.leave(roomId);

      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('waiting-room-update', {
          waitingUsers: Array.from(room.waitingRoom.values()),
        });
      }
      console.log(`[⏳ WAITING] Socket ${socket.id} cancelled waiting for room: ${roomId}`);
    }
  });

  // 2. Host Admission Approval
  socket.on('approve-user', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) {
      console.warn(`[⚠️ WARN] Unauthorized approval attempt by socket: ${socket.id}`);
      return;
    }
    
    // suppose Bob is a normal participant in waiting queue and host approved him
    // Move Bob from waitingRoom Map to participants Map
    const user = room.waitingRoom.get(targetSocketId);
    if (user) {
      room.waitingRoom.delete(targetSocketId);
      const approvedParticipant = {
        ...user,
        id: targetSocketId,
        socketId: targetSocketId,
        peerId: targetSocketId,
        isHost: false,
      };
      room.participants.set(targetSocketId, approvedParticipant);

      // Put Bob's socket into Socket.io room channel
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(roomId);
      }

      // Notify Host with the updated waiting queue
      io.to(room.hostSocketId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });
      
      // Send admission token to Bob
      io.to(targetSocketId).emit('room-joined', {
        roomId,
        isHost: false,
        participants: Array.from(room.participants.values()),
      });

      // Notify everyone else already inside the room
      socket.to(roomId).emit('user-joined', { user: approvedParticipant });
      console.log(`[✅ ADMIT] User ${user.name} (${targetSocketId}) admitted by host into ${roomId}`);
    }
  });

  // --------------------------------------------------------------------------
  // HOST ACTION: MUTE ALL PARTICIPANTS
  // --------------------------------------------------------------------------
  socket.on('host-mute-all', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) {
      console.warn(`[⚠️ WARN] Unauthorized mute-all attempt by socket: ${socket.id}`);
      return;
    }

    console.log(`[🔇 MUTE-ALL] Host ${socket.id} triggered Mute All in room: ${roomId}`);
    socket.to(roomId).emit('force-mute');
  });

  // 3. WebRTC Signaling Relays
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    console.log(`[📡 WEBRTC] Relaying Offer: ${socket.id} -> ${targetSocketId}`);
    io.to(targetSocketId).emit('webrtc-offer', {
      callerSocketId: socket.id,
      offer,
    });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    console.log(`[📡 WEBRTC] Relaying Answer: ${socket.id} -> ${targetSocketId}`);
    io.to(targetSocketId).emit('webrtc-answer', {
      responderSocketId: socket.id,
      answer,
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc-ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    });
  });

  // 4. In-Call Chat & Reactions
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

  // 5. Disconnect Cleanup & Safe Anchor Assignment
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.participants.delete(socket.id);
        room.waitingRoom.delete(socket.id);

        io.to(roomId).emit('user-left', { socketId: socket.id });

        if (room.hostSocketId === socket.id) {
          const nextAnchorSocketId = room.participants.keys().next().value;
          if (nextAnchorSocketId) {
            room.hostSocketId = nextAnchorSocketId;
            console.log(`[⚓ ANCHOR] Host disconnected. Room anchor assigned: ${nextAnchorSocketId}`);
          } else {
            rooms.delete(roomId);
            console.log(`[🗑️ PURGE] Room ${roomId} removed (zero participants remaining)`);
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[🔌 SIGNAL] Socket disconnected: ${socket.id}`);
  });
});

// 6. Periodic Memory Housekeeping (Every 30 Minutes)
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && room.waitingRoom.size === 0) {
      rooms.delete(roomId);
      console.log(`[🧹 TTL-PURGE] Cleaned up unused room: ${roomId}`);
    }
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server active on port ${PORT}`);
});