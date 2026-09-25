/**
 * ============================================================================
 * FILE: client/src/components/common/ToastNotification.jsx
 * PURPOSE: Glassmorphic Floating Notification System (VisionOS style)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Renders non-intrusive alerts at the top-right of the screen.
 * 2. Visual feedback for joins, leaves, host changes, and waiting room events.
 * ============================================================================
 */

import React from 'react';
import { useRoom } from '../../context/RoomContext';
import { Info, CheckCircle2, AlertTriangle, XCircle, Crown, MicOff } from 'lucide-react';

export const ToastNotification = () => {
  const { toasts } = useRoom();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-4 sm:top-6 inset-x-4 sm:inset-x-auto sm:right-6 z-50 flex flex-col gap-2.5 pointer-events-none sm:max-w-sm w-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="relative p-[1px] rounded-2xl bg-gradient-to-b from-white/20 via-white/5 to-transparent border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-3"
        >
          {/* Inner Liquid Glass Shell */}
          <div className="bg-slate-950/70 backdrop-blur-xl px-4 py-3 rounded-[15px] flex items-center gap-3">
            {/* Context-Aware Glowing Icons */}
            {toast.type === 'success' && (
              <div className="p-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'warning' && (
              <div className="p-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'error' && (
              <div className="p-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'host' && (
              <div className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                <Crown className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'mute' && (
              <div className="p-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <MicOff className="w-4 h-4" />
              </div>
            )}
            {(!toast.type || toast.type === 'info') && (
              <div className="p-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                <Info className="w-4 h-4" />
              </div>
            )}

            {/* Message Body */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug break-words">
                {toast.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};