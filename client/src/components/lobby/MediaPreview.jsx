/**
 * ============================================================================
 * FILE: client/src/components/lobby/MediaPreview.jsx
 * PURPOSE: Interactive Camera Feed Preview & Hardware Toggles (VisionOS style)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Attaches local MediaStream to an HTML5 <video> element.
 * 2. Mirrors camera preview for a natural selfie perspective.
 * 3. Provides floating pill controls for toggling mic and camera before joining.
 * 4. Displays real-time audio visualizer waves when speaking.
 * 5. Dispatches instant glass toast notifications on mic/camera state changes.
 * ============================================================================
 */

import React, { useRef, useEffect, useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';

export const MediaPreview = ({
  localStream,
  isAudioMuted,
  isVideoOff,
  hasCamHardware = true,
  toggleAudio,
  toggleVideo,
  displayName = 'You',
}) => {
  const videoRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const { showToast } = useRoom();

  // Sync stream to video DOM element & ensure playback continues
  useEffect(() => {
    if (videoRef.current && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.enabled) {
        videoRef.current.srcObject = localStream;
        videoRef.current.play().catch((err) => {
          console.warn('[🎥 PREVIEW] Autoplay interrupted:', err);
        });
      }
    }
  }, [localStream, isVideoOff]);

  // Audio level visualizer for mic activity
  useEffect(() => {
    if (!localStream || isAudioMuted) {
      setAudioLevel(0);
      return;
    }

    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) return;

    let audioCtx;
    let analyser;
    let source;
    let animFrameId;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const render = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameId = requestAnimationFrame(render);
      };

      render();
    } catch (e) {
      console.warn('[🎥 PREVIEW] Audio analyser error:', e);
    }

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [localStream, isAudioMuted]);

  // Handlers with tactile Toast feedback
  const handleToggleAudio = () => {
    toggleAudio();
    if (showToast) {
      if (isAudioMuted) {
        showToast('Microphone unmuted', 'success');
      } else {
        showToast('Microphone muted (hardware released)', 'mute');
      }
    }
  };

  const handleToggleVideo = () => {
    if (!hasCamHardware) {
      if (showToast) showToast('No camera hardware detected', 'warning');
      return;
    }
    toggleVideo();
    if (showToast) {
      if (isVideoOff) {
        showToast('Camera enabled', 'success');
      } else {
        showToast('Camera turned off', 'warning');
      }
    }
  };

  return (
    <div className="relative w-full h-64 sm:h-72 lg:h-[380px] rounded-3xl overflow-hidden p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-md">
      
      {/* Specular Inner Container */}
      <div className="relative w-full h-full rounded-[23px] overflow-hidden bg-slate-950/40 backdrop-blur-xl flex items-center justify-center border border-white/5">
        
        {/* Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
            isVideoOff || !hasCamHardware ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Ambient Darkened Background Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Placeholder when Camera is Off or Unavailable */}
        {(isVideoOff || !hasCamHardware) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-sm gap-2.5 p-4 text-center">
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-slate-300 shadow-xl">
                <VideoOff className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400 stroke-[1.5]" />
              </div>
              <div className="absolute -inset-1 rounded-2xl border border-cyan-400/20 animate-pulse pointer-events-none" />
            </div>

            <div>
              <span className="text-sm font-semibold text-slate-200 block">
                {!hasCamHardware ? 'No Camera Detected' : 'Camera is Off'}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                {!hasCamHardware ? 'Check permissions or connect cam' : 'Avatar mode enabled for this session'}
              </span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
          <div className="px-3 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/15 flex items-center gap-2 text-xs font-medium text-slate-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate max-w-[120px]">{displayName.trim() || 'Guest'}</span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/15 flex items-center gap-2 text-xs shadow-sm">
            {isAudioMuted ? (
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <MicOff className="w-3.5 h-3.5" /> Muted
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-300">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <div className="flex items-end gap-0.5 h-3 w-6">
                  <span 
                    className="w-1.5 bg-cyan-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(20, audioLevel * 0.9)}%` }} 
                  />
                  <span 
                    className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(15, audioLevel * 1.3)}%` }} 
                  />
                  <span 
                    className="w-1.5 bg-cyan-400 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(30, audioLevel * 0.7)}%` }} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Control Pill Bar */}
        <div className="absolute bottom-3 inset-x-0 flex items-center justify-center z-10">
          <div className="p-1 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/15 shadow-[0_10px_25px_rgba(0,0,0,0.5)] flex items-center gap-2">
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
                isAudioMuted
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
              title={isAudioMuted ? 'Turn on Microphone' : 'Turn off Microphone (Releases hardware)'}
            >
              {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Camera Toggle Button */}
            <button
              type="button"
              onClick={handleToggleVideo}
              disabled={!hasCamHardware}
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 active:scale-95 ${
                !hasCamHardware
                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                  : isVideoOff
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 cursor-pointer'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer'
              }`}
              title={!hasCamHardware ? 'No camera hardware found' : isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
            >
              {isVideoOff || !hasCamHardware ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};