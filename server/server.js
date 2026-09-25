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
 * 4. Disconnect Handling: Prevents non-host candidates from getting admin rights.
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
    socket.join(roomId);

    // Case A: Room doesn't exist yet -> First user becomes Host
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        hostPasscode: hostPasscode || '1234',
        hostSocketId: socket.id,
        participants: new Map([[socket.id, { ...user, socketId: socket.id, isHost: true }]]),
        waitingRoom: new Map(),
      });

      socket.emit('room-joined', {
        isHost: true,
        participants: Array.from(rooms.get(roomId).participants.values()),
      });

      console.log(`[👑 HOST] Room created: ${roomId} | Host: ${user.name} (${socket.id})`);
      return;
    }

    const room = rooms.get(roomId);

    // Case B: User enters with the valid Host Passcode -> Reclaim Host Role
    const isAuthenticHost = hostPasscode && hostPasscode === room.hostPasscode;

    if (isAuthenticHost) {
      room.hostSocketId = socket.id;
      room.participants.set(socket.id, { ...user, socketId: socket.id, isHost: true });

      socket.emit('room-joined', {
        isHost: true,
        participants: Array.from(room.participants.values()),
      });

      // Broadcast new peer to active room and announce host update
      socket.to(roomId).emit('user-joined', { user: { ...user, socketId: socket.id, isHost: true } });
      io.to(roomId).emit('host-changed', { newHostId: socket.id });

      console.log(`[👑 HOST] Host reclaimed by: ${user.name} (${socket.id}) in room: ${roomId}`);
      return;
    }

    // Case C: Standard Participant / Candidate -> Routed to Waiting Room
    room.waitingRoom.set(socket.id, { ...user, socketId: socket.id });

    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });
    }

    socket.emit('waiting-approval');
    console.log(`[⏳ WAITING] ${user.name} (${socket.id}) added to waiting queue for room: ${roomId}`);
  });

  // 2. Host Admission Approval
  socket.on('approve-user', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) {
      console.warn(`[⚠️ WARN] Unauthorized approval attempt by socket: ${socket.id}`);
      return;
    }

    const user = room.waitingRoom.get(targetSocketId);
    if (user) {
      room.waitingRoom.delete(targetSocketId);
      room.participants.set(targetSocketId, { ...user, isHost: false });

      io.to(room.hostSocketId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });

      io.to(targetSocketId).emit('room-joined', {
        isHost: false,
        participants: Array.from(room.participants.values()),
      });

      socket.to(roomId).emit('user-joined', { user: { ...user, isHost: false } });
      console.log(`[✅ ADMIT] User ${user.name} (${targetSocketId}) admitted by host`);
    }
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server active on port ${PORT}`);
});