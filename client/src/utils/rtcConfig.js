/**
 * ============================================================================
 * FILE: client/src/utils/rtcConfig.js
 * PURPOSE: WebRTC RTCPeerConnection Configuration & ICE Servers
 * 
 * CORE RESPONSIBILITIES:
 * 1. Configures Google STUN servers so peers discover public IP addresses and
 *    traverse NAT/firewalls during WebRTC signaling.
 * ============================================================================
 */

export const RTC_CONFIGURATION = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};