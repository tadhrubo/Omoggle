"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { createClient } from "@/lib/supabase/client";

interface MatchmakerProps {
  mode?: "casual" | "ranked";
  playerElo?: number;
  onDisconnect?: () => void;
}

export function useMatchmaker({ mode = "casual", playerElo = 1200, onDisconnect }: MatchmakerProps = {}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<any>(null);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const searchRadius = useRef<number>(50); 
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // NEW: Keep a hard reference to the camera stream to kill it on unmount
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

  const pollForRankedMatch = async (peer: Peer, stream: MediaStream) => {
    if (!peer.id) return;

    const minElo = playerElo - searchRadius.current;
    const maxElo = playerElo + searchRadius.current;

    const { data } = await supabase
      .from("ranked_queue")
      .select("*")
      .neq("peer_id", peer.id)
      .gte("elo", minElo)
      .lte("elo", maxElo)
      .order("joined_at", { ascending: true }) 
      .limit(1);

    if (data && data.length > 0) {
      const opponentId = data[0].peer_id;
      
      const { error } = await supabase.from("ranked_queue").delete().eq("peer_id", opponentId);
      if (error) return; 

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      await supabase.from("ranked_queue").delete().eq("peer_id", peer.id);

      const call = peer.call(opponentId, stream);
      callRef.current = call;
      call.on("stream", (remoteMedia) => {
        setRemoteStream(remoteMedia);
        setIsConnected(true);
        setIsSearching(false);
        // Haptic feedback on connection
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      });

      const conn = peer.connect(opponentId);
      setupDataConnection(conn);
    } else {
      if (searchRadius.current < 500) {
        searchRadius.current += 25;
      }
    }
  };

  const findMatchInternal = async (peer: Peer, stream: MediaStream) => {
    setIsSearching(true);
    
    if (mode === "ranked") {
      await supabase.from("ranked_queue").delete().eq("peer_id", peer.id);
      await supabase.from("ranked_queue").insert([{ peer_id: peer.id, elo: playerElo }]);
      
      pollIntervalRef.current = setInterval(() => {
        pollForRankedMatch(peer, stream);
      }, 3000);

    } else {
      await supabase.from("arena_queue").delete().eq("peer_id", peer.id);
      const { data } = await supabase.from("arena_queue").select("*").neq("peer_id", peer.id).limit(1);

      if (data && data.length > 0) {
        const opponentId = data[0].peer_id;
        await supabase.from("arena_queue").delete().eq("peer_id", opponentId);

        const call = peer.call(opponentId, stream);
        callRef.current = call;
        call.on("stream", (remoteMedia) => {
          setRemoteStream(remoteMedia);
          setIsConnected(true);
          setIsSearching(false);
        });

        const conn = peer.connect(opponentId);
        setupDataConnection(conn);
      } else {
        await supabase.from("arena_queue").insert([{ peer_id: peer.id }]);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        
        // Edge case: If user clicks "Back" before the camera even turns on
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        setLocalStream(stream);
        streamRef.current = stream; // Save to ref for cleanup

        const uniqueId = "user_" + Math.random().toString(36).substr(2, 9);
        const peer = new Peer(uniqueId, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
        peerRef.current = peer;

        peer.on("open", () => {
          if (isMounted) findMatchInternal(peer, stream);
        });

        peer.on("call", (call) => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          call.answer(stream);
          callRef.current = call;
          call.on("stream", (remoteMedia) => {
            setRemoteStream(remoteMedia);
            setIsConnected(true);
            setIsSearching(false);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          });
        });

        peer.on("connection", setupDataConnection);

      } catch (e) { 
        console.error("Media Device Error:", e); 
      }
    };

    init();
    
    // COMPLETE TEARDOWN ON UNMOUNT
    return () => { 
      isMounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      
      // 1. Kill the Camera Hardware
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // 2. Kill the Peer Connection & Queue
      if (peerRef.current) {
        const id = peerRef.current.id;
        if (id) {
          // Fire and forget deletes
          supabase.from("arena_queue").delete().eq("peer_id", id).then();
          supabase.from("ranked_queue").delete().eq("peer_id", id).then();
        }
        peerRef.current.destroy();
      }
    };
  }, [setupDataConnection, mode, playerElo]);

  const sendTelemetry = (type: string, payload: any) => {
    if (dataConnRef.current?.open) dataConnRef.current.send({ type, ...payload });
  };

  return { localStream, remoteStream, isSearching, isConnected, opponentScore, liveOpponentScore, remoteProfile, sendTelemetry, skip: () => window.location.reload() };
}