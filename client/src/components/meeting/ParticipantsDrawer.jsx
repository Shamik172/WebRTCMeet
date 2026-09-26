/**
 * ============================================================================
 * FILE: client/src/components/meeting/ParticipantsDrawer.jsx
 * PURPOSE: Glassmorphic Roster with Roles, Device Status, and In-Call Admissions
 * 
 * CORE RESPONSIBILITIES:
 * 1. Groups participants into distinct categories: Organizers (Host/Co-Host) and Attendees.
 * 2. Displays live waiting room queue with one-click Admit and Decline actions.
 * 3. Provides Host/Co-Host quick-action button: Mute All.
 * 4. Displays real-time mic mute and camera toggle status indicators.
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import { X, Users, Crown, Shield, User, Mic, MicOff, Video, VideoOff, Check, VolumeX } from 'lucide-react';
import { useRoom } from '../../context/RoomContext';

export const ParticipantsDrawer = ({ isOpen, onClose, peers = [] }) => {
    const {
        currentUser,
        isHost,
        isCoHost,
        participants = [],
        waitingUsers = [],
        approveUser,
        rejectUser,
        muteAll,
    } = useRoom();

    const drawerRef = useRef(null);

    // Close on outside click or Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDownOutside = (e) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target)) {
                const isDockClick = e.target.closest('button[title="Participants"]');
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

    // Compile local user and remote peers into a unified roster
    const allUsers = [
        {
            name: `${currentUser?.name || 'You'} (You)`,
            isHost,
            isCoHost,
            isLocal: true,
            isMuted: false,
            isVideoOff: false,
        },
        ...peers.map((peer) => {
            const meta = participants.find((p) => (p.socketId || p.id || p.peerId) === peer.peerId);
            return {
                name: peer.name || meta?.name || 'Participant',
                isHost: Boolean(peer.isHost || meta?.isHost),
                isCoHost: Boolean(peer.isCoHost || meta?.isCoHost),
                isMuted: peer.isAudioMuted ?? meta?.isMuted ?? false,
                isVideoOff: peer.isVideoOff ?? meta?.isVideoOff ?? false,
                socketId: peer.peerId,
            };
        }),
    ];

    // Separate organizers (Host & Co-Hosts) from attendees
    const organizers = allUsers.filter((u) => u.isHost || u.isCoHost);
    const regularAttendees = allUsers.filter((u) => !u.isHost && !u.isCoHost);
    const canManage = isHost || isCoHost;

    return (
        <div className="fixed inset-0 z-50 pointer-events-none select-none">
            {/* 1. Backdrop */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md sm:bg-black/30 sm:backdrop-blur-sm pointer-events-auto transition-all duration-300 ease-out"
            />

            {/* 2. Drawer Card */}
            <aside
                ref={drawerRef}
                className="absolute top-2 sm:top-3 right-2 sm:right-3 bottom-20 sm:bottom-24 w-[calc(100vw-16px)] sm:w-92 md:w-96 max-h-[calc(100dvh-92px)] sm:max-h-[calc(100dvh-108px)] animate-in slide-in-from-right-6 fade-in duration-300 ease-out pointer-events-auto flex flex-col"
            >
                <div className="relative h-full w-full rounded-3xl p-[1px] bg-gradient-to-b from-white/30 via-white/10 to-white/5 border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-3xl overflow-hidden flex flex-col">

                    {/* Ambient Glow Orbs */}
                    <div className="absolute -top-14 -right-14 w-44 h-44 rounded-full bg-cyan-500/15 blur-[65px] pointer-events-none" />
                    <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full bg-teal-500/10 blur-[65px] pointer-events-none" />

                    {/* Inner Liquid Glass Shell */}
                    <div className="relative z-10 h-full flex flex-col bg-slate-950/80 backdrop-blur-2xl rounded-[23px] p-3.5 sm:p-4 overflow-hidden">

                        {/* Header: Title & Close Button */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center">
                                    <Users className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-100 tracking-tight flex items-center gap-2">
                                        Participants
                                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/25 shadow-sm">
                                            {allUsers.length}
                                        </span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-wide">In-Call Roster</p>
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

                        {/* Quick Admin Action: Mute All Bar (Visible to Host & Co-Hosts) */}
                        {canManage && allUsers.length > 1 && (
                            <div className="pt-2.5 pb-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={muteAll}
                                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 hover:from-amber-500/25 hover:to-orange-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                                >
                                    <VolumeX className="w-3.5 h-3.5" />
                                    <span>Mute All Participants</span>
                                </button>
                            </div>
                        )}

                        {/* Waiting Room Admission Queue (Admins only) */}
                        {canManage && waitingUsers.length > 0 && (
                            <div className="my-2.5 p-3 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 space-y-2.5 shrink-0 animate-in fade-in duration-200 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                        </span>
                                        Waiting Room ({waitingUsers.length})
                                    </span>
                                    <span className="text-[9px] text-amber-300/80 font-mono tracking-wider uppercase">Admission</span>
                                </div>

                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
                                    {waitingUsers.map((u) => (
                                        <div
                                            key={u.socketId || u.id}
                                            className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-white/5 gap-2 backdrop-blur-sm hover:border-white/10 transition-colors"
                                        >
                                            <span className="text-xs font-medium text-slate-200 truncate pl-1">{u.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {/* Admit Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => approveUser(u.socketId || u.id)}
                                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                                                    title="Admit to meeting"
                                                >
                                                    <Check className="w-3 h-3 stroke-[2.5]" /> Admit
                                                </button>
                                                {/* Decline Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => rejectUser(u.socketId || u.id)}
                                                    className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition-all cursor-pointer active:scale-95 shadow-sm"
                                                    title="Decline request"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Categorized Participants List */}
                        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">

                            {/* Section 1: Organizers (Host & Co-Hosts) */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 font-bold flex items-center gap-1.5">
                                    Organizers <span className="text-slate-500 font-normal">({organizers.length})</span>
                                </span>
                                {organizers.map((u, i) => (
                                    <UserRow key={`org-${i}`} user={u} />
                                ))}
                            </div>

                            {/* Section 2: Regular Attendees */}
                            {regularAttendees.length > 0 && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 font-bold flex items-center gap-1.5">
                                        Attendees <span className="text-slate-500 font-normal">({regularAttendees.length})</span>
                                    </span>
                                    {regularAttendees.map((u, i) => (
                                        <UserRow key={`att-${i}`} user={u} />
                                    ))}
                                </div>
                            )}

                        </div>

                        {/* Footer Metadata */}
                        <div className="pt-2.5 mt-1 border-t border-white/[0.08] flex items-center justify-between text-[10px] text-slate-500 font-mono tracking-wider shrink-0">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                                P2P Mesh Encrypted
                            </span>
                            <span>MeetSphere Core</span>
                        </div>

                    </div>
                </div>
            </aside>
        </div>
    );
};

// Reusable Participant Row Component
const UserRow = ({ user }) => (
    <div className="group flex items-center justify-between p-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.08] transition-all duration-200">
        <div className="flex items-center gap-2.5 truncate min-w-0">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-teal-500/10 to-indigo-500/20 border border-white/15 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                {user.name[0]?.toUpperCase() || 'U'}
                {!user.isMuted && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-slate-950" />
                )}
            </div>

            <div className="flex flex-col truncate">
                <span className="text-xs font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                    {user.name}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    {user.isHost ? (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Host
                        </span>
                    ) : user.isCoHost ? (
                        <span className="text-cyan-400 font-medium flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Co-Host
                        </span>
                    ) : (<span className="text-slate-400 flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-slate-500" /> Participant
                    </span>)}
                </span>
            </div>
        </div>

        {/* Real-Time Hardware Status Chips */}
        <div className="flex items-center gap-1.5 shrink-0">
            <div
                className={`p-1.5 rounded-lg border transition-all ${user.isMuted
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                    }`}
                title={user.isMuted ? 'Muted' : 'Microphone Active'}
            >
                {user.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
            </div>

            <div
                className={`p-1.5 rounded-lg border transition-all ${user.isVideoOff
                        ? 'bg-slate-800/80 text-slate-500 border-white/5'
                        : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                    }`}
                title={user.isVideoOff ? 'Camera Off' : 'Camera Active'}
            >
                {user.isVideoOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
            </div>
        </div>
    </div>
);