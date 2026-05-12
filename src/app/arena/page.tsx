"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMatchmaker } from "@/hooks/useMatchmaker";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateMogScore } from "@/utils/faceMath";
import { calculateEloUpdate } from "@/utils/eloMath";
import { createClient } from "@/lib/supabase";

const SLEEK_INDICES = [10, 152, 234, 454, 132, 361, 33, 263, 4, 61, 291];

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
// 1. CORE BATTLE COMPONENT (Your exact working code, driven by dynamic props)
// ============================================================================
function ArenaCore({ mode, localProfile }: { mode: "casual" | "ranked", localProfile: any }) {
  const router = useRouter();
  const supabase = createClient();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const lastTelemetryTime = useRef(0);
  
  const [battlePhase, setBattlePhase] = useState<"waiting" | "connected" | "countdown" | "result">("waiting");
  const [countdown, setCountdown] = useState(5);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [liveMyScore, setLiveMyScore] = useState<number | null>(null);
  const [eloResult, setEloResult] = useState<{ newElo: number, change: number } | null>(null);

  // 2. PASS DYNAMIC PROFILE & MODE INTO MATCHMAKER
  const { 
    localStream, remoteStream, isSearching, isConnected, 
    opponentScore, liveOpponentScore, remoteProfile, skip, sendTelemetry 
  } = useMatchmaker({
    mode: mode,
    playerElo: localProfile.elo,
    onDisconnect: () => {
      setBattlePhase("waiting");
      setMyScore(null);
      setLiveMyScore(null);
      setEloResult(null);
      setCountdown(5);
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
    if (isConnected && battlePhase === "waiting") {
      sendTelemetry("PROFILE_SYNC", { profile: localProfile });
      setBattlePhase("connected");
      setCountdown(5);
      setTimeout(() => setBattlePhase("countdown"), 1000);
    }
  }, [isConnected, battlePhase, sendTelemetry, localProfile]);

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

              if (battlePhase === "countdown") {
                if (timeMs - lastTelemetryTime.current > 150) {
                  const score = calculateMogScore(result.faceLandmarks[0] as any).score;
                  setLiveMyScore(score); sendTelemetry("LIVE_SCORE", { score });
                  lastTelemetryTime.current = timeMs;
                }
                
                // 3. MATCH END LOGIC
                if (countdown === 0 && myScore === null) {
                  const final = calculateMogScore(result.faceLandmarks[0] as any).score;
                  setMyScore(final); 
                  sendTelemetry("FINAL_SCORE", { score: final });
                  setBattlePhase("result");

                  // Calculate ELO Changes
                  const isWinner = final > (opponentScore || 0);
                  const oppElo = remoteProfile?.elo || 1200;
                  const { newElo, eloChange } = calculateEloUpdate(localProfile.elo, oppElo, isWinner);
                  
                  setEloResult({ newElo, change: eloChange });

                  // ONLY Persist to Supabase if Ranked Mode AND User is Authenticated
                  if (mode === "ranked" && localProfile.id) {
                    supabase.from('profiles').update({ 
                      elo: newElo
                    }).eq('id', localProfile.id).then(() => console.log("Ranked Match Reported."));
                  }
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
    if (battlePhase === "countdown" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [battlePhase, countdown]);

  const verdict = myScore !== null && opponentScore !== null ? getMatchVerdict(myScore, opponentScore) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", backgroundColor: "#09090b", overflow: "hidden", position: "relative" }}>
      
      {/* Result Overlay with ELO Update */}
      {battlePhase === "result" && verdict && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          
          {/* ELO Pop-up (Dynamic for Ranked Only) */}
          {mode === "ranked" && eloResult && (
            <div style={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #27272a", padding: "10px 30px", borderRadius: "99px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "white", fontFamily: "monospace", fontSize: "12px" }}>RANK RATING</span>
              <span style={{ color: eloResult.change > 0 ? "#39FF14" : "#ef4444", fontWeight: "900", fontSize: "18px" }}>
                {eloResult.change > 0 ? `+${eloResult.change}` : eloResult.change} ELO
              </span>
            </div>
          )}

          <h1 style={{ fontSize: "5.5rem", fontWeight: 900, color: verdict.color, textShadow: `0 0 30px ${verdict.color}80`, margin: 0 }}>{verdict.title}</h1>
          <div style={{ color: "white", fontWeight: "bold", letterSpacing: "5px", marginBottom: "30px", opacity: 0.9 }}>{verdict.sub}</div>
          
          <div style={{ display: "flex", gap: "4rem", alignItems: "center" }}>
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
        </div>
      )}

      {/* DYNAMIC Header */}
      <div style={{ flex: "none", height: "60px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", borderBottom: "1px solid #27272a" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>← LOBBY</button>
        <h1 style={{ color: mode === "ranked" ? "#fbbf24" : "#ef4444", fontWeight: "900", letterSpacing: "2px", margin: 0, fontSize: "20px" }}>
          {mode === "ranked" ? "RANKED ARENA" : "CASUAL 1V1"}
        </h1>
        <div style={{ width: "60px" }}></div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top: Opponent View */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#000" }}>
          {isSearching && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: mode === "ranked" ? "#fbbf24" : "#ef4444", zIndex: 10 }}>
              <span style={{ fontFamily: "monospace", letterSpacing: "2px", fontWeight: "bold" }}>
                {mode === "ranked" ? "EXPANDING SEARCH RADIUS..." : "SEARCHING FOR OPPONENT..."}
              </span>
              {mode === "ranked" && <span style={{ fontSize: "10px", color: "#71717a", marginTop: "10px" }}>+/- 50 ELO</span>}
            </div>
          )}
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {remoteProfile && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{remoteProfile.name}</div>
              {mode === "ranked" && <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{remoteProfile.tier} • {remoteProfile.elo} ELO</div>}
            </div>
          )}
          {liveOpponentScore && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveOpponentScore.toFixed(1)}</div>
          )}
        </div>

        {/* Bottom: Local View */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#000", borderTop: "2px solid #27272a" }}>
          <video ref={localVideoRef} autoPlay playsInline muted onLoadedData={handleLocalVideoReady} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <canvas ref={localCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
            <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{localProfile.name}</div>
            {mode === "ranked" && <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{localProfile.tier} • {localProfile.elo} ELO</div>}
          </div>
          {liveMyScore && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveMyScore.toFixed(1)}</div>
          )}
          {battlePhase === "countdown" && countdown > 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, color: "white", fontSize: "9rem", fontWeight: 900 }}>{countdown}</div>
          )}
        </div>
      </div>

      {/* Footer - Preserved exact reload logic */}
      <div style={{ flex: "none", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #27272a", backgroundColor: "#09090b", zIndex: 110 }}>
        <button onClick={() => window.location.reload()} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", fontSize: "18px", padding: "12px 48px", borderRadius: "99px", border: "none", cursor: "pointer" }}>
          {battlePhase === "result" ? "NEXT BATTLE" : "SKIP"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 2. DATA LOADER (Guarantees profile resolves BEFORE WebRTC hooks fire)
// ============================================================================
function ArenaDataLoader() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "casual" | "ranked") || "casual";
  const supabase = createClient();
  
  const [localProfile, setLocalProfile] = useState<{ id: string | null, name: string, elo: number, tier: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const initializeProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          
          if (isMounted) {
            const name = data?.username || session.user.user_metadata?.full_name || "Mogger";
            setLocalProfile({
              id: session.user.id,
              name: name,
              elo: data?.elo || 1200,
              tier: data?.tier || "Silver"
            });
          }
        } else {
          // NEW: Unauthenticated Guest logic reads from localStorage!
          if (isMounted) {
            const savedGuestName = localStorage.getItem("omoggle_guest_name");
            setLocalProfile({
              id: null,
              name: savedGuestName || ("Guest_" + Math.floor(Math.random() * 1000)),
              elo: 1200,
              tier: "Silver"
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          const savedGuestName = localStorage.getItem("omoggle_guest_name");
          setLocalProfile({
            id: null,
            name: savedGuestName || ("Guest_" + Math.floor(Math.random() * 1000)),
            elo: 1200,
            tier: "Silver"
          });
        }
      }
    };

    initializeProfile();

    return () => { isMounted = false; };
  }, [supabase]);

  if (!localProfile) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", letterSpacing: "2px" }}>
        INITIALIZING SECURE UPLINK...
      </div>
    );
  }

  return <ArenaCore mode={mode} localProfile={localProfile} />;
}

// ============================================================================
// 3. SAFE SUSPENSE WRAPPER (Prevents Next.js crash loops)
// ============================================================================
export default function Arena() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#09090b" }} />}>
      <ArenaDataLoader />
    </Suspense>
  );
}