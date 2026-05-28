"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { createClient } from "@/lib/supabase/client";

interface PrivateRoomProps {
  roomCode: string;
  playerElo?: number;
  onDisconnect?: () => void;
  onRematch?: () => void;
}

export function usePrivateRoom({ roomCode, playerElo = 1200, onDisconnect, onRematch }: PrivateRoomProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isDataConnected, setIsDataConnected] = useState(false);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematchState, setRematchState] = useState<'idle' | 'requested_by_me' | 'requested_by_opponent'>('idle');

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supabase = createClient();

  const sendTelemetry = useCallback((type: string, payload: any) => {
    if (dataConnRef.current?.open) dataConnRef.current.send({ type, ...payload });
  }, []);

  const requestRematch = useCallback(() => {
    sendTelemetry("REMATCH_REQUEST", {});
    setRematchState('requested_by_me');
  }, [sendTelemetry]);

  const acceptRematch = useCallback(() => {
    sendTelemetry("REMATCH_ACCEPT", {});
    setRematchState('idle');
    if (onRematch) onRematch();
  }, [sendTelemetry, onRematch]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;
    conn.on("open", () => setIsDataConnected(true));
    conn.on("data", (data: any) => {
      if (!data || !data.type) return;
      if (data.type === "PROFILE_SYNC") setRemoteProfile(data.profile);
      if (data.type === "LIVE_SCORE") setLiveOpponentScore(data.score);
      if (data.type === "FINAL_SCORE") setOpponentScore(data.score);
      
      if (data.type === "REMATCH_REQUEST") {
        setRematchState('requested_by_opponent');
      }
      if (data.type === "REMATCH_ACCEPT") {
        setRematchState('idle');
        if (onRematch) onRematch();
      }
    });
  }, [onRematch]);

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;

    const init = async () => {
      try {
        // 1. Get camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { 
    width: { ideal: 320 }, 
    height: { ideal: 240 }, 
    frameRate: { ideal: 15 } 
  }, 
  audio: false 
});
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        setLocalStream(stream);
        streamRef.current = stream;

        // 2. Create PeerJS peer
        const uniqueId = "priv_" + Math.random().toString(36).substr(2, 9);

        const rtcConfig = {
          iceServers: [
            // 1. Google's Free STUN (Handles 80% of normal connections)
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
              ]
            },
            // 2. Metered.ca TURN (Fallback for strict firewalls/Symmetric NATs)
            ...(process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USERNAME && process.env.NEXT_PUBLIC_TURN_CREDENTIAL 
              ? [{
                  urls: process.env.NEXT_PUBLIC_TURN_URL,
                  username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                  credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
                }] 
              : [])
          ],
          iceCandidatePoolSize: 10, // Speeds up the connection process
        };

        const peer = new Peer(uniqueId, {
          config: rtcConfig
        });
        peerRef.current = peer;

        peer.on("open", async () => {
          if (!isMounted) return;

          // 3. Register in the private_room table
          const { error: insertError } = await supabase
            .from("private_rooms")
            .insert([{ room_code: roomCode.toUpperCase(), peer_id: peer.id, elo: playerElo }]);

          if (insertError) {
            console.error("Room insert error:", insertError);
          }

          // 4. Check if opponent is already waiting
          const { data: existing } = await supabase
            .from("private_rooms")
            .select("*")
            .eq("room_code", roomCode.toUpperCase())
            .neq("peer_id", peer.id)
            .limit(1);

          if (existing && existing.length > 0) {
            // We are player 2. Dial player 1.
            console.log("Opponent found. Initiating call...");
            const opponentPeerId = existing[0].peer_id;
            connectToPeer(peer, stream, opponentPeerId);
          } else {
            // We are player 1. Wait for player 2 to dial us.
            console.log("First in room. Waiting for incoming call...");
          }
        });

        // Handle incoming call (if opponent calls us first)
        peer.on("call", (call) => {
          call.answer(stream);
          callRef.current = call;
          call.on("stream", (remoteMedia) => {
            if (isMounted) {
              setRemoteStream(remoteMedia);
              setIsConnected(true);
              setIsWaiting(false);
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }
          });
        });

        peer.on("connection", setupDataConnection);

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (isMounted) setError("Connection error. Please try again.");
        });

      } catch (e: any) {
        console.error("Private Room Init Error:", e);
        if (isMounted) setError(e.message || "Failed to access camera.");
      }
    };

    const connectToPeer = (peer: Peer, stream: MediaStream, opponentPeerId: string) => {
      const call = peer.call(opponentPeerId, stream);
      callRef.current = call;
      call.on("stream", (remoteMedia) => {
        if (isMounted) {
          setRemoteStream(remoteMedia);
          setIsConnected(true);
          setIsWaiting(false);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }
      });

      const conn = peer.connect(opponentPeerId);
      setupDataConnection(conn);
    };

    init();

    // CLEANUP
    return () => {
      isMounted = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (peerRef.current) {
        const id = peerRef.current.id;
        if (id) {
          supabase.from("private_rooms").delete().eq("peer_id", id).then();
        }
        peerRef.current.destroy();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, playerElo]); 

  return {
    localStream,
    remoteStream,
    isSearching: isWaiting,
    isConnected,
    isDataConnected,
    opponentScore,
    liveOpponentScore,
    remoteProfile,
    sendTelemetry,
    rematchState,
    requestRematch,
    acceptRematch,
    error,
    skip: () => window.location.reload()
  };
}