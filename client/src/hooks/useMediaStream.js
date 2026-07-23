/**
 * ============================================================================
 * FILE: client/src/hooks/useMediaStream.js
 * PURPOSE: React Custom Hook for Local Camera & Mic Permissions
 * 
 * CORE RESPONSIBILITIES:
 * 1. Obtains local video/audio tracks via `navigator.mediaDevices.getUserMedia`.
 * 2. Toggles mute state for microphone and video tracks safely.
 * 3. Discovers connected microphones and cameras for device selection.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';

export const useMediaStream = () => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [devices, setDevices] = useState({ audioInputs: [], videoInputs: [] });
  const [selectedDevices, setSelectedDevices] = useState({ audioId: '', videoId: '' });
  const [permissionError, setPermissionError] = useState(null);

  /**
   * Fetches local camera and microphone tracks.
   */
  const getMedia = useCallback(async (audioDeviceId = '', videoDeviceId = '') => {
    try {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setPermissionError(null);

      // List available webcams and microphones
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: allDevices.filter((d) => d.kind === 'audioinput'),
        videoInputs: allDevices.filter((d) => d.kind === 'videoinput'),
      });

      return stream;
    } catch (err) {
      console.error('Failed to get user media:', err);
      setPermissionError('Camera or Microphone access denied. Please grant permissions.');
      return null;
    }
  }, []);

  useEffect(() => {
    getMedia();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Mute/Unmute Mic
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Turn Camera On/Off
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Switch Active Hardware Device
  const changeDevice = useCallback(
    async (type, deviceId) => {
      setSelectedDevices((prev) => ({ ...prev, [type]: deviceId }));
      const newAudioId = type === 'audioId' ? deviceId : selectedDevices.audioId;
      const newVideoId = type === 'videoId' ? deviceId : selectedDevices.videoId;
      await getMedia(newAudioId, newVideoId);
    },
    [getMedia, selectedDevices]
  );

  return {
    localStream,
    isAudioMuted,
    isVideoOff,
    permissionError,
    devices,
    selectedDevices,
    toggleAudio,
    toggleVideo,
    changeDevice,
  };
};