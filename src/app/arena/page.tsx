"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMatchmaker } from "@/hooks/useMatchmaker";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateMogScore } from "@/utils/faceMath";

export default function Arena() {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTelemetryTime = useRef(0);

  const [battlePhase, setBattlePhase] = useState<"waiting" | "countdown" | "result">("waiting");
  const [countdown, setCountdown] = useState(5);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [liveMyScore, setLiveMyScore] = useState<number | null>(null);

  // Mock local profile
  const localProfile = {
    name: "Guest_" + Math.floor(Math.random() * 1000),
    elo: 1250,
    tier: "Silver"
  };

  const { localStream, remoteStream, isSearching, isConnected, opponentScore, liveOpponentScore, remoteProfile, skip, sendTelemetry } = useMatchmaker({
    onDisconnect: () => {
      setBattlePhase("waiting");
      setMyScore(null);
      setLiveMyScore(null);
      setCountdown(5);
    }
  });

  const { isLoaded, detect } = useFaceScanner({ enabled: true });

  // Stream Binders
  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Connection established - start battle
  useEffect(() => {
    if (isConnected && battlePhase === "waiting") {
      sendTelemetry("PROFILE_SYNC", { profile: localProfile });
      setBattlePhase("countdown");
      setCountdown(5);
    }
  }, [isConnected, battlePhase, sendTelemetry, localProfile]);

  // AI & Drawing Loop with Object-Fit Math
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

          if (ctx && result?.faceLandmarks?.[0]) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const videoRatio = video.videoWidth / video.videoHeight;
            const canvasRatio = canvas.width / canvas.height;

            let renderWidth, renderHeight, offsetX, offsetY;

            if (videoRatio > canvasRatio) {
              renderHeight = canvas.height;
              renderWidth = video.videoWidth * (canvas.height / video.videoHeight);
              offsetX = (canvas.width - renderWidth) / 2;
              offsetY = 0;
            } else {
              renderWidth = canvas.width;
              renderHeight = video.videoHeight * (canvas.width / video.videoWidth);
              offsetX = 0;
              offsetY = (canvas.height - renderHeight) / 2;
            }

            ctx.fillStyle = "#A855F7";

            result.faceLandmarks[0].forEach((pt: any) => {
              const x = (pt.x * renderWidth) + offsetX;
              const y = (pt.y * renderHeight) + offsetY;

              ctx.beginPath();
              ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
              ctx.fill();
            });

            // THROTTLED: Calculate and send every ~100ms (10fps)
            if (battlePhase === "countdown") {
              const now = performance.now();
              if (now - lastTelemetryTime.current > 100) {
                const mogData = calculateMogScore(result.faceLandmarks[0] as any);
                setLiveMyScore(mogData.score);
                sendTelemetry("LIVE_SCORE", { score: mogData.score });
                lastTelemetryTime.current = now;
              }
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
  };

  // Countdown timer
  useEffect(() => {
    if (battlePhase === "countdown" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (battlePhase === "countdown" && countdown === 0 && myScore === null) {
      // Lock in final score
      const mogData = calculateMogScore({ faceLandmarks: [] } as any);
      setMyScore(liveMyScore || mogData.score);
      sendTelemetry("FINAL_SCORE", { score: liveMyScore || mogData.score });
      setBattlePhase("result");
    }
  }, [battlePhase, countdown, myScore, liveMyScore, sendTelemetry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const isWinner = myScore !== null && opponentScore !== null ? myScore >= opponentScore : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "#09090b", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flex: "none", height: "60px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #27272a" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", fontFamily: "monospace", fontSize: "12px", background: "none", border: "none", cursor: "pointer" }}>← LOBBY</button>
        <h1 style={{ color: "#ef4444", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>LIVE ARENA</h1>
        <div style={{ width: "60px" }}></div>
      </div>

      {/* 50/50 Split */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Opponent (Top) */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#18181b", borderBottom: "2px solid #27272a" }}>
          {isSearching && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontFamily: "monospace", zIndex: 10 }}>
              SEARCHING FOR OPPONENT...
            </div>
          )}
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />

          {/* Profile Overlay */}
          {remoteProfile && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 30, display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: "8px", border: "1px solid #27272a", backdropFilter: "blur(4px)" }}>
              <div>
                <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{remoteProfile.name}</div>
                <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{remoteProfile.tier} • {remoteProfile.elo} ELO</div>
              </div>
            </div>
          )}

          {/* Live Score Overlay */}
          {liveOpponentScore && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 30, fontSize: "3rem", fontWeight: "900", color: "rgba(255,255,255,0.8)" }}>
              {liveOpponentScore.toFixed(1)}
            </div>
          )}

          {/* Final Score */}
          {opponentScore && (
            <div style={{ position: "absolute", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "8rem", fontWeight: "900", color: "#ef4444" }}>{opponentScore.toFixed(1)}</div>
            </div>
          )}
        </div>

        {/* Local (Bottom) */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#18181b" }}>
          <video ref={localVideoRef} autoPlay playsInline muted onLoadedData={handleLocalVideoReady} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <canvas ref={localCanvasRef} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", zIndex: 20, pointerEvents: "none", transform: "scaleX(-1)" }} />

          {/* Profile Overlay */}
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 30, display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: "8px", border: "1px solid #27272a", backdropFilter: "blur(4px)" }}>
            <div>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{localProfile.name}</div>
              <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{localProfile.tier} • {localProfile.elo} ELO</div>
            </div>
          </div>

          {/* Countdown */}
          {battlePhase === "countdown" && countdown > 0 && (
            <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "6rem", fontWeight: "900", color: "white", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
              {countdown}
            </div>
          )}

          {/* Live Score Overlay */}
          {liveMyScore && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 30, fontSize: "3rem", fontWeight: "900", color: "rgba(168,85,247,0.8)" }}>
              {liveMyScore.toFixed(1)}
            </div>
          )}

          {/* Final Score */}
          {myScore && (
            <div style={{ position: "absolute", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "8rem", fontWeight: "900", color: "#a855f7" }}>{myScore.toFixed(1)}</div>
            </div>
          )}

          {/* Victory/Mogged Banner */}
          {isWinner !== null && battlePhase === "result" && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-8deg)",
              zIndex: 50,
              padding: "16px 32px",
              backgroundColor: isWinner ? "#16a34a" : "#dc2626",
              border: "4px solid",
              borderColor: isWinner ? "#4ade80" : "#f87171",
            }}>
              <p style={{ fontSize: "3rem", fontWeight: "900", color: "white", margin: 0 }}>{isWinner ? "VICTORY" : "MOGGED"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ flex: "none", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#09090b", borderTop: "1px solid #27272a" }}>
        <button onClick={skip} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", fontSize: "20px", padding: "12px 48px", borderRadius: "9999px", border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(239,68,68,0.5)" }}>
          NEXT BATTLE
        </button>
      </div>
    </div>
  );
}