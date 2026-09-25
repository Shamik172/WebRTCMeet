/**
 * ============================================================================
 * FILE: client/src/App.jsx
 * PURPOSE: Root Application Container, Dynamic URL Sync, and View Routing
 * 
 * CORE RESPONSIBILITIES:
 * 1. Synchronizes active room ID with the browser address bar (?room=xxx).
 * 2. Pre-fills room code if opened via invite link.
 * 3. Switches between LobbyPage and MeetingPage seamlessly.
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { useMediaStream } from './hooks/useMediaStream';
import { LobbyPage } from './pages/LobbyPage';
import { ToastNotification } from './components/common/ToastNotification';

const AppContent = () => {
  const mediaStreamState = useMediaStream();
  const { roomId, participants, forceMuteTrigger } = useRoom();

  // 1. Listen for host force-mute event
  useEffect(() => {
    if (forceMuteTrigger > 0) {
      mediaStreamState.forceMuteAudio();
    }
  }, [forceMuteTrigger]);

  // 2. Sync URL bar with active meeting room ID
  useEffect(() => {
    if (roomId && participants.length > 0) {
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      // Revert URL when returning to lobby
      window.history.pushState({}, '', window.location.pathname);
    }
  }, [roomId, participants.length]);

  // Determine view state: admitted to meeting vs staging lobby
  const inCall = Boolean(roomId && participants.length > 0);

  return (
    <>
      <ToastNotification />
      {!inCall ? (
        <LobbyPage mediaStreamState={mediaStreamState} />
      ) : (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Connected to: {roomId}</h1>
            <p className="text-slate-400">Ready to build Page 2 Meeting Grid!</p>
          </div>
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
}