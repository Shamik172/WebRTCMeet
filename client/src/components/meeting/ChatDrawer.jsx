/**
 * ============================================================================
 * FILE: client/src/components/meeting/ChatDrawer.jsx
 * PURPOSE: VisionOS Glassmorphic In-Call Messaging Drawer
 * 
 * CORE RESPONSIBILITIES:
 * 1. Displays chat history with sender identification and message timestamps.
 * 2. Distinguishes local outgoing bubbles from incoming peer messages.
 * 3. Provides auto-scrolling to keep newest messages visible without shifting parent view.
 * 4. Dispatches text messages via Socket.io using RoomContext.
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Sparkles } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

export const ChatDrawer = ({ isOpen, onClose }) => {
  const { messages = [], sendMessage, currentUser } = useRoom();
  const [text, setText] = useState('');
  const messagesContainerRef = useRef(null);
  const drawerRef = useRef(null);

  // Smoothly scroll message container internally (NEVER shifts the window or drawer header)
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Click & Touch outside listener to dismiss the drawer cleanly on desktop and mobile
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        const isDockClick = e.target.closest('button[title="Chat"]');
        if (!isDockClick) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none">
      {/* 1. Backdrop: Click outside anywhere on mobile or desktop to dismiss */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md sm:bg-black/30 sm:backdrop-blur-sm pointer-events-auto transition-all duration-300 ease-out" 
      />

      {/* 2. Drawer Card: Strictly bounded to viewport height */}
      <aside 
        ref={drawerRef}
        className="absolute top-2 sm:top-3 right-2 sm:right-3 bottom-20 sm:bottom-24 w-[calc(100vw-16px)] sm:w-92 md:w-96 max-h-[calc(100dvh-92px)] sm:max-h-[calc(100dvh-108px)] animate-in slide-in-from-right-6 fade-in duration-300 ease-out pointer-events-auto flex flex-col"
      >
        {/* Specular Optical Rim Container */}
        <div className="relative h-full w-full rounded-3xl p-[1px] bg-gradient-to-b from-white/30 via-white/10 to-white/5 border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-3xl overflow-hidden flex flex-col">
          
          {/* Ambient Inner Glows */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/15 blur-[65px] pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-[65px] pointer-events-none" />

          {/* Inner Liquid Glass Shell */}
          <div className="relative z-10 h-full flex flex-col bg-slate-950/80 backdrop-blur-2xl rounded-[23px] p-3.5 sm:p-4 overflow-hidden">
            
            {/* Drawer Header (Strictly pinned at top with shrink-0) */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 tracking-tight">
                    In-Call Messages
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wide">Encrypted DataChannel</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/5 hover:border-white/20 transition-all cursor-pointer active:scale-95 shadow-sm"
                title="Close Panel (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Feed Canvas: min-h-0 prevents flexbox from pushing the header out */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3 pr-1 text-xs scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent select-text"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-4 space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 shadow-inner">
                    <Sparkles className="w-5 h-5 stroke-[1.5] text-cyan-400 animate-pulse" />
                  </div>
                  <p className="font-semibold text-slate-300 text-xs">No messages yet</p>
                  <p className="text-[11px] text-slate-500 max-w-[210px] leading-relaxed">
                    Start the conversation! Notes are visible to everyone in this session.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderName === currentUser?.name;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 animate-in fade-in slide-in-from-bottom-1.5 duration-200`}
                    >
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-[10px] font-semibold text-slate-300">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                        {msg.time && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            {msg.time}
                          </span>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] px-3.5 py-2 rounded-2xl break-words leading-relaxed text-xs shadow-md ${
                          isMe
                            ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 font-semibold rounded-tr-none shadow-[0_4px_16px_rgba(6,182,212,0.25)]'
                            : 'bg-white/[0.05] border border-white/[0.1] text-slate-100 rounded-tl-none backdrop-blur-md hover:bg-white/[0.08] transition-colors'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Text Input Footer: shrink-0 keeps it firmly pinned at the bottom */}
            <form
              onSubmit={handleSend}
              className="pt-2.5 border-t border-white/[0.08] flex items-center gap-2 shrink-0 select-auto"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/20 transition-all font-sans shadow-inner"
                />
              </div>
              
              <button
                type="submit"
                disabled={!text.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-bold hover:brightness-105 active:scale-95 transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0"
                title="Send Message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>
        </div>
      </aside>
    </div>
  );
};