/**
 * ============================================================================
 * FILE: client/src/hooks/useWebRTCMesh.js
 * PURPOSE: Full WebRTC Mesh Peer Connection Manager with Transceiver Pre-allocation
 *          and Track Hot-Swapping for Approach 2 Hardware Release.
 * 
 * CORE RESPONSIBILITIES:
 * 1. RTCPeerConnection Lifecycle: Instantiates and tracks connections for each remote peer.
 * 2. Transceiver Pre-allocation: Pre-allocates bidirectional transceivers ('sendrecv')
 *    for both audio and video upfront without duplicate receiver allocations.
 * 3. [HARDWARE_TRACK_HOTSWAP]: Exposes `replaceSenderTrack(kind, newTrack)` to hot-swap
 *    fresh getUserMedia tracks (or null on mute) onto transceivers without renegotiation.
 * 4. Stable Peer Connection Ref: Prevents hook identity churn when localStream updates.
 * ============================================================================
 */

import { useState, useRef, useCallback } from 'react';
import { RTC_CONFIGURATION } from '../utils/rtcConfig';

export const useWebRTCMesh = (socket, localStream) => {
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const peerConnections = useRef({});
  const iceCandidateQueues = useRef({});
  const localStreamRef = useRef(localStream);

  // Keep localStreamRef always current without triggering function re-creations
  localStreamRef.current = localStream;

  /**
   * [HARDWARE_TRACK_HOTSWAP]: Accurately finds the RTCRtpTransceiver corresponding to kind ('audio' | 'video').
   */
  const findTransceiverByKind = (pc, kind) => {
    const transceivers = pc.getTransceivers();
    return transceivers.find((t) => {
      if (t.receiver?.track?.kind === kind) return true;
      if (t.sender?.track?.kind === kind) return true;
      return false;
    });
  };

  /**
   * Instantiates a new RTCPeerConnection for a remote peer with pre-allocated transceivers.
   */
  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      return peerConnections.current[targetSocketId];
    }

    console.log(`[📡 WEBRTC] [HARDWARE_TRACK_HOTSWAP] Initializing RTCPeerConnection for: ${targetSocketId}`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnections.current[targetSocketId] = pc;
    iceCandidateQueues.current[targetSocketId] = [];

    const currentStream = localStreamRef.current;

    // Pre-allocate audio & video transceivers with direction 'sendrecv'
    const setupTransceiver = (kind) => {
      let transceiver = findTransceiverByKind(pc, kind);
      const track = (kind === 'audio' 
        ? currentStream?.getAudioTracks()[0] 
        : currentStream?.getVideoTracks()[0]) || null;

      if (!transceiver) {
        if (track && currentStream) {
          transceiver = pc.addTransceiver(track, { direction: 'sendrecv', streams: [currentStream] });
          console.log(`[📡 WEBRTC] [HARDWARE_TRACK_HOTSWAP] ${kind} transceiver pre-allocated WITH active track for: ${targetSocketId}`);
        } else {
          transceiver = pc.addTransceiver(kind, { direction: 'sendrecv' });
          console.log(`[📡 WEBRTC] [HARDWARE_TRACK_HOTSWAP] ${kind} transceiver pre-allocated WITHOUT track (null) for: ${targetSocketId}`);
        }
      } else {
        transceiver.direction = 'sendrecv';
        if (track) {
          transceiver.sender.replaceTrack(track);
          console.log(`[📡 WEBRTC] [HARDWARE_TRACK_HOTSWAP] Existing ${kind} transceiver attached to active track for: ${targetSocketId}`);
        }
      }
    };

    setupTransceiver('audio');
    setupTransceiver('video');

    // ICE Candidate Discovery Event
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Track Event: Fires when incoming media stream from remote peer is received
    pc.ontrack = (event) => {
      console.log(`[🎥 MEDIA] [HARDWARE_TRACK_HOTSWAP] Remote track received (${event.track.kind}) from: ${targetSocketId}`);
      const [incomingStream] = event.streams;

      setRemoteStreams((prevStreams) => {
        const updated = new Map(prevStreams);
        let streamToStore = updated.get(targetSocketId);

        if (!streamToStore) {
          streamToStore = incomingStream || new MediaStream();
        }

        if (!streamToStore.getTracks().some((t) => t.id === event.track.id)) {
          streamToStore.addTrack(event.track);
        }

        updated.set(targetSocketId, new MediaStream(streamToStore.getTracks()));
        return updated;
      });
    };

    return pc;
  }, [socket]);

  /**
   * [HARDWARE_TRACK_HOTSWAP]: Hot-swaps tracks across all active peer connections.
   */
  const replaceSenderTrack = useCallback(async (kind, newTrack) => {
    const pcEntries = Object.entries(peerConnections.current);
    console.log(`[🔄 HOTSWAP] [HARDWARE_TRACK_HOTSWAP] Replacing ${kind} track across ${pcEntries.length} peer connection(s)...`);

    for (const [peerId, pc] of pcEntries) {
      if (pc.connectionState === 'closed') continue;

      const transceiver = findTransceiverByKind(pc, kind);

      if (transceiver && transceiver.sender) {
        try {
          if (newTrack && newTrack.kind !== kind) {
            console.error(`[💥 ERROR] [HARDWARE_TRACK_HOTSWAP] Track kind mismatch! Expected ${kind}, got ${newTrack.kind}`);
            continue;
          }

          // Ensure transceiver is in sendrecv mode
          if (transceiver.direction !== 'sendrecv') {
            transceiver.direction = 'sendrecv';
          }

          if (newTrack) {
            newTrack.enabled = true;
          }

          await transceiver.sender.replaceTrack(newTrack);
          console.log(`[✅ HOTSWAP] [HARDWARE_TRACK_HOTSWAP] Successfully called replaceTrack on transceiver for peer: ${peerId} (kind=${kind})`);
        } catch (err) {
          console.error(`[💥 ERROR] [HARDWARE_TRACK_HOTSWAP] Transceiver replaceTrack failed for peer ${peerId} (kind=${kind}):`, err);
        }
      } else {
        const sender = pc.getSenders().find((s) => s.track?.kind === kind);
        if (sender) {
          try {
            await sender.replaceTrack(newTrack);
            console.log(`[✅ HOTSWAP] [HARDWARE_TRACK_HOTSWAP] Fallback sender.replaceTrack succeeded for peer: ${peerId} (kind=${kind})`);
          } catch (err) {
            console.error(`[💥 ERROR] [HARDWARE_TRACK_HOTSWAP] Fallback sender.replaceTrack failed for peer ${peerId}:`, err);
          }
        }
      }
    }
  }, []);

  const processIceQueue = async (targetSocketId, pc) => {
    const queue = iceCandidateQueues.current[targetSocketId] || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`[💥 ERROR] Failed to apply queued ICE candidate for ${targetSocketId}:`, err);
      }
    }
  };

  const initiateCall = useCallback(async (targetSocketId) => {
    try {
      console.log(`[📡 WEBRTC] Creating SDP Offer for: ${targetSocketId}`);
      const pc = createPeerConnection(targetSocketId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc-offer', {
        targetSocketId,
        offer,
      });
    } catch (err) {
      console.error(`[💥 ERROR] Failed to initiate call to ${targetSocketId}:`, err);
    }
  }, [createPeerConnection, socket]);

  const handleOffer = useCallback(async (callerSocketId, offer) => {
    try {
      console.log(`[📡 WEBRTC] Handling incoming Offer from: ${callerSocketId}`);
      const pc = createPeerConnection(callerSocketId);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processIceQueue(callerSocketId, pc);

      pc.getTransceivers().forEach((transceiver) => {
        transceiver.direction = 'sendrecv';
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc-answer', {
        targetSocketId: callerSocketId,
        answer,
      });
    } catch (err) {
      console.error(`[💥 ERROR] Failed to handle offer from ${callerSocketId}:`, err);
    }
  }, [createPeerConnection, socket]);

  const handleAnswer = useCallback(async (responderSocketId, answer) => {
    try {
      console.log(`[📡 WEBRTC] Handling incoming Answer from: ${responderSocketId}`);
      const pc = peerConnections.current[responderSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await processIceQueue(responderSocketId, pc);
      }
    } catch (err) {
      console.error(`[💥 ERROR] Failed to handle answer from ${responderSocketId}:`, err);
    }
  }, []);

  const handleIceCandidate = useCallback(async (senderSocketId, candidate) => {
    const pc = peerConnections.current[senderSocketId];

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`[💥 ERROR] Failed to add direct ICE candidate for ${senderSocketId}:`, err);
      }
    } else {
      if (!iceCandidateQueues.current[senderSocketId]) {
        iceCandidateQueues.current[senderSocketId] = [];
      }
      iceCandidateQueues.current[senderSocketId].push(candidate);
    }
  }, []);

  const removePeer = useCallback((socketId) => {
    console.log(`[🧹 CLEANUP] Closing connection and removing stream for: ${socketId}`);
    const pc = peerConnections.current[socketId];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      delete peerConnections.current[socketId];
    }
    delete iceCandidateQueues.current[socketId];

    setRemoteStreams((prevStreams) => {
      const updated = new Map(prevStreams);
      updated.delete(socketId);
      return updated;
    });
  }, []);

  return {
    remoteStreams,
    peerConnectionsRef: peerConnections,
    replaceSenderTrack,
    initiateCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
  };
};