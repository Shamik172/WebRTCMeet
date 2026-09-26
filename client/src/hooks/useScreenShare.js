/**
 * ============================================================================
 * FILE: client/src/hooks/useScreenShare.js
 * PURPOSE: Resilient Screen Capture with Seamless Track Swapping
 * 
 * CORE RESPONSIBILITIES:
 * 1. Requests display stream from browser via getDisplayMedia.
 * 2. Manages track swapping between webcam and screen presentation.
 * 3. Handles browser-native "Stop Sharing" floating button callback.
 * 4. Gracefully recovers original camera track upon termination.
 * ============================================================================
 */

import { useState, useCallback, useRef } from 'react';

export const useScreenShare = ({ localStream, onTrackReplace, showToast }) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      console.log('[🖥️ SCREEN] Requesting display media...');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      // Handle user clicking native browser "Stop sharing" ribbon
      screenTrack.onended = () => {
        console.log('[🖥️ SCREEN] Native display share ended');
        stopScreenShare();
      };

      // Notify peer connections to swap out camera track for screen track
      if (onTrackReplace && localStream) {
        const originalVideoTrack = localStream.getVideoTracks()[0];
        onTrackReplace(screenTrack, originalVideoTrack);
      }

      setIsScreenSharing(true);
      if (showToast) showToast('Screen sharing started', 'info');
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[💥 ERROR] Screen share failed:', err);
        if (showToast) showToast('Failed to start screen share', 'error');
      }
    }
  }, [localStream, onTrackReplace, showToast]);

  const stopScreenShare = useCallback(() => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    // Revert peer connections back to original local camera track
    if (onTrackReplace && localStream) {
      const originalVideoTrack = localStream.getVideoTracks()[0];
      if (originalVideoTrack) {
        onTrackReplace(originalVideoTrack, null);
      }
    }

    setIsScreenSharing(false);
    if (showToast) showToast('Screen sharing stopped', 'info');
  }, [localStream, onTrackReplace, showToast]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    isScreenSharing,
    toggleScreenShare,
    stopScreenShare,
  };
};