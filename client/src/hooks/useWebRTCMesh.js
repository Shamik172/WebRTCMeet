/**
 * ============================================================================
 * FILE: client/src/hooks/useWebRTCMesh.js
 * PURPOSE: Full WebRTC Mesh Peer Connection Manager
 * 
 * CORE RESPONSIBILITIES:
 * 1. RTCPeerConnection Lifecycle: Instantiates and tracks connections for each remote peer.
 * 2. ICE Candidate Queueing: Buffers early ICE candidates until setRemoteDescription completes,
 *    preventing "Remote description is null" race condition crashes.
 * 3. SDP Negotiation: Manages createOffer, setLocalDescription, setRemoteDescription, and createAnswer cycles.
 * 4. Cleanup & DOM Sync: Completely closes peer connections and clears remote streams on peer disconnect,
 *    eliminating blank video tile artifacts.
 * ============================================================================
 */

import { useState, useRef, useCallback } from 'react';
import { RTC_CONFIGURATION } from '../utils/rtcConfig';

export const useWebRTCMesh = (socket, localStream) => {
  // Map of socketId -> Remote MediaStream object for rendering video tiles
  const [remoteStreams, setRemoteStreams] = useState(new Map());

  // Ref holds active RTCPeerConnection objects without triggering unnecessary React re-renders
  // Structure: peerConnections.current[socketId] = RTCPeerConnection
  const peerConnections = useRef({});

  // Ref holds candidate queues for each peer to prevent ICE race conditions
  // Structure: iceCandidateQueues.current[socketId] = Array<RTCIceCandidate>
  const iceCandidateQueues = useRef({});

  /**
   * Instantiates a new RTCPeerConnection for a remote peer.
   */
  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      return peerConnections.current[targetSocketId];
    }

    console.log(`[📡 WEBRTC] Initializing RTCPeerConnection for: ${targetSocketId}`);
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnections.current[targetSocketId] = pc;
    iceCandidateQueues.current[targetSocketId] = [];

    // Attach local microphone and camera tracks to the peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      console.log(`[📡 WEBRTC] Attached local tracks to peer: ${targetSocketId}`);
    }

    // ICE Candidate Discovery Event: Sends network coordinates to target peer via Socket.io
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
      console.log(`[🎥 MEDIA] Remote track received from: ${targetSocketId}`);
      const [incomingStream] = event.streams;
      setRemoteStreams((prevStreams) => {
        const updated = new Map(prevStreams);
        updated.set(targetSocketId, incomingStream);
        return updated;
      });
    };

    return pc;
  }, [localStream, socket]);

  /**
   * Empties and applies queued ICE candidates once setRemoteDescription has resolved.
   */
  const processIceQueue = async (targetSocketId, pc) => {
    const queue = iceCandidateQueues.current[targetSocketId] || [];
    if (queue.length > 0) {
      console.log(`[🧊 ICE-QUEUE] Flushing ${queue.length} buffered candidates for: ${targetSocketId}`);
    }
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`[💥 ERROR] Failed to apply queued ICE candidate for ${targetSocketId}:`, err);
      }
    }
  };

  /**
   * Caller Flow: Initiates call by creating SDP Offer and emitting to target peer.
   */
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

  /**
   * Receiver Flow: Handles incoming SDP Offer and returns SDP Answer.
   */
  const handleOffer = useCallback(async (callerSocketId, offer) => {
    try {
      console.log(`[📡 WEBRTC] Handling incoming Offer from: ${callerSocketId}`);
      const pc = createPeerConnection(callerSocketId);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await processIceQueue(callerSocketId, pc);

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

  /**
   * Caller Flow: Applies incoming SDP Answer from responder.
   */
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

  /**
   * ICE Handler: Queues candidates if remote description is missing, applies immediately if present.
   */
  const handleIceCandidate = useCallback(async (senderSocketId, candidate) => {
    const pc = peerConnections.current[senderSocketId];

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error(`[💥 ERROR] Failed to add direct ICE candidate for ${senderSocketId}:`, err);
      }
    } else {
      console.log(`[🧊 ICE-QUEUE] Remote description pending. Buffering candidate for: ${senderSocketId}`);
      if (!iceCandidateQueues.current[senderSocketId]) {
        iceCandidateQueues.current[senderSocketId] = [];
      }
      iceCandidateQueues.current[senderSocketId].push(candidate);
    }
  }, []);

  /**
   * Disconnect Cleanup: Teardown RTCPeerConnection and remove stream from React state.
   */
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
    initiateCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
  };
};