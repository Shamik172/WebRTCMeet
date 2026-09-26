/**
 * ============================================================================
 * FILE: client/src/App.jsx
 * PURPOSE: Root Application Container, Dynamic URL Sync, and View Routing
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { useMediaStream } from './hooks/useMediaStream';
import { LobbyPage } from './pages/LobbyPage';
import { MeetingPage } from './pages/MeetingPage';
import { ToastNotification } from './components/common/ToastNotification';

const AppContent = () => {
  const mediaStreamState = useMediaStream();
  const { roomId, isWaitingApproval, forceMuteTrigger } = useRoom();

  // 1. Handle remote force mute
  useEffect(() => {
    if (forceMuteTrigger > 0) {
      mediaStreamState.forceMuteAudio();
    }
  }, [forceMuteTrigger]);

  // 2. Sync URL bar when actively inside a room
  useEffect(() => {
    if (roomId && !isWaitingApproval) {
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, [roomId, isWaitingApproval]);

  // In-Call is true ONLY when admitted into the room and NOT waiting in approval queue
  const inCall = Boolean(roomId && !isWaitingApproval);

  return (
    <>
      <ToastNotification />
      {!inCall ? (
        <LobbyPage mediaStreamState={mediaStreamState} />
      ) : (
        <MeetingPage mediaStreamState={mediaStreamState} />
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