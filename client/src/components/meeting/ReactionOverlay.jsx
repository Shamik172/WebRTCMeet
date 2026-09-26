/**
 * ============================================================================
 * FILE: client/src/components/meeting/ReactionOverlay.jsx
 * PURPOSE: Animated Floating Emojis Layer
 * 
 * CORE RESPONSIBILITIES:
 * 1. Listens to receive-reaction events relayed by the signaling server.
 * 2. Spawns floating emoji particles that drift upward with dynamic horizontal offsets.
 * 3. Automatically unmounts expired particles after animation completes.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useRoom } from '../../context/RoomContext';

export const ReactionOverlay = () => {
  const { socket } = useRoom();
  const [activeReactions, setActiveReactions] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleReaction = ({ emoji, senderSocketId }) => {
      const id = Date.now() + Math.random();
      const left = Math.floor(20 + Math.random() * 60); // Random horizon spread (20% - 80%)

      setActiveReactions((prev) => [...prev, { id, emoji, left }]);

      // Remove after floating animation finishes (2.5s)
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    };

    socket.on('receive-reaction', handleReaction);
    return () => socket.off('receive-reaction', handleReaction);
  }, [socket]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {activeReactions.map((r) => (
        <span
          key={r.id}
          style={{ left: `${r.left}%` }}
          className="absolute bottom-16 text-3xl sm:text-4xl animate-[floatUp_2.5s_ease-out_forwards]"
        >
          {r.emoji}
        </span>
      ))}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translateY(-20px) scale(1.2);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-380px) scale(1.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};