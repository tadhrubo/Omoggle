"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { createClient } from "@/lib/supabase/client";

interface PrivateRoomProps {
  roomCode: string;
  playerElo?: number;
  onDisconnect?: () => void;
}

export function usePrivateRoom({ roomCode, playerElo = 1200, onDisconnect }: PrivateRoomProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supabase = createClient();

  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;
    conn.on("data", (data: any) => {
      if (!data || !data.type) return;
      if (data.type === "PROFILE_SYNC") setRemoteProfile(data.profile);
      if (data.type === "LIVE_SCORE") setLiveOpponentScore(data.score);
      if (data.type === "FINAL_SCORE") setOpponentScore(data.score);
    });
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;

    const init = async () => {
      try {
        // 1. Get camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        setLocalStream(stream);
        streamRef.current = stream;

        // 2. Create PeerJS peer
        const uniqueId = "priv_" + Math.random().toString(36).substr(2, 9);
        const peer = new Peer(uniqueId);
        peerRef.current = peer;

        peer.on("open", async () => {
          if (!isMounted) return;

          // 3. Register in the private_rooms table
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
            // Opponent is already there — initiate the call
            const opponentPeerId = existing[0].peer_id;
            connectToPeer(peer, stream, opponentPeerId);
          } else {
            // 5. Wait for opponent via Realtime subscription
            const channel = supabase
              .channel(`private_room_${roomCode.toUpperCase()}`)
              .on(
                "postgres_changes",
                {
                  event: "INSERT",
                  schema: "public",
                  table: "private_rooms",
                  filter: `room_code=eq.${roomCode.toUpperCase()}`
                },
                (payload: any) => {
                  if (payload.new.peer_id !== peer.id && isMounted) {
                    connectToPeer(peer, stream, payload.new.peer_id);
                    supabase.removeChannel(channel);
                  }
                }
              )
              .subscribe();
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
  }, [roomCode, setupDataConnection, playerElo]);

  const sendTelemetry = (type: string, payload: any) => {
    if (dataConnRef.current?.open) dataConnRef.current.send({ type, ...payload });
  };

  return {
    localStream,
    remoteStream,
    isSearching: isWaiting,
    isConnected,
    opponentScore,
    liveOpponentScore,
    remoteProfile,
    sendTelemetry,
    error,
    skip: () => window.location.reload()
  };
}
