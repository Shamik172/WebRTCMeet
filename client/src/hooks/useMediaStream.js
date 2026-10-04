/**
 * ============================================================================
 * FILE: client/src/hooks/useMediaStream.js
 * PURPOSE: Resilient Media Hook with Independent Audio/Video Track Lifecycle
 *          strictly adhering to Approach 2 (Hardware Release via track.stop()).
 * 
 * CORE RESPONSIBILITIES:
 * 1. Independent audio & video track acquisition without terminating sibling tracks.
 * 2. Unmount cleanup strictly tied to component unmount.
 * 3. Complete track release on mute (webcam LED turns off, OS mic dot clears).
 * 4. [HARDWARE_TRACK_HOTSWAP]: Returns active or null track references directly
 *    from toggles so WebRTC transceivers can be updated synchronously.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export const useMediaStream = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [hasCamHardware, setHasCamHardware] = useState(true);
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
        console.log(`[🎥 HARDWARE] Detected devices: Cam=${hasCam}, Mic=${hasMic}`);
      } catch (err) {
        console.warn('[⚠️ HARDWARE] Failed to inspect hardware devices:', err);
      }
    };

    checkDevices();
  }, []);

  /**
   * 2. Request Microphone Access
   * [HARDWARE_TRACK_HOTSWAP]: Returns the fresh audio track to the caller.
   */
  const requestAudio = useCallback(async () => {
    try {
      console.log('[🎙️ AUDIO] [HARDWARE_TRACK_HOTSWAP] Requesting fresh OS microphone track...');
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newAudioTrack = audioStream.getAudioTracks()[0];

      // Stop & remove existing audio tracks if any are lingering
      streamRef.current.getAudioTracks().forEach((track) => {
        // [HARDWARE_RELEASE_STOP]: Stop previous track before replacing
        track.stop();
        streamRef.current.removeTrack(track);
      });

      // Add the active fresh audio track to local stream
      streamRef.current.addTrack(newAudioTrack);
      setLocalStream(new MediaStream(streamRef.current.getTracks()));

      setAudioAllowed(true);
      setIsAudioMuted(false);
      setPermissionError(null);
      console.log(`[🎙️ AUDIO] [HARDWARE_TRACK_HOTSWAP] Mic active. Fresh track ID: ${newAudioTrack.id}`);
      return newAudioTrack;
    } catch (err) {
      console.error('[💥 ERROR] [HARDWARE_TRACK_HOTSWAP] Microphone request failed:', err);
      setPermissionError('Microphone permission denied or device busy.');
      return null;
    }
  }, []);

  /**
   * 3. Request Camera Access
   * [HARDWARE_TRACK_HOTSWAP]: Returns the fresh video track to the caller.
   */
  const requestVideo = useCallback(async () => {
    if (!hasCamHardware) {
      setPermissionError('No camera detected on this system.');
      return null;
    }

    try {
      console.log('[📷 VIDEO] [HARDWARE_TRACK_HOTSWAP] Requesting fresh OS camera track...');
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = videoStream.getVideoTracks()[0];

      // Stop & remove existing video tracks to ensure hardware handle is clean
      streamRef.current.getVideoTracks().forEach((track) => {
        // [HARDWARE_RELEASE_STOP]: Hardware release
        track.stop();
        streamRef.current.removeTrack(track);
      });

      // Add active fresh video track to local stream
      streamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(streamRef.current.getTracks()));

      setVideoAllowed(true);
      setIsVideoOff(false);
      setPermissionError(null);
      console.log(`[📷 VIDEO] [HARDWARE_TRACK_HOTSWAP] Camera active. Fresh track ID: ${newVideoTrack.id}`);
      return newVideoTrack;
    } catch (err) {
      console.error('[💥 ERROR] [HARDWARE_TRACK_HOTSWAP] Camera request failed:', err);
      setPermissionError('Camera access denied or hardware busy.');
      return null;
    }
  }, [hasCamHardware]);

  /**
   * 4. Toggle Audio with Full Hardware Release
   * [HARDWARE_TRACK_HOTSWAP]: Returns Promise<MediaStreamTrack | null>
   */
  const toggleAudio = useCallback(async () => {
    if (isAudioMuted) {
      const activeTrack = await requestAudio();
      return activeTrack;
    } else {
      // [HARDWARE_RELEASE_STOP]: Kill tracks so OS indicator clears
      streamRef.current.getAudioTracks().forEach((track) => {
        console.log(`[🎙️ AUDIO] [HARDWARE_RELEASE_STOP] Stopping audio track ${track.id}`);
        track.stop();
        streamRef.current.removeTrack(track);
      });
      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsAudioMuted(true);
      console.log('[🎙️ AUDIO] [HARDWARE_TRACK_HOTSWAP] Mic muted: OS hardware fully released');
      return null;
    }
  }, [isAudioMuted, requestAudio]);

  /**
   * 5. Toggle Video with Full Hardware Release
   * [HARDWARE_TRACK_HOTSWAP]: Returns Promise<MediaStreamTrack | null>
   */
  const toggleVideo = useCallback(async () => {
    if (!hasCamHardware) {
      setPermissionError('No camera detected on this system.');
      return null;
    }

    if (isVideoOff) {
      const activeTrack = await requestVideo();
      return activeTrack;
    } else {
      // [HARDWARE_RELEASE_STOP]: Stop tracks so webcam LED turns off
      streamRef.current.getVideoTracks().forEach((track) => {
        console.log(`[📷 VIDEO] [HARDWARE_RELEASE_STOP] Stopping video track ${track.id}`);
        track.stop();
        streamRef.current.removeTrack(track);
      });
      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setIsVideoOff(true);
      console.log('[📷 VIDEO] [HARDWARE_TRACK_HOTSWAP] Camera turned off: OS hardware LED fully released');
      return null;
    }
  }, [hasCamHardware, isVideoOff, requestVideo]);

  /**
   * 6. Force Mute (Remote Host Command)
   */
  const forceMuteAudio = useCallback(() => {
    streamRef.current.getAudioTracks().forEach((track) => {
      // [HARDWARE_RELEASE_STOP]: Host command release
      track.stop();
      streamRef.current.removeTrack(track);
    });
    setLocalStream(new MediaStream(streamRef.current.getTracks()));
    setIsAudioMuted(true);
    console.log('[🔇 MUTE] [HARDWARE_RELEASE_STOP] Audio remotely terminated by Host');
    return null;
  }, []);

  /**
   * 7. Cleanup ONLY on component unmount
   */
  useEffect(() => {
    const currentStream = streamRef.current;
    return () => {
      console.log('[🎥 MEDIA] [HARDWARE_RELEASE_STOP] Stopping all tracks on final unmount');
      currentStream.getTracks().forEach((track) => track.stop());
    };
  }, []);

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