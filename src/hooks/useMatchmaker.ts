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
  const [isConnecting, setIsConnecting] = useState(false);
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
      
      setIsConnecting(true);

      // Call the secure RPC function to claim the match atomically
      const { data: matchClaimed, error } = await supabase.rpc('claim_match', {
        p_queue_table: 'ranked_queue',
        p_opponent_peer_id: opponentId,
        p_my_peer_id: peer.id
      });

      if (error) {
        console.error("RPC Error claiming match:", error);
        setIsConnecting(false);
        return;
      }

      if (matchClaimed) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        const call = peer.call(opponentId, stream);
        callRef.current = call;
        
        // Timeout check: if remote stream doesn't arrive within 10 seconds, reset connection
        const connectionTimeout = setTimeout(() => {
          if (callRef.current === call) {
            console.warn("Ranked handshake timed out. Recovering...");
            setIsConnecting(false);
            call.close();
            // Re-insert ourselves and start polling again
            supabase.from("ranked_queue").insert([{ peer_id: peer.id, elo: playerElo }]).then();
            pollIntervalRef.current = setInterval(() => {
              pollForRankedMatch(peer, stream);
            }, 3000);
          }
        }, 10000);

        call.on("stream", (remoteMedia) => {
          clearTimeout(connectionTimeout);
          setRemoteStream(remoteMedia);
          setIsConnected(true);
          setIsConnecting(false);
          setIsSearching(false);
          // Haptic feedback on connection
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        });

        const conn = peer.connect(opponentId);
        setupDataConnection(conn);
      } else {
        // Opponent already claimed by someone else, reset connecting state
        setIsConnecting(false);
      }
    } else {
      if (searchRadius.current < 500) {
        searchRadius.current += 25;
      }
    }
  };

  const findMatchInternal = async (peer: Peer, stream: MediaStream) => {
    setIsSearching(true);
    setIsConnecting(false);
    
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
        
        setIsConnecting(true);

        // Call the secure RPC function to claim the match atomically
        const { data: matchClaimed, error } = await supabase.rpc('claim_match', {
          p_queue_table: 'arena_queue',
          p_opponent_peer_id: opponentId,
          p_my_peer_id: peer.id
        });

        if (error) {
          console.error("RPC Error claiming match:", error);
          setIsConnecting(false);
          return;
        }

        if (matchClaimed) {
          const call = peer.call(opponentId, stream);
          callRef.current = call;

          // Timeout check: if remote stream doesn't arrive within 10 seconds, reset connection
          const connectionTimeout = setTimeout(() => {
            if (callRef.current === call) {
              console.warn("Casual handshake timed out. Recovering...");
              setIsConnecting(false);
              call.close();
              // Re-insert myself to queue
              supabase.from("arena_queue").insert([{ peer_id: peer.id }]).then();
            }
          }, 10000);

          call.on("stream", (remoteMedia) => {
            clearTimeout(connectionTimeout);
            setRemoteStream(remoteMedia);
            setIsConnected(true);
            setIsConnecting(false);
            setIsSearching(false);
          });

          const conn = peer.connect(opponentId);
          setupDataConnection(conn);
        } else {
          // Opponent was already claimed, reset connecting and add myself to queue instead
          setIsConnecting(false);
          await supabase.from("arena_queue").insert([{ peer_id: peer.id }]);
        }
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

        peer.on("open", () => {
          if (isMounted) findMatchInternal(peer, stream);
        });

        peer.on("call", (call) => {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsConnecting(true);
          call.answer(stream);
          callRef.current = call;
          call.on("stream", (remoteMedia) => {
            setRemoteStream(remoteMedia);
            setIsConnected(true);
            setIsConnecting(false);
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

  return { localStream, remoteStream, isSearching, isConnected, isConnecting, opponentScore, liveOpponentScore, remoteProfile, sendTelemetry, skip: () => window.location.reload() };
}