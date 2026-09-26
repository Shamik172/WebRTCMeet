/**
 * ============================================================================
 * FILE: client/src/hooks/useMediaStream.js
 * PURPOSE: Resilient Media Hook with Independent Audio/Video Track Lifecycle
 * 
 * CORE RESPONSIBILITIES:
 * 1. Independent audio & video track acquisition without terminating sibling tracks.
 * 2. Unmount cleanup strictly tied to component unmount (empty dependency array).
 * 3. Proper track removal on mute to release OS/browser hardware indicators.
 * 4. Graceful handling of single or dual-device environments.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export const useMediaStream = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [hasCamHardware, setHasCamHardware] = useState(true); // Default true until detection runs
  const [hasMicHardware, setHasMicHardware] = useState(true);
  const [audioAllowed, setAudioAllowed] = useState(false);
  const [videoAllowed, setVideoAllowed] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const streamRef = useRef(new MediaStream());

  // 1. Detect hardware presence
  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCam = devices.some((d) => d.kind === 'videoinput');
        const hasMic = devices.some((d) => d.kind === 'audioinput');
        
        setHasCamHardware(hasCam);
        setHasMicHardware(hasMic);
        console.log(`[🎥 HARDWARE] Detected: Cam=${hasCam}, Mic=${hasMic}`);
      } catch (err) {
        console.warn('[⚠️ HARDWARE] Failed to inspect hardware devices:', err);
      }
    };

    checkDevices();
  }, []);

  /**
   * 2. Request Microphone Access
   */
  const requestAudio = useCallback(async () => {
    try {
      console.log('[🎙️ AUDIO] Requesting microphone track...');
      // Ask OS for audio hardware track
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newAudioTrack = audioStream.getAudioTracks()[0];

      // Remove existing audio tracks if any
      streamRef.current.getAudioTracks().forEach((track) => {
        track.stop();
        streamRef.current.removeTrack(track);
      });

      // Add the new active audio track without touching video tracks
      streamRef.current.addTrack(newAudioTrack);
      // Force React to re-render by instantiating a new MediaStream wrapper
      setLocalStream(new MediaStream(streamRef.current.getTracks()));

      setAudioAllowed(true);
      setIsAudioMuted(false);
      setPermissionError(null);
      console.log('[🎙️ AUDIO] Microphone active');
      return true;
    } catch (err) {
      console.error('[💥 ERROR] Microphone request failed:', err);
      setPermissionError('Microphone permission denied or device busy.');
      return false;
    }
  }, []);

  /**
   * 3. Request Camera Access
   */
  const requestVideo = useCallback(async () => {
    if (!hasCamHardware) {
      setPermissionError('No camera detected on this system.');
      return false;
    }

    try {
      console.log('[📷 VIDEO] Requesting camera track...');
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = videoStream.getVideoTracks()[0];

      // Remove existing video tracks if any
      streamRef.current.getVideoTracks().forEach((track) => {
        track.stop();  // Releases hardware handle back to OS (webcam LED turns off)
        streamRef.current.removeTrack(track);
      });

      // Add the new active video track without touching audio tracks
      streamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(streamRef.current.getTracks()));

      setVideoAllowed(true);
      setIsVideoOff(false);
      setPermissionError(null);
      console.log('[📷 VIDEO] Camera active');
      return true;
    } catch (err) {
      console.error('[💥 ERROR] Camera request failed:', err);
      setPermissionError('Camera access denied or hardware busy.');
      return false;
    }
  }, [hasCamHardware]);

  /**
   * 4. Toggle Audio with Full Hardware Release
   */
  const toggleAudio = useCallback(() => {
    if (isAudioMuted) {
      requestAudio();
    } else {
      // Remove & stop track so OS microphone indicator turns off
      streamRef.current.getAudioTracks().forEach((track) => {
        track.stop();
        streamRef.current.removeTrack(track);
      });
      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsAudioMuted(true);
      console.log('[🎙️ AUDIO] Mic muted: OS hardware released');
    }
  }, [isAudioMuted, requestAudio]);

  /**
   * 5. Toggle Video with Full Hardware Release
   */
  const toggleVideo = useCallback(() => {
    if (!hasCamHardware) {
      setPermissionError('No camera detected on this system.');
      return;
    }

    if (isVideoOff) {
      requestVideo();
    } else {
      // Remove & stop track so webcam hardware LED turns off
      streamRef.current.getVideoTracks().forEach((track) => {
        track.stop();
        streamRef.current.removeTrack(track);
      });
      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsVideoOff(true);
      console.log('[📷 VIDEO] Camera turned off: OS hardware released');
    }
  }, [hasCamHardware, isVideoOff, requestVideo]);

  /**
   * 6. Force Mute (Remote Host Command)
   */
  const forceMuteAudio = useCallback(() => {
    streamRef.current.getAudioTracks().forEach((track) => {
      track.stop();
      streamRef.current.removeTrack(track);
    });
    setLocalStream(new MediaStream(streamRef.current.getTracks()));
    setIsAudioMuted(true);
    console.log('[🔇 MUTE] Audio remotely terminated by Host');
  }, []);

  /**
   * 7. Cleanup ONLY on component unmount
   */
  useEffect(() => {
    return () => {
      console.log('[🎥 MEDIA] Stopping all tracks on final unmount');
      streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []); // <-- Empty array ensures this ONLY runs when exiting the page!

  return {
    localStream,
    isAudioMuted,
    isVideoOff,
    hasCamHardware,
    hasMicHardware,
    audioAllowed,
    videoAllowed,
    permissionError,
    requestAudio,
    requestVideo,
    toggleAudio,
    toggleVideo,
    forceMuteAudio,
  };
};