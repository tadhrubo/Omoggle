"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection, DataConnection } from "peerjs";
import { createClient } from "@/lib/supabase/client";

interface MatchmakerProps {
  mode?: "casual" | "ranked";
  playerElo?: number;
  onDisconnect?: () => void;
  onRematch?: () => void;
}

export function useMatchmaker({ mode = "casual", playerElo = 1200, onDisconnect, onRematch }: MatchmakerProps = {}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // NEW: State to track if the invisible data pipe is actually open
  const [isDataConnected, setIsDataConnected] = useState(false);
  const [opponentScore, setOpponentScore] = useState<number | null>(null);
  const [liveOpponentScore, setLiveOpponentScore] = useState<number | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<any>(null);
  const [rematchState, setRematchState] = useState<'idle' | 'requested_by_me' | 'requested_by_opponent'>('idle');

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const searchRadius = useRef<number>(50); 
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null); 
  
  const supabase = createClient();

  // Stabilize callbacks to prevent the main useEffect from rerunning on every render
  const onRematchRef = useRef(onRematch);
  useEffect(() => {
    onRematchRef.current = onRematch;
  }, [onRematch]);

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
    if (onRematchRef.current) onRematchRef.current();
  }, [sendTelemetry]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    dataConnRef.current = conn;
    // NEW: Listen for the open event before sending data
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
        if (onRematchRef.current) onRematchRef.current();
      }
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
        
        const connectionTimeout = setTimeout(() => {
          if (callRef.current === call) {
            console.warn("Ranked handshake timed out. Recovering...");
            setIsConnecting(false);
            call.close();
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
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        });

        const conn = peer.connect(opponentId);
        setupDataConnection(conn);
      } else {
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

          const connectionTimeout = setTimeout(() => {
            if (callRef.current === call) {
              console.warn("Casual handshake timed out. Recovering...");
              setIsConnecting(false);
              call.close();
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
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        setLocalStream(stream);
        streamRef.current = stream; 

        const uniqueId = "user_" + Math.random().toString(36).substr(2, 9);

        const rtcConfig = {
          iceServers: [
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
              ]
            },
            ...(process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USERNAME && process.env.NEXT_PUBLIC_TURN_CREDENTIAL 
              ? [{
                  urls: process.env.NEXT_PUBLIC_TURN_URL,
                  username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                  credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
                }] 
              : [])
          ],
          iceCandidatePoolSize: 10,
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
    
    return () => { 
      isMounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (peerRef.current) {
        const id = peerRef.current.id;
        if (id) {
          supabase.from("arena_queue").delete().eq("peer_id", id).then();
          supabase.from("ranked_queue").delete().eq("peer_id", id).then();
        }
        peerRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, playerElo]);

  // NEW: Return isDataConnected & rematch controls
  return { 
    localStream, 
    remoteStream, 
    isSearching, 
    isConnected, 
    isConnecting, 
    isDataConnected, 
    opponentScore, 
    liveOpponentScore, 
    remoteProfile, 
    sendTelemetry, 
    rematchState,
    requestRematch,
    acceptRematch,
    skip: () => window.location.reload() 
  };
}