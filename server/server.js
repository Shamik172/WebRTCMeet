/**
 * ============================================================================
 * FILE: server/server.js
 * PURPOSE: Socket.io Signaling & Room Coordination Server (WebRTC Mesh)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Room Management: Maintains active rooms, participants, and waiting room queues.
 * 2. Host Approvals: Relays host admission actions for waiting room users.
 * 3. WebRTC Signaling Relays: Passes SDP Offers, Answers, and ICE Candidates
 *    directly between peers (Peer A <-> Signaling Server <-> Peer B).
 * 4. Cleanup & Host Migration: Cleans disconnected peers to prevent UI bugs and
 *    reassigns room host if current host leaves.
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
    origin: '*', // Allows connection from local Vite frontend
    methods: ['GET', 'POST'],
  },
});

/**
 * In-memory store for room state.
 * Structure: Map<roomId, { hostId: string, participants: Map<socketId, user>, waitingRoom: Map<socketId, user> }>
 */
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // --------------------------------------------------------------------------
  // 1. JOIN ROOM REQUEST
  // Assigns Host or places joining user into Waiting Room.
  // --------------------------------------------------------------------------
  socket.on('join-room-request', ({ roomId, user }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      // First user becomes the Room Host
      rooms.set(roomId, {
        hostId: socket.id,
        participants: new Map([[socket.id, { ...user, socketId: socket.id, isHost: true }]]),
        waitingRoom: new Map(),
      });

      socket.emit('room-joined', {
        isHost: true,
        participants: Array.from(rooms.get(roomId).participants.values()),
      });
      console.log(`👑 Room ${roomId} created by Host: ${socket.id}`);
    } else {
      const room = rooms.get(roomId);

      // Route new user to waiting room
      room.waitingRoom.set(socket.id, { ...user, socketId: socket.id });

      // Notify Host about pending user
      io.to(room.hostId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });

      socket.emit('waiting-approval');
      console.log(`⏳ User ${socket.id} added to waiting room in ${roomId}`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. HOST APPROVES WAITING USER
  // Moves user from waiting list to active call and notifies existing peers.
  // --------------------------------------------------------------------------
  socket.on('approve-user', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    const user = room.waitingRoom.get(targetSocketId);
    if (user) {
      room.waitingRoom.delete(targetSocketId);
      room.participants.set(targetSocketId, user);

      // Update host's waiting room drawer
      io.to(room.hostId).emit('waiting-room-update', {
        waitingUsers: Array.from(room.waitingRoom.values()),
      });

      // Confirm entrance to approved user
      io.to(targetSocketId).emit('room-joined', {
        isHost: false,
        participants: Array.from(room.participants.values()),
      });

      // Notify existing room members so they initiate WebRTC connection
      socket.to(roomId).emit('user-joined', { user });
    }
  });

  // --------------------------------------------------------------------------
  // 3. WEBRTC SIGNALING RELAYS
  // Direct transmission of SDP Offers, Answers, and ICE Candidates.
  // --------------------------------------------------------------------------

  // Relay SDP Offer
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc-offer', {
      callerSocketId: socket.id,
      offer,
    });
  });

  // Relay SDP Answer
  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc-answer', {
      responderSocketId: socket.id,
      answer,
    });
  });

  // Relay ICE Candidate (Network routing info)
  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc-ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    });
  });

  // --------------------------------------------------------------------------
  // 4. CHAT & EMOJI REACTION RELAYS
  // Broadcasts text messages and animated reactions during calls.
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 5. DISCONNECT CLEANUP & HOST MIGRATION
  // --------------------------------------------------------------------------
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.participants.delete(socket.id);
        room.waitingRoom.delete(socket.id);

        // Tell remaining clients to destroy this peer's RTCPeerConnection & DOM element
        io.to(roomId).emit('user-left', { socketId: socket.id });

        // Migration: If Host disconnects, assign new Host
        if (room.hostId === socket.id) {
          const nextHostSocketId = room.participants.keys().next().value;
          if (nextHostSocketId) {
            room.hostId = nextHostSocketId;
            const newHostUser = room.participants.get(nextHostSocketId);
            newHostUser.isHost = true;

            io.to(nextHostSocketId).emit('host-assigned');
            io.to(roomId).emit('host-changed', { newHostId: nextHostSocketId });
          } else {
            rooms.delete(roomId); // Clean empty room from memory
          }
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
});