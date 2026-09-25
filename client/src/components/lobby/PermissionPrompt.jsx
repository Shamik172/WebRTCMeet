/**
 * ============================================================================
 * FILE: client/src/components/lobby/PermissionPrompt.jsx
 * PURPOSE: Interactive Multi-Step Device Permission Modal (VisionOS Glass style)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Independent control: Allows enabling mic and camera individually or together.
 * 2. Hardware state feedback: Shows checkmarks when allowed and disables if hardware absent.
 * 3. Non-blocking: Allows user to skip directly to lobby in listen-only/viewer mode.
 * ============================================================================
 */

import React from 'react';
import { Mic, Video, ShieldCheck, AlertCircle, Check, ArrowRight, Sparkles, Sliders } from 'lucide-react';
import { MeshNetworkCanvas } from './MeshNetworkCanvas';

export const PermissionPrompt = ({
  audioAllowed,
  videoAllowed,
  hasCamHardware,
  onRequestAudio,
  onRequestVideo,
  onGrantBoth,
  onProceed,
  error,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-300">
      
      {/* Background Interactive Mesh Canvas Preview Behind Modal */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <MeshNetworkCanvas architecture="mesh" />
      </div>

      {/* Optical Specular Border Container */}
      <div className="relative p-[1px] rounded-[32px] bg-gradient-to-b from-cyan-400/40 via-white/10 to-transparent border border-white/20 max-w-sm sm:max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        
        {/* Liquid Glass Core Body */}
        <div className="relative bg-slate-950/45 backdrop-blur-2xl rounded-[31px] p-6 sm:p-8 text-center space-y-6 overflow-hidden">
          
          {/* Subtle Top Specular Rim */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

          {/* Glowing Shield / Hardware Sensor Badge */}
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-teal-500/10 to-emerald-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.25)]">
            <ShieldCheck className="w-8 h-8 stroke-[1.75]" />
            <div className="absolute -inset-1 rounded-2xl border border-cyan-400/30 animate-pulse pointer-events-none" />
          </div>

          {/* Header Text */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-[11px] font-semibold tracking-wide">
              <Sparkles className="w-3 h-3" />
              <span>Sensor Check</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Camera & Microphone
            </h2>
            <p className="text-slate-300/80 text-xs md:text-sm leading-relaxed">
              Choose what you'd like to share before stepping into the room.
            </p>
          </div>

          {/* Granular Device Cards */}
          <div className="space-y-3 text-left">
            {/* Microphone Row */}
            <div className="backdrop-blur-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Microphone</p>
                  <p className="text-[11px] text-slate-400">Speak during the meet</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRequestAudio}
                disabled={audioAllowed}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  audioAllowed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                    : 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold active:scale-95 shadow-md shadow-cyan-500/25'
                }`}
              >
                {audioAllowed ? (
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Allowed</span>
                ) : (
                  'Enable Mic'
                )}
              </button>
            </div>

            {/* Camera Row */}
            <div className="backdrop-blur-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Camera</p>
                  <p className="text-[11px] text-slate-400">
                    {!hasCamHardware ? 'Hardware not detected' : 'Broadcast video feed'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRequestVideo}
                disabled={videoAllowed || !hasCamHardware}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  videoAllowed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                    : !hasCamHardware
                    ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800'
                    : 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:opacity-95 text-slate-950 font-bold active:scale-95 shadow-md shadow-cyan-500/25'
                }`}
              >
                {videoAllowed ? (
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Allowed</span>
                ) : !hasCamHardware ? (
                  'Unavailable'
                ) : (
                  'Enable Cam'
                )}
              </button>
            </div>
          </div>

          {/* Error / Alert Display */}
          {error && (
            <div className="backdrop-blur-md bg-amber-500/15 border border-amber-500/30 text-amber-200 p-3 rounded-2xl flex items-center gap-2.5 text-xs text-left animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-300" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {(!audioAllowed || !videoAllowed) && hasCamHardware && (
              <button
                type="button"
                onClick={onGrantBoth}
                className="group relative w-full py-3.5 px-4 rounded-2xl overflow-hidden font-bold text-sm transition-all shadow-[0_0_30px_rgba(6,182,212,0.35)] active:scale-[0.98] cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95" />
                <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
                <span className="relative z-10 text-slate-950">Allow Both (Camera & Mic)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onProceed}
              className="w-full py-3 px-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.98] text-slate-200 hover:text-white font-medium text-xs transition-all border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer backdrop-blur-md"
            >
              {audioAllowed || videoAllowed ? (
                <>Continue to Lobby <ArrowRight className="w-3.5 h-3.5" /></>
              ) : (
                'Enter without devices (Viewer Mode)'
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};