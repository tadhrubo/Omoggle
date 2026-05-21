"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMatchmaker } from "@/hooks/useMatchmaker";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateMogScore } from "@/utils/faceMath";
import { calculateEloUpdate, getPrestigeRank } from "@/utils/eloMath";
import { createClient } from "@/lib/supabase/client";
import { useAnalytics } from "@/hooks/useAnalytics";
import ShareCard from "@/components/ShareCard";
import { toPng } from "html-to-image";
import { safeCopyToClipboard } from "@/utils/clipboard";

const SLEEK_INDICES = [10, 152, 234, 454, 132, 361, 33, 263, 4, 61, 291];

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

function ArenaCore({ mode, localProfile }: { mode: "casual" | "ranked", localProfile: any }) {
  const router = useRouter();
  const supabase = createClient();
  const { trackEvent } = useAnalytics();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastTelemetryTime = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [battlePhase, setBattlePhase] = useState<"waiting" | "connected" | "countdown" | "result">("waiting");
  const [countdown, setCountdown] = useState(5);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [liveMyScore, setLiveMyScore] = useState<number | null>(null);
  const [eloResult, setEloResult] = useState<{ newElo: number, change: number } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { 
    localStream, remoteStream, isSearching, isConnected, isConnecting, isDataConnected,
    opponentScore, liveOpponentScore, remoteProfile, skip, sendTelemetry,
    rematchState, requestRematch, acceptRematch,
    searchTimeout, resetSearch
  } = useMatchmaker({
    mode: mode,
    playerElo: localProfile.elo,
    onDisconnect: () => {
      setBattlePhase("waiting");
      setMyScore(null);
      setLiveMyScore(null);
      setEloResult(null);
      setCountdown(5);
    },
    onRematch: () => {
      setMyScore(null);
      setLiveMyScore(null);
      setEloResult(null);
      setCountdown(5);
      setBattlePhase("countdown");
    }
  });

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1.0, pixelRatio: 1, cacheBust: true });
      const link = document.createElement('a');
      link.download = `omoggle-victory-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      if (mode === "casual") {
        trackEvent("casual_share_download");
      } else {
        trackEvent("share_click");
      }
    } catch (err) {
      console.error('Failed to generate card', err);
      alert('Could not generate image. Please try again.');
    }
  };

  const handleNativeShare = async () => {
    if (!cardRef.current) return;
    setIsSharing(true);
    let dataUrl = "";
    try {
      dataUrl = await toPng(cardRef.current, { quality: 0.9, pixelRatio: 1, skipAutoScale: true, cacheBust: true });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "mog-victory.png", { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Mog Battle Result',
          text: 'I just faced the scanner. Do you have the genetics to beat my score?',
          files: [file]
        });
        if (mode === "casual") {
          trackEvent("casual_share_social");
        } else {
          trackEvent("share_click");
        }
      } else {
        // Direct download fallback
        const link = document.createElement('a');
        link.download = `omoggle-victory-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        
        // Copy text to clipboard as a companion
        const shareText = `I just got a Mog Score of ${(myScore || 0).toFixed(1)} on Omoggle! Can you beat me?`;
        await safeCopyToClipboard(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);

        if (mode === "casual") {
          trackEvent("casual_share_download");
        } else {
          trackEvent("share_click");
        }
      }
    } catch (err) {
      console.warn("Share failed, falling back to download and clipboard copy:", err);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `omoggle-victory-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
      const shareText = `I just got a Mog Score of ${(myScore || 0).toFixed(1)} on Omoggle! Can you beat me?`;
      const copiedOk = await safeCopyToClipboard(shareText);
      if (copiedOk) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      if (mode === "casual") {
        trackEvent("casual_share_download");
      } else {
        trackEvent("share_click");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const { isLoaded, detect } = useFaceScanner({ enabled: true });

  const phaseRef = useRef(battlePhase);
  useEffect(() => {
    phaseRef.current = battlePhase;
  }, [battlePhase]);
  
  const telemetryRef = useRef(sendTelemetry);
  useEffect(() => {
    telemetryRef.current = sendTelemetry;
  }, [sendTelemetry]);

  const isLoadedRef = useRef(isLoaded);
  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);

  const detectRef = useRef(detect);
  useEffect(() => {
    detectRef.current = detect;
  }, [detect]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Guarantee that the canvas wipes clean when the match ends or when phase changes
  useEffect(() => {
    if (battlePhase === 'result' || battlePhase === 'waiting') {
      const canvas = localCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [battlePhase]);

  // Guard profile sync transition until both the video and data streams are established
  useEffect(() => {
    if (isConnected && isDataConnected && battlePhase === 'waiting') {
      telemetryRef.current("PROFILE_SYNC", { profile: localProfile });
      setBattlePhase('connected');
      setCountdown(5);
      if (mode === "casual") {
        trackEvent("casual_battle_join");
      } else {
        trackEvent("battle_join");
      }
      setTimeout(() => setBattlePhase("countdown"), 1000);
    }
  }, [isConnected, isDataConnected, battlePhase, localProfile, trackEvent, mode]);

  useEffect(() => {
    if (battlePhase === "countdown" && countdown === 0 && myScore === null) {
      const finalScore = liveMyScore !== null ? liveMyScore : 0; 
      
      setMyScore(finalScore);
      telemetryRef.current("FINAL_SCORE", { score: finalScore });
      setBattlePhase("result");
      if (mode === "casual") {
        trackEvent("casual_battle_complete");
      } else {
        trackEvent("battle_complete");
      }

      const isWinner = finalScore > (opponentScore || 0);
      playResultSound(isWinner);
      
      const oppElo = remoteProfile?.elo || 1200;
      const { newElo, eloChange } = calculateEloUpdate(localProfile.elo, oppElo, isWinner);
      setEloResult({ newElo, change: eloChange });

      // Always log the match, whether it's ranked or casual
      supabase.from('matches').insert([{
        winner_id: isWinner ? (localProfile.id || null) : (remoteProfile?.id || null),
        loser_id: isWinner ? (remoteProfile?.id || null) : (localProfile.id || null),
        winner_score: isWinner ? finalScore : (opponentScore || 0),
        loser_score: isWinner ? (opponentScore || 0) : finalScore,
        elo_change: mode === "ranked" ? Math.abs(eloChange) : 0,
        mode: mode.toUpperCase() // 'RANKED' or 'CASUAL'
      }]).then();

      if (mode === "ranked" && localProfile.id) {
        supabase.rpc('update_post_match_stats', {
          p_user_id: localProfile.id,
          p_new_elo: newElo,
          p_is_winner: isWinner,
          p_mode: mode
        }).then();

        if (isWinner && remoteProfile?.id && (remoteProfile?.current_streak || 0) >= 5) {
          supabase.from('nemeses').upsert([{
            user_id: remoteProfile.id,
            nemesis_id: localProfile.id,
            reason: 'streak_breaker'
          }], { onConflict: 'user_id,nemesis_id' }).then();
        }

        if (remoteProfile?.id) {
          supabase.rpc('update_post_match_stats', {
            p_user_id: remoteProfile.id,
            p_new_elo: calculateEloUpdate(oppElo, localProfile.elo, !isWinner).newElo,
            p_is_winner: !isWinner,
            p_mode: mode
          }).then();
        }
      }
    }
  }, [countdown, battlePhase, myScore, liveMyScore, opponentScore, mode, localProfile, remoteProfile, supabase, trackEvent]);

  // Ref mirror of searchTimeout so the rAF loop can see it without stale closure
  const searchTimeoutActiveRef = useRef(searchTimeout);
  useEffect(() => {
    searchTimeoutActiveRef.current = searchTimeout;
  }, [searchTimeout]);

  const handleLocalVideoReady = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    const loop = () => {
      // ── Pause the entire scanner loop while timed out to save CPU ──
      if (searchTimeoutActiveRef.current) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (localVideoRef.current && localCanvasRef.current) {
        const video = localVideoRef.current;
        const canvas = localCanvasRef.current;
        
        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
          const ctx = canvas.getContext("2d");
          
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (phaseRef.current === 'result') {
              requestRef.current = requestAnimationFrame(loop);
              return; 
            }

            if (isLoadedRef.current && detectRef.current) {
              const timeMs = performance.now();
              const scanY = ((timeMs % 3000) / 3000) * canvas.height;
              ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(canvas.width, scanY);
              ctx.strokeStyle = "rgba(57, 255, 20, 0.4)"; ctx.lineWidth = 1.5; ctx.stroke();

              try {
                const result = detectRef.current(video);

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

                  if (phaseRef.current === "countdown") {
                    const rawScore = calculateMogScore(result.faceLandmarks[0] as any);
                    const currentScore = typeof rawScore === 'number' && !isNaN(rawScore) ? rawScore : 0;

                    if (timeMs - lastTelemetryTime.current > 150) {
                      setLiveMyScore(currentScore); 
                      telemetryRef.current("LIVE_SCORE", { score: currentScore });
                      lastTelemetryTime.current = timeMs;
                    }
                  }
                }
              } catch (err) {
                console.warn("Scanner skipped frame due to error", err);
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
      playTickSound();
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [battlePhase, countdown]);

  const verdict = myScore !== null && opponentScore !== null ? getMatchVerdict(myScore, opponentScore) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw", backgroundColor: "#09090b", overflow: "hidden", position: "relative" }}>
      
      {battlePhase === "result" && verdict && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          
          {mode === "ranked" && eloResult && (
            <div style={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid #27272a", padding: "10px 30px", borderRadius: "99px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "white", fontFamily: "monospace", fontSize: "12px" }}>RANK RATING</span>
              <span style={{ color: eloResult.change > 0 ? "#39FF14" : "#ef4444", fontWeight: "900", fontSize: "18px" }}>
                {eloResult.change > 0 ? `+${eloResult.change}` : eloResult.change} ELO
              </span>
            </div>
          )}

          <h1 style={{ fontSize: "5.5rem", fontWeight: 900, color: verdict.color, textShadow: `0 0 30px ${verdict.color}80`, margin: 0, textAlign: "center", lineHeight: 1.1 }}>{verdict.title}</h1>
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

          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <button onClick={handleDownloadCard} style={{ padding: "12px 24px", backgroundColor: "white", color: "black", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>DOWNLOAD</button>
            <button 
              onClick={handleNativeShare} 
              disabled={isSharing}
              style={{ 
                padding: "12px 24px", 
                backgroundColor: copied ? "#39FF14" : "#a855f7", 
                color: copied ? "black" : "white", 
                border: "none", 
                borderRadius: "8px", 
                fontWeight: "bold", 
                cursor: isSharing ? "not-allowed" : "pointer", 
                fontSize: "14px",
                opacity: isSharing ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {isSharing ? (
                <>
                  <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }}></div>
                  PREPARING...
                </>
              ) : copied ? "LINK COPIED!" : "SHARE RESULT"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {rematchState === 'idle' && (
              <button onClick={requestRematch} style={{ padding: "15px 30px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>DEMAND REMATCH</button>
            )}

            {rematchState === 'requested_by_me' && (
              <div style={{ color: "#22c55e", fontWeight: "bold", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>WAITING FOR OPPONENT...</div>
            )}

            {rematchState === 'requested_by_opponent' && (
              <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                <span style={{ color: "#fbbf24", fontWeight: "bold" }}>OPPONENT WANTS A REMATCH!</span>
                <button onClick={acceptRematch} style={{ padding: "12px 24px", backgroundColor: "#fbbf24", color: "black", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>ACCEPT</button>
              </div>
            )}
            
            <button onClick={() => router.push("/lobby")} style={{ padding: "15px 30px", backgroundColor: "transparent", color: "white", border: "1px solid #27272a", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>LEAVE</button>
          </div>
        </div>
      )}

      <div style={{ flex: "none", height: "60px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px 0 85px", borderBottom: "1px solid #27272a" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>← LOBBY</button>
        <h1 style={{ color: mode === "ranked" ? "#fbbf24" : "#ef4444", fontWeight: "900", letterSpacing: "2px", margin: 0, fontSize: "20px" }}>
          {mode === "ranked" ? "RANKED ARENA" : "CASUAL 1V1"}
        </h1>
        <div style={{ width: "60px" }}></div>
      </div>

      <div className="flex flex-col md:flex-row w-full h-full flex-1 overflow-hidden">
        <div className="relative flex-1 w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-zinc-800 bg-black">
        {/* ── 45-second search timeout state ────────────────────────────── */}
          {searchTimeout && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", zIndex: 15,
              backgroundColor: "rgba(9,9,11,0.92)", backdropFilter: "blur(6px)",
            }}>
              {/* Warning icon */}
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>⏱</div>
              <h2 style={{
                fontFamily: "var(--font-bebas, monospace)", fontSize: "2.2rem",
                color: "#ef4444", letterSpacing: "3px", margin: 0, textAlign: "center",
                textShadow: "0 0 20px rgba(239,68,68,0.6)",
              }}>
                NO OPPONENT FOUND
              </h2>
              <p style={{
                fontFamily: "monospace", fontSize: "12px", color: "#71717a",
                marginTop: "10px", marginBottom: "28px", textAlign: "center",
                letterSpacing: "1px", maxWidth: "260px",
              }}>
                The arena is quiet right now.{"\n"}Try searching again.
              </p>
              <button
                onClick={resetSearch}
                style={{
                  backgroundColor: "#ef4444", color: "white", border: "none",
                  borderRadius: "8px", padding: "14px 36px", fontWeight: "900",
                  fontSize: "16px", letterSpacing: "2px", cursor: "pointer",
                  fontFamily: "var(--font-bebas, monospace)",
                  boxShadow: "0 0 24px rgba(239,68,68,0.4)",
                }}
              >
                SEARCH AGAIN
              </button>
              <button
                onClick={() => router.push("/lobby")}
                style={{
                  marginTop: "12px", backgroundColor: "transparent", color: "#71717a",
                  border: "1px solid #27272a", borderRadius: "8px", padding: "10px 28px",
                  fontWeight: "bold", fontSize: "13px", cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                BACK TO LOBBY
              </button>
            </div>
          )}

          {/* ── Normal searching / connecting overlay (hidden when timeout) ── */}
          {isSearching && !searchTimeout && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: mode === "ranked" ? "#fbbf24" : "#ef4444", zIndex: 10 }}>
              <span style={{ fontFamily: "monospace", letterSpacing: "2px", fontWeight: "bold" }}>
                {isConnecting 
                  ? "CONNECTING TO OPPONENT..." 
                  : (mode === "ranked" ? "EXPANDING SEARCH RADIUS..." : "SEARCHING FOR OPPONENT...")}
              </span>
              {!isConnecting && mode === "ranked" && <span style={{ fontSize: "10px", color: "#71717a", marginTop: "10px" }}>+/- 50 ELO</span>}
            </div>
          )}
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          {remoteProfile && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{remoteProfile.name}</div>
              {mode === "ranked" && <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{getPrestigeRank(remoteProfile.elo || 1200)} • {remoteProfile.elo || 1200} ELO</div>}
            </div>
          )}
          {liveOpponentScore !== null && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveOpponentScore.toFixed(1)}</div>
          )}
        </div>

        <div className="relative flex-1 w-full md:w-1/2 h-1/2 md:h-full bg-black">
          <video ref={localVideoRef} autoPlay playsInline muted onLoadedData={handleLocalVideoReady} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <canvas ref={localCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", border: "1px solid #27272a" }}>
            <div style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{localProfile.name}</div>
            {mode === "ranked" && <div style={{ color: "#a1a1aa", fontSize: "10px", fontFamily: "monospace" }}>{getPrestigeRank(localProfile.elo || 1200)} • {localProfile.elo || 1200} ELO</div>}
          </div>
          {liveMyScore !== null && battlePhase === "countdown" && (
            <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, color: "white", fontWeight: "900", fontSize: "4rem", opacity: 0.8 }}>{liveMyScore.toFixed(1)}</div>
          )}
          {battlePhase === "countdown" && countdown > 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, color: "white", fontSize: "9rem", fontWeight: 900 }}>{countdown}</div>
          )}
        </div>
      </div>

      <div style={{ flex: "none", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", borderTop: "1px solid #27272a", backgroundColor: "#09090b", zIndex: 110 }}>
        <button onClick={() => {
          if (remoteProfile?.id && localProfile.id) {
            supabase.rpc('increment_report', { user_id: remoteProfile.id }).then(() => alert("Report submitted. Thanks!"));
          } else {
            alert("Cannot report anonymous players.");
          }
        }} style={{ backgroundColor: "transparent", color: "#71717a", fontWeight: "bold", fontSize: "14px", padding: "12px 24px", borderRadius: "99px", border: "1px solid #27272a", cursor: "pointer" }}>
          REPORT
        </button>
        <button onClick={() => window.location.reload()} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", fontSize: "18px", padding: "12px 48px", borderRadius: "99px", border: "none", cursor: "pointer" }}>
          {battlePhase === "result" ? "NEXT BATTLE" : "SKIP"}
        </button>
      </div>

      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={cardRef}>
          <ShareCard 
            playerName={localProfile.name}
            opponentName={remoteProfile?.name}
            winRate={85}
            score={myScore || 0}
            elo={localProfile.elo}
            challengeLink={typeof window !== 'undefined' ? window.location.href : ''}
          />
        </div>
      </div>
    </div>
  );
}

function ArenaDataLoader() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "casual" | "ranked") || "casual";
  const supabase = createClient();
  
  const [localProfile, setLocalProfile] = useState<{ id: string | null, name: string, elo: number, tier: string, current_streak: number } | null>(null);

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
              tier: data?.tier || "Silver",
              current_streak: data?.current_streak || 0
            });
          }
        } else {
          if (isMounted) {
            const savedGuestName = localStorage.getItem("omoggle_guest_name");
            setLocalProfile({
              id: null,
              name: savedGuestName || ("Guest_" + Math.floor(Math.random() * 1000)),
              elo: 1200,
              tier: "Silver",
              current_streak: 0
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
            tier: "Silver",
            current_streak: 0
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

  if (mode === "ranked" && localProfile.id === null) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#050505", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: "20px", textAlign: "center" }}>
        <div style={{ width: "100%", maxWidth: "440px", backgroundColor: "#0a0a0c", border: "1px solid #ef444430", borderRadius: "24px", padding: "40px 30px", boxShadow: "0 0 40px rgba(0,0,0,0.8)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "15px" }}>
            <span style={{ fontSize: "2rem", fontWeight: "900", color: "#fbbf24" }}>🏆</span>
          </div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: "900", color: "white", margin: "0 0 10px 0", letterSpacing: "1px" }}>REGISTRATION REQUIRED</h2>
          <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", marginBottom: "30px" }}>
            Ranked matchmaking requires a persistent ELO profile and rank ranking history to track your genetic ascendancy. Guests can only play in the Casual Arena.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                  }
                });
              }}
              style={{
                width: "100%", padding: "16px", backgroundColor: "#ef4444", color: "white",
                border: "none", borderRadius: "12px", cursor: "pointer",
                fontWeight: "900", fontSize: "15px", transition: "all 0.2s",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)"
              }}
            >
              SIGN UP WITH GOOGLE
            </button>
            <button
              onClick={() => window.location.href = "/lobby"}
              style={{
                width: "100%", padding: "14px", backgroundColor: "transparent", color: "#71717a",
                border: "1px solid #27272a", borderRadius: "12px", cursor: "pointer",
                fontWeight: "bold", fontSize: "14px", transition: "all 0.2s"
              }}
            >
              RETURN TO LOBBY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ArenaCore mode={mode} localProfile={localProfile} />;
}

export default function Arena() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#09090b" }} />}>
      <ArenaDataLoader />
    </Suspense>
  );
}