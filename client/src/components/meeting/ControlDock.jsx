/**
 * ============================================================================
 * FILE: client/src/components/meeting/ControlDock.jsx
 * PURPOSE: VisionOS Liquid Glass In-Call Control Pill Bar
 * 
 * CORE RESPONSIBILITIES:
 * 1. Bottom-docked floating pill with specular liquid glass styling.
 * 2. Primary hardware triggers: Mic Mute, Camera Toggle, Screen Presentation.
 * 3. Side drawer triggers: In-call Chat with badge, People list with badge.
 * 4. Host Admin quick-action: "Mute All" button for meeting organizer.
 * 5. Emoji Reaction popover launcher.
 * 6. Red specular glass "Leave Call" button.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Users,
  Smile,
  PhoneOff,
  VolumeX,
} from 'lucide-react';

export const ControlDock = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isHost,
  hasCamHardware,
  unreadCount = 0,
  participantCount = 1,
  activePanel, // 'chat' | 'people' | null
  toggleAudio,
  toggleVideo,
  toggleScreenShare,
  togglePanel,
  onSendReaction,
  onMuteAll,
  onLeaveCall,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['👍', '👏', '❤️', '🔥', '🎉', '😂'];

  const handleSelectEmoji = (emoji) => {
    if (onSendReaction) onSendReaction(emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="fixed bottom-3 sm:bottom-5 inset-x-0 z-40 flex items-center justify-center px-2 sm:px-4 pointer-events-none">
      
      {/* Container wraps pill & popover */}
      <div className="relative pointer-events-auto">
        
        {/* Floating Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-slate-950/90 backdrop-blur-3xl border border-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center gap-1 sm:gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelectEmoji(emoji)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-125 text-base sm:text-lg transition-all cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Optical Specular Border Frame */}
        <div className="p-[1px] rounded-3xl bg-gradient-to-b from-white/25 via-white/10 to-transparent border border-white/15 shadow-[0_15px_45px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
          
          {/* Inner Liquid Glass Pill */}
          <div className="bg-slate-950/80 backdrop-blur-2xl px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-[23px] flex items-center gap-1 sm:gap-2">
            
            {/* 1. Mic Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                isAudioMuted
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]'
              }`}
              title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isAudioMuted ? <MicOff className="w-4 sm:w-5 h-4 sm:h-5" /> : <Mic className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400" />}
            </button>

            {/* 2. Video Toggle */}
            <button
              type="button"
              onClick={toggleVideo}
              disabled={!hasCamHardware}
              className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 active:scale-95 ${
                !hasCamHardware
                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                  : isVideoOff
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 cursor-pointer'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12] cursor-pointer'
              }`}
              title={isVideoOff ? 'Start Video' : 'Stop Video'}
            >
              {isVideoOff || !hasCamHardware ? (
                <VideoOff className="w-4 sm:w-5 h-4 sm:h-5" />
              ) : (
                <Video className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" />
              )}
            </button>

            {/* 3. Screen Share Toggle */}
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                isScreenSharing
                  ? 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]'
              }`}
              title={isScreenSharing ? 'Stop Presenting' : 'Share Screen'}
            >
              {isScreenSharing ? (
                <MonitorOff className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-300" />
              ) : (
                <MonitorUp className="w-4 sm:w-5 h-4 sm:h-5" />
              )}
            </button>

            {/* 4. Host Mute All (Visible Only to Organizer) */}
            {isHost && (
              <button
                type="button"
                onClick={onMuteAll}
                className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all duration-200 cursor-pointer active:scale-95"
                title="Host Action: Mute All Participants"
              >
                <VolumeX className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            )}

            {/* Divider */}
            <div className="w-[1px] h-5 sm:h-6 bg-white/15 mx-0.5" />

            {/* 5. Emoji Reaction Launcher */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                showEmojiPicker
                  ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]'
              }`}
              title="Send Reaction"
            >
              <Smile className="w-4 sm:w-5 h-4 sm:h-5 text-amber-300" />
            </button>

            {/* 6. Chat Drawer Toggle */}
            <button
              type="button"
              onClick={() => togglePanel('chat')}
              className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                activePanel === 'chat'
                  ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]'
              }`}
              title="Chat"
            >
              <MessageSquare className="w-4 sm:w-5 h-4 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* 7. Participants Drawer Toggle */}
            <button
              type="button"
              onClick={() => togglePanel('people')}
              className={`relative p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                activePanel === 'people'
                  ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                  : 'bg-white/[0.07] border border-white/10 text-white hover:bg-white/[0.12]'
              }`}
              title="Participants"
            >
              <Users className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="absolute -top-1 -right-1 px-1 h-3.5 sm:h-4 rounded-full bg-slate-800 border border-white/20 text-slate-200 font-mono text-[9px] flex items-center justify-center">
                {participantCount}
              </span>
            </button>

            {/* Divider */}
            <div className="w-[1px] h-5 sm:h-6 bg-white/15 mx-0.5" />

            {/* 8. Leave Call Button */}
            <button
              type="button"
              onClick={onLeaveCall}
              className="p-2.5 sm:p-3 px-3 sm:px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-95 text-white font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(244,63,94,0.35)] cursor-pointer active:scale-95"
              title="Leave Call"
            >
              <PhoneOff className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="hidden md:inline text-xs">Leave</span>
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};