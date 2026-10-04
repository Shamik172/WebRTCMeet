/**
 * ============================================================================
 * FILE: client/src/components/meeting/ParticipantTile.jsx
 * PURPOSE: Glassmorphic Video Tile with Speaking Halo & State Indicators
 * 
 * CORE RESPONSIBILITIES:
 * 1. Binds live MediaStream track to an auto-playing HTML5 <video> element.
 * 2. [HARDWARE_TRACK_HOTSWAP]: Wakes up the HTML5 video element decoder when
 *    remote packets resume via 'unmute' and 'loadedmetadata' listeners.
 * 3. Shows avatar fallback cleanly when video is toggled off.
 * ============================================================================
 */

import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Crown, Shield, User } from 'lucide-react';

export const ParticipantTile = ({
  peerId,
  name = 'Guest',
  stream,
  isLocal = false,
  isHost = false,
  isCoHost = false,
  isMuted = false,
  isVideoOff = false,
  isSpeaking = false,
}) => {
  const videoRef = useRef(null);
  const [hasActiveVideo, setHasActiveVideo] = useState(false);

  /**
   * [HARDWARE_TRACK_HOTSWAP]: Stream binding & decoder wakeup
   */
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!stream) {
      if (videoEl.srcObject) {
        videoEl.srcObject = null;
      }
      setHasActiveVideo(false);
      return;
    }

    if (videoEl.srcObject !== stream) {
      console.log(`[🎥 TILE] [HARDWARE_TRACK_HOTSWAP] Binding stream to video element for ${name} (${peerId})`);
      videoEl.srcObject = stream;
    }

    const checkTrackState = () => {
      const videoTracks = stream.getVideoTracks();
      const track = videoTracks[0];
      const hasTrack = Boolean(track && track.readyState === 'live');
      setHasActiveVideo(hasTrack);
    };

    checkTrackState();

    const triggerPlay = () => {
      if (videoEl && !isVideoOff) {
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[🎥 TILE] [HARDWARE_TRACK_HOTSWAP] Video playback running for ${name}`);
              setHasActiveVideo(true);
            })
            .catch((err) => {
              if (err.name === 'AbortError') return;
              console.warn(`[🎥 TILE] [HARDWARE_TRACK_HOTSWAP] Autoplay blocked for ${name}:`, err);
              if (!isLocal && !videoEl.muted) {
                videoEl.muted = true;
                videoEl.play().catch(() => {});
              }
            });
        }
      }
    };

    triggerPlay();

    // Inbound track listeners
    const handleAddTrack = () => {
      checkTrackState();
      triggerPlay();
    };

    const handleRemoveTrack = () => {
      checkTrackState();
    };

    stream.addEventListener('addtrack', handleAddTrack);
    stream.addEventListener('removetrack', handleRemoveTrack);

    const videoTracks = stream.getVideoTracks();
    const trackListeners = [];

    videoTracks.forEach((track) => {
      const onUnmute = () => {
        console.log(`[🎥 TILE] [HARDWARE_TRACK_HOTSWAP] Inbound video frames resumed for ${name}!`);
        setHasActiveVideo(true);
        triggerPlay();
      };
      const onMute = () => {
        console.log(`[🎥 TILE] [HARDWARE_TRACK_HOTSWAP] Video paused/muted for ${name}`);
      };
      const onEnded = () => {
        setHasActiveVideo(false);
      };

      track.addEventListener('unmute', onUnmute);
      track.addEventListener('mute', onMute);
      track.addEventListener('ended', onEnded);

      trackListeners.push({ track, onUnmute, onMute, onEnded });
    });

    return () => {
      stream.removeEventListener('addtrack', handleAddTrack);
      stream.removeEventListener('removetrack', handleRemoveTrack);
      trackListeners.forEach(({ track, onUnmute, onMute, onEnded }) => {
        track.removeEventListener('unmute', onUnmute);
        track.removeEventListener('mute', onMute);
        track.removeEventListener('ended', onEnded);
      });
    };
  }, [stream, isVideoOff, name, peerId, isLocal]);

  // Extract up to 2 initials for avatar
  const initials = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'U';

  // Video is visible ONLY when:
  // 1. Signaling indicates the user has video on (!isVideoOff)
  // 2. Stream has video track attached AND active
  const showVideo = !isVideoOff && Boolean(stream && stream.getVideoTracks().length > 0 && (isLocal || hasActiveVideo));

  return (
    <div
      className={`relative w-full h-full min-h-0 min-w-0 rounded-2xl sm:rounded-3xl overflow-hidden p-[1px] transition-all duration-300 backdrop-blur-2xl group ${
        isSpeaking
          ? 'bg-gradient-to-b from-cyan-400 via-emerald-400 to-transparent shadow-[0_0_30px_rgba(6,182,212,0.4)]'
          : 'bg-gradient-to-b from-white/20 via-white/5 to-transparent border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.5)]'
      }`}
    >
      <div className="relative w-full h-full rounded-[21px] sm:rounded-[23px] overflow-hidden bg-slate-950/60 backdrop-blur-2xl flex items-center justify-center">
        
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLocal ? 'transform -scale-x-100' : ''
          } ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Ambient Darkened Gradient Vignettes */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/30" />

        {/* Avatar Placeholder when Camera is Off */}
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 text-center">
            <div className="relative">
              <div
                className={`w-14 h-14 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center text-base sm:text-xl lg:text-2xl font-bold tracking-wider shadow-2xl transition-all duration-300 ${
                  isSpeaking
                    ? 'bg-gradient-to-tr from-cyan-500/30 to-emerald-500/30 text-cyan-300 border-2 border-cyan-400 scale-105'
                    : 'bg-white/[0.06] border border-white/15 text-slate-200'
                }`}
              >
                {initials}
              </div>
              {isSpeaking && (
                <div className="absolute -inset-1 rounded-2xl sm:rounded-3xl border border-cyan-400/50 animate-ping pointer-events-none" />
              )}
            </div>
          </div>
        )}

        {/* Top Floating Glass Bar */}
        <div className="absolute top-2 sm:top-2.5 inset-x-2 sm:inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1">
            {isHost && (
              <div className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold backdrop-blur-xl shadow-sm">
                <Crown className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-amber-400" />
                <span>Host</span>
              </div>
            )}
            {isCoHost && !isHost && (
              <div className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold backdrop-blur-xl shadow-sm">
                <Shield className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-cyan-400" />
                <span>Co-Host</span>
              </div>
            )}
            {!isHost && !isCoHost && (
              <div className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-slate-300 flex items-center gap-1 text-[9px] sm:text-[10px] font-medium backdrop-blur-xl shadow-sm">
                <User className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-slate-400" />
                <span>Participant</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Cam State Chip */}
            <div
              className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl border backdrop-blur-xl transition-all ${
                isVideoOff
                  ? 'bg-slate-900/80 border-white/10 text-slate-500'
                  : 'bg-black/50 border-cyan-400/30 text-cyan-400'
              }`}
              title={isVideoOff ? 'Camera Off' : 'Camera On'}
            >
              {isVideoOff ? (
                <VideoOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : (
                <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )}
            </div>

            {/* Mic State Chip */}
            <div
              className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl border backdrop-blur-xl transition-all ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-black/50 border-white/10 text-emerald-400'
              }`}
              title={isMuted ? 'Muted' : 'Microphone Active'}
            >
              {isMuted ? (
                <MicOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : (
                <span className="flex items-center gap-0.5 h-3 sm:h-3.5 px-0.5">
                  <span className="w-0.5 sm:w-1 bg-emerald-400 rounded-full h-1.5 sm:h-2 animate-pulse" />
                  <span className="w-0.5 sm:w-1 bg-cyan-400 rounded-full h-2.5 sm:h-3 animate-pulse delay-75" />
                  <span className="w-0.5 sm:w-1 bg-emerald-400 rounded-full h-1 sm:h-1.5 animate-pulse delay-150" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Single Source of Truth for Name Badge */}
        <div className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-2.5 z-10 pointer-events-none max-w-[80%]">
          <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-slate-100 shadow-md">
            <span
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
                isSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span className="truncate">
              {name} {isLocal && '(You)'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};