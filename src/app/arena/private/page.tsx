"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivateRoom } from "@/hooks/usePrivateRoom";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateMogScore } from "@/utils/faceMath";
import { createClient } from "@/lib/supabase/client";

const SLEEK_INDICES = [10, 152, 234, 454, 132, 361, 33, 263, 4, 61, 291];

// Simple audio synthesis for tick and victory/defeat
const playTickSound = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

const playResultSound = (isWin: boolean) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const notes = isWin ? [523, 659, 784] : [392, 311, 262];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.3);
  });
};

const getMatchVerdict = (myScore: number, oppScore: number) => {
  const diff = myScore - oppScore;
  const absDiff = Math.abs(diff);
  if (absDiff < 0.2) return { title: "STALEMATE", sub: "EQUAL LOOKSMAXXING", color: "#eab308" };
  if (diff > 0) {
    if (absDiff >= 2.0) return { title: "OBLITERATED", sub: "ABSOLUTE DOMINATION", color: "#39FF14" };
    if (absDiff >= 1.0) return { title: "DOMINATED", sub: "CLEAR VICTORY", color: "#39FF14" };
    return { title: "VICTORY", sub: "NARROW MOG", color: "#39FF14" };
  } else {
    if (absDiff >= 2.0) return { title: "IT'S OVER", sub: "BRUTALLY MOGGED", color: "#ef4444" };
    if (absDiff >= 1.0) return { title: "BRUTALIZED", sub: "NO COMPETITION", color: "#ef4444" };
    return { title: "MOGGED", sub: "BETTER LUCK NEXT TIME", color: "#ef4444" };
  }
};

// ============================================================================
// PRIVATE ROOM BATTLE COMPONENT
// ============================================================================
function PrivateArenaCore({ roomCode, localProfile }: { roomCode: string; localProfile: any }) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTelemetryTime = useRef(0);
  const scoreHistoryRef = useRef<number[]>([]);

  type Phase = 'WAITING' | 'PREP' | 'BATTLE' | 'SCORING' | 'RESULT';
  const [phase, setPhase] = useState<Phase>('WAITING');
  const [timer, setTimer] = useState<number>(0);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [liveMyScore, setLiveMyScore] = useState<number | null>(null);

  const {
    localStream, remoteStream, isSearching, isConnected,
    opponentScore, liveOpponentScore, remoteProfile, skip, sendTelemetry, error
  } = usePrivateRoom({
    roomCode,
    playerElo: localProfile.elo,
    onDisconnect: () => {
      setPhase('WAITING');
      setMyScore(null);
      setLiveMyScore(null);
      setTimer(0);
      scoreHistoryRef.current = [];
    }
  });

  const { isLoaded, detect } = useFaceScanner({ enabled: true });

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (isConnected && phase === 'WAITING') {
      sendTelemetry("PROFILE_SYNC", { profile: localProfile });
      setPhase('PREP');
      setTimer(5);
    }
  }, [isConnected, phase, sendTelemetry, localProfile]);

  const handleLocalVideoReady = () => {
    const loop = () => {
      if (localVideoRef.current && localCanvasRef.current && isLoaded) {
        const video = localVideoRef.current;
        const canvas = localCanvasRef.current;

        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
          const result = detect(video);
          const ctx = canvas.getContext("2d");
          const timeMs = performance.now();

          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const scanY = ((timeMs % 3000) / 3000) * canvas.height;
            ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(canvas.width, scanY);
            ctx.strokeStyle = "rgba(57, 255, 20, 0.4)"; ctx.lineWidth = 1.5; ctx.stroke();

            if (result?.faceLandmarks?.[0]) {
              const videoRatio = video.videoWidth / video.videoHeight;
              const canvasRatio = canvas.width / canvas.height;
              let rW, rH, oX, oY;
              if (videoRatio > canvasRatio) {
                rH = canvas.height; rW = video.videoWidth * (canvas.height / video.videoHeight);
                oX = (canvas.width - rW) / 2; oY = 0;
              } else {
                rW = canvas.width; rH = video.videoHeight * (canvas.width / video.videoWidth);
                oX = 0; oY = (canvas.height - rH) / 2;
              }

              const pts = SLEEK_INDICES.map(idx => {
                const pt = result.faceLandmarks[0][idx] as any;
                return pt ? { x: (pt.x * rW) + oX, y: (pt.y * rH) + oY } : null;
              }).filter(Boolean) as {x: number, y: number}[];

              ctx.lineWidth = 0.5; ctx.strokeStyle = "rgba(57, 255, 20, 0.2)"; ctx.beginPath();
              for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                  const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
                  if (dist < canvas.width * 0.25) { ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); }
                }
              }
              ctx.stroke();

              ctx.fillStyle = "#39FF14";
              pts.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI); ctx.fill(); });

              if (phase === 'BATTLE') {
                const currentScore = calculateMogScore(result.faceLandmarks[0] as any).score;
                if (currentScore > 1.0) {
                  scoreHistoryRef.current.push(currentScore);
                }
                if (timeMs - lastTelemetryTime.current > 150) {
                  setLiveMyScore(currentScore); 
                  sendTelemetry("LIVE_SCORE", { score: currentScore });
                  lastTelemetryTime.current = timeMs;
                }
              }
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (phase === 'WAITING' || phase === 'SCORING' || phase === 'RESULT') return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (phase === 'PREP') {
            setPhase('BATTLE');
            return 10;
          }
          if (phase === 'BATTLE') {
            setPhase('SCORING');
            return 0;
          }
        }
        playTickSound();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === 'SCORING') {
      const scores = scoreHistoryRef.current;
      let finalScore = 4.5;
      if (scores.length > 0) {
        finalScore = Math.max(...scores);
      }
      
      finalScore = parseFloat(finalScore.toFixed(1));
      setMyScore(finalScore);

      if (sendTelemetry) {
        sendTelemetry('FINAL_SCORE', { score: finalScore });
      }
    }
  }, [phase, sendTelemetry]);

  useEffect(() => {
    if (myScore !== null && opponentScore !== null) {
      setPhase("RESULT");
      const isWinner = myScore > opponentScore;
      playResultSound(isWinner);
    }
  }, [myScore, opponentScore]);

  const verdict = myScore !== null && opponentScore !== null ? getMatchVerdict(myScore, opponentScore) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", backgroundColor: "#09090b", overflow: "hidden", position: "relative" }}>

      {/* Timer & Phase Indicators */}
      {(phase === 'PREP' || phase === 'BATTLE') && (
        <div style={{ position: "absolute", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div style={{ color: "white", fontWeight: "900", letterSpacing: "5px", fontSize: "14px", backgroundColor: "rgba(0,0,0,0.5)", padding: "5px 15px", borderRadius: "99px" }}>
            {phase === 'PREP' ? 'GET READY' : 'MOGGING...'}
          </div>
          <div style={{ fontSize: "4rem", fontWeight: "900", color: "#ef4444", textShadow: "0 0 20px #ef4444" }}>
            {timer}
          </div>
        </div>
      )}

      {/* Result Overlay */}
      {phase === "RESULT" && verdict && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h1 style={{ fontSize: "5.5rem", fontWeight: 900, color: verdict.color, textShadow: `0 0 30px ${verdict.color}80`, margin: 0, textAlign: "center", lineHeight: 1.1 }}>
            {myScore !== null && opponentScore !== null && myScore > opponentScore ? "YOU MOGGED" : (myScore !== null && opponentScore !== null && myScore < opponentScore ? "MOGGED" : "STALEMATE")}
          </h1>
          <div style={{ color: "white", fontWeight: "bold", letterSpacing: "5px", marginBottom: "30px", opacity: 0.9 }}>{verdict.sub}</div>

          <div style={{ display: "flex", gap: "4rem", alignItems: "center", marginBottom: "40px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "5px", fontFamily: "monospace" }}>OPPONENT</div>
              <div style={{ fontSize: "3.5rem", fontWeight: 900, color: "white" }}>{opponentScore?.toFixed(1)}</div>
            </div>
            <div style={{ width: "1px", height: "60px", backgroundColor: "rgba(255,255,255,0.2)" }}></div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "5px", fontFamily: "monospace" }}>YOU</div>
              <div style={{ fontSize: "3.5rem", fontWeight: 900, color: verdict.color }}>{myScore?.toFixed(1)}</div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "20px" }}>
            <button onClick={() => {
                scoreHistoryRef.current = [];
                setMyScore(null);
                setLiveMyScore(null);
                setTimer(5);
                setPhase('PREP');
            }} style={{ padding: "15px 30px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>NEXT BATTLE</button>
            <button onClick={() => router.push("/lobby")} style={{ padding: "15px 30px", backgroundColor: "transparent", color: "white", border: "1px solid #27272a", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>LEAVE</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ flex: "none", height: "60px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 0 85px", borderBottom: "1px solid #27272a" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>← LOBBY</button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ color: "#22c55e", fontWeight: "900", letterSpacing: "2px", margin: 0, fontSize: "20px" }}>PRIVATE ROOM</h1>
          <span style={{
            backgroundColor: "rgba(34, 197, 94, 0.15)",
            border: "1px solid #22c55e40",
            color: "#22c55e",
            padding: "4px 12px",
            borderRadius: "6px",
            fontFamily: "monospace",
            fontSize: "14px",
            fontWeight: "900",
            letterSpacing: "3px"
          }}>{roomCode}</span>
        </div>
        <div style={{ width: "60px" }}></div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top: Opponent View */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#000" }}>
          {isSearching && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#22c55e", zIndex: 10, gap: "15px" }}>
              <div style={{ width: "60px", height: "60px", border: "3px solid #18181b", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
              <span style={{ fontFamily: "monospace", letterSpacing: "2px", fontWeight: "bold", fontSize: "14px" }}>
                WAITING FOR OPPONENT...
              </span>
              <span style={{ fontSize: "12px", color: "#71717a", fontFamily: "monospace" }}>
                Share code: <span style={{ color: "#22c55e", fontWeight: "900", letterSpacing: "3px" }}>{roomCode}</span>
              </span>
              {error && <span style={{ color: "#ef4444", fontSize: "12px" }}>{error}</span>}
            </div>
          )}
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {remoteProfile && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{remoteProfile.name}</div>
            </div>
          )}
          {liveOpponentScore && (phase === "BATTLE" || phase === "SCORING") && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveOpponentScore.toFixed(1)}</div>
          )}
        </div>

        {/* Bottom: Local View */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderTop: "2px solid #27272a" }}>
          <video ref={localVideoRef} autoPlay playsInline muted onLoadedData={handleLocalVideoReady} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <canvas ref={localCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
            <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{localProfile.name}</div>
          </div>
          {liveMyScore && (phase === "BATTLE" || phase === "SCORING") && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveMyScore.toFixed(1)}</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ flex: "none", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", borderTop: "1px solid #27272a", backgroundColor: "#09090b", zIndex: 110 }}>
        <button onClick={() => router.push("/lobby")} style={{ backgroundColor: "transparent", color: "#71717a", fontWeight: "bold", fontSize: "14px", padding: "12px 24px", borderRadius: "99px", border: "1px solid #27272a", cursor: "pointer" }}>
          LEAVE ROOM
        </button>
      </div>

      <style jsx global>{` @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}

// ============================================================================
// DATA LOADER
// ============================================================================
function PrivateArenaDataLoader() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("room") || "";
  const supabase = createClient();

  const [localProfile, setLocalProfile] = useState<{ id: string | null; name: string; elo: number; tier: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
          if (isMounted) {
            setLocalProfile({
              id: session.user.id,
              name: data?.username || session.user.user_metadata?.full_name || "Mogger",
              elo: data?.elo || 1200,
              tier: data?.tier || "Silver",
            });
          }
        } else {
          if (isMounted) {
            const savedGuestName = localStorage.getItem("omoggle_guest_name");
            setLocalProfile({
              id: null,
              name: savedGuestName || "Guest_" + Math.floor(Math.random() * 1000),
              elo: 1200,
              tier: "Silver",
            });
          }
        }
      } catch {
        if (isMounted) {
          const savedGuestName = localStorage.getItem("omoggle_guest_name");
          setLocalProfile({
            id: null,
            name: savedGuestName || "Guest_" + Math.floor(Math.random() * 1000),
            elo: 1200,
            tier: "Silver",
          });
        }
      }
    };

    initializeProfile();
    return () => { isMounted = false; };
  }, [supabase]);

  if (!roomCode) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", letterSpacing: "2px", flexDirection: "column", gap: "20px" }}>
        <div>NO ROOM CODE PROVIDED</div>
        <a href="/lobby" style={{ color: "#22c55e", textDecoration: "underline" }}>Return to Lobby</a>
      </div>
    );
  }

  if (!localProfile) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", letterSpacing: "2px" }}>
        INITIALIZING PRIVATE ROOM...
      </div>
    );
  }

  return <PrivateArenaCore roomCode={roomCode.toUpperCase()} localProfile={localProfile} />;
}

// ============================================================================
// SAFE SUSPENSE WRAPPER
// ============================================================================
export default function PrivateArena() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#09090b" }} />}>
      <PrivateArenaDataLoader />
    </Suspense>
  );
}
