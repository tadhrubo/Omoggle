"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { createClient } from "@/lib/supabase";

export interface Profile {
  name: string;
  elo: number;
  tier: string;
}

export function useMatchmaker({ onDisconnect }: { onDisconnect?: () => void } = {}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const supabase = createClient();

  const handleCallClose = useCallback(() => {
    setRemoteStream(null);
    setIsConnected(false);
    setOpponentScore(null);
    setLiveOpponentScore(null);
    setRemoteProfile(null);
    setIsSearching(true);
    if (onDisconnect) onDisconnect();
    if (peerRef.current && localStream) {
      findMatchInternal(peerRef.current, localStream);
    }
  }, [localStream, onDisconnect]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;
    conn.on("data", (data: any) => {
      if (!data || !data.type) return;

      if (data.type === "PROFILE_SYNC") {
        setRemoteProfile(data.profile);
      } else if (data.type === "LIVE_SCORE") {
        setLiveOpponentScore(data.score);
      } else if (data.type === "FINAL_SCORE") {
        setOpponentScore(data.score);
        setLiveOpponentScore(null);
      }
    });
  }, []);

  const sendTelemetry = useCallback((type: string, payload: any) => {
    if (dataConnRef.current?.open) {
      dataConnRef.current.send({ type, ...payload });
    }
  }, []);

  const findMatchInternal = useCallback(async (peer: Peer, stream: MediaStream) => {
    setIsSearching(true);

    // Clean old entries
    await supabase.from("arena_queue").delete().eq("peer_id", peer.id);

    // Look for opponent
    const { data } = await supabase.from("arena_queue").select("*").neq("peer_id", peer.id).limit(1);

    if (data && data.length > 0) {
      const opponentId = data[0].peer_id;
      await supabase.from("arena_queue").delete().eq("peer_id", opponentId);

      const call = peer.call(opponentId, stream);
      callRef.current = call;

      const ghostTimeout = setTimeout(() => {
        console.warn("Ghost detected. Retrying...");
        call.close();
        findMatchInternal(peer, stream);
      }, 3000);

      call.on("stream", (remoteMedia) => {
        clearTimeout(ghostTimeout);
        setRemoteStream(remoteMedia);
        setIsConnected(true);
        setIsSearching(false);
      });
      call.on("close", handleCallClose);

      const conn = peer.connect(opponentId);
      setupDataConnection(conn);
    } else {
      await supabase.from("arena_queue").insert([{ peer_id: peer.id }]);
    }
  }, [handleCallClose, setupDataConnection, supabase]);

  useEffect(() => {
    let isMounted = true;
    let activeStream: MediaStream | null = null;
    let newPeer: Peer | null = null;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        activeStream = stream;
        setLocalStream(stream);

        newPeer = new Peer({
          host: "localhost",
          port: 9000,
          path: "/",
          secure: false,
          debug: 2
        });

        newPeer.on("open", (id) => {
          if (!isMounted) return;
          setPeerId(id);
          peerRef.current = newPeer;
          findMatchInternal(newPeer, stream);
        });

        newPeer.on("call", (call) => {
          call.answer(stream);
          callRef.current = call;
          call.on("stream", (remoteMedia) => {
            setRemoteStream(remoteMedia);
            setIsConnected(true);
            setIsSearching(false);
          });
          call.on("close", handleCallClose);
        });

        newPeer.on("connection", (conn) => {
          setupDataConnection(conn);
        });

      } catch (e) {
        console.error("Initialization failed:", e);
      }
    };

    init();

    return () => {
      isMounted = false;
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
      if (newPeer) {
        if (newPeer.id) supabase.from("arena_queue").delete().eq("peer_id", newPeer.id);
        newPeer.destroy();
      }
    };
  }, []);

  const skip = async () => {
    if (callRef.current) callRef.current.close();
    else if (peerRef.current && localStream) findMatchInternal(peerRef.current, localStream);
  };

  return {
    localStream,
    remoteStream,
    isSearching,
    isConnected,
    peerId,
    opponentScore,
    liveOpponentScore,
    remoteProfile,
    skip,
    hangUp: skip,
    sendTelemetry,
    sendScore: (score: number) => sendTelemetry("FINAL_SCORE", { score })
  };
}