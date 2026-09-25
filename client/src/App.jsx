/**
 * ============================================================================
 * FILE: client/src/App.jsx
 * PURPOSE: Root Application Container & Navigation Shell
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

  // Listen for host force-mute event
  useEffect(() => {
    if (forceMuteTrigger > 0) {
      mediaStreamState.forceMuteAudio();
    }
  }, [forceMuteTrigger]);

  const inCall = roomId && participants.length > 0;

  return (
    <>
      <ToastNotification />
      {!inCall ? (
        <LobbyPage mediaStreamState={mediaStreamState} />
      ) : (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">In Meeting: {roomId}</h1>
            <p className="text-slate-400">Ready to build MeetingPage grid next!</p>
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