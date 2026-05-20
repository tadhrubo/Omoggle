"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Scan, Loader2, RefreshCw } from "lucide-react";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateDetailedMogScore, type MogScoreResult } from "@/utils/faceMath";
import { FaceLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import CameraCheckModal from "@/app/components/CameraCheckModal";
import { getPSLRankInfo } from "@/utils/eloMath";
import { safeCopyToClipboard } from "@/utils/clipboard";
import LabShareCard from "@/components/LabShareCard";
import { toPng } from "html-to-image";

type LabState = "initializing" | "ready" | "scanning" | "result";

interface CameraError {
  type: "not-allowed" | "not-found" | "in-use" | "unknown";
  message: string;
}

export default function Lab() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [labState, setLabState] = useState<LabState>("initializing");
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [scoreResult, setScoreResult] = useState<MogScoreResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string>("");
  const [showLivenessCheck, setShowLivenessCheck] = useState(true);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const { isLoaded: scannerLoaded, detect } = useFaceScanner({
    enabled: labState !== "initializing",
  });

  // Initialize camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
        });

        setLocalStream(activeStream);

        // Force attachment to videoRef
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          // Explicitly call play() as a fallback for autoplay policies
          videoRef.current.play().catch((e) => console.error("Play failed:", e));
        }

        setLabState("ready");
      } catch (err) {
        const error = err as Error;
        let cameraError: CameraError;

        if (error.name === "NotAllowedError" || error.message.includes("Permission denied")) {
          cameraError = {
            type: "not-allowed",
            message: "Camera access denied. Please allow camera permissions in your browser settings and refresh.",
          };
        } else if (error.name === "NotFoundError" || error.message.includes("not found")) {
          cameraError = {
            type: "not-found",
            message: "No camera found. Please connect a webcam and refresh.",
          };
        } else if (error.name === "NotReadableError" || error.message.includes("in use")) {
          cameraError = {
            type: "in-use",
            message: "Camera is in use by another tab or application. Please close other apps using the camera and refresh.",
          };
        } else {
          cameraError = {
            type: "unknown",
            message: `Camera error: ${error.message}. Please refresh and try again.`,
          };
        }

        setCameraError(cameraError);
        setLabState("initializing");
      }
    };

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Empty dependency array so it runs on mount

  // Face tracking loop
  useEffect(() => {
    if (!scannerLoaded || !videoRef.current || !canvasRef.current || labState === "result") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const drawLoop = () => {
      if (video.readyState >= 2) {
        // CRITICAL: Sync canvas resolution to the actual rendered CSS size
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        const result = detect(video);

        if (ctx) {
          // Clear previous frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw Landmarks if they exist
          if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];
            const SLEEK_INDICES = [10, 152, 234, 454, 132, 361, 33, 263, 4, 61, 291];
            const pts = SLEEK_INDICES.map(idx => {
              const pt = landmarks[idx];
              return pt ? { x: pt.x * canvas.width, y: pt.y * canvas.height } : null;
            }).filter(Boolean) as {x: number, y: number}[];

            // Draw sleek connecting lines
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "rgba(57, 255, 20, 0.3)";
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              for (let j = i + 1; j < pts.length; j++) {
                const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
                if (dist < canvas.width * 0.25) {
                  ctx.moveTo(pts[i].x, pts[i].y);
                  ctx.lineTo(pts[j].x, pts[j].y);
                }
              }
            }
            ctx.stroke();

            // Draw dots
            ctx.fillStyle = "#39FF14";
            ctx.globalAlpha = 0.8;
            pts.forEach(pt => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
              ctx.fill();
            });
            ctx.globalAlpha = 1;
          }
        }
      }

      animationId = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [scannerLoaded, detect, labState]);

  const handleStartScan = async () => {
    setWarning(""); // Clear previous warnings

    if (!videoRef.current) return;

    // Run one immediate detection to verify a face exists
    const currentResult = detect(videoRef.current);

    if (!currentResult || !currentResult.faceLandmarks || currentResult.faceLandmarks.length === 0) {
      setWarning("ERROR: No face detected. Please look directly at the camera.");
      return; // ABORT SCAN
    }

    setLabState("scanning");
    setScanProgress(0);

    // 2.5-second scanning animation
    for (let i = 0; i <= 100; i += 4) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      setScanProgress(i);
    }

    // Calculate score
    if (videoRef.current) {
      const result = detect(videoRef.current);
      if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
        const mogResult = calculateDetailedMogScore(result.faceLandmarks[0] as any);
        setScoreResult(mogResult);

        // Capture the face scan photo and draw the cyber mesh on it
        const video = videoRef.current;
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth || 640;
        tempCanvas.height = video.videoHeight || 480;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          // Local webcam stream is mirrored (scaleX(-1)), so mirror the screenshot to keep it consistent
          tempCtx.translate(tempCanvas.width, 0);
          tempCtx.scale(-1, 1);
          tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
          // Restore context scale for drawing overlay coordinates
          tempCtx.scale(-1, 1);
          tempCtx.translate(-tempCanvas.width, 0);

          const landmarks = result.faceLandmarks[0];
          const SLEEK_INDICES = [10, 152, 234, 454, 132, 361, 33, 263, 4, 61, 291];
          const pts = SLEEK_INDICES.map(idx => {
            const pt = landmarks[idx];
            // Since we flipped back to normal coordinates, map pt.x correctly:
            // The video coordinates are [0, 1] left to right in original stream.
            // Since we captured the mirrored frame, pt.x * width matches perfectly!
            return pt ? { x: pt.x * tempCanvas.width, y: pt.y * tempCanvas.height } : null;
          }).filter(Boolean) as {x: number, y: number}[];

          // Draw sleek connecting lines
          tempCtx.lineWidth = 1.5;
          tempCtx.strokeStyle = "rgba(57, 255, 20, 0.4)";
          tempCtx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
              if (dist < tempCanvas.width * 0.25) {
                tempCtx.moveTo(pts[i].x, pts[i].y);
                tempCtx.lineTo(pts[j].x, pts[j].y);
              }
            }
          }
          tempCtx.stroke();

          // Draw dots
          tempCtx.fillStyle = "#39FF14";
          pts.forEach(pt => {
            tempCtx.beginPath();
            tempCtx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
            tempCtx.fill();
          });

          setCapturedImage(tempCanvas.toDataURL("image/jpeg", 0.85));
        }
      } else {
        setWarning("Lost face tracking during scan. Try again.");
        setLabState("ready");
        return;
      }
    }

    setLabState("result");
  };

  const handleRetry = () => {
    setLabState("initializing");
    setScoreResult(null);
    setCapturedImage(null);
    setScanProgress(0);
    setCameraError(null);
    setWarning("");

    // Re-initialize camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.error("Play failed:", e));
        }
        setLabState("ready");
      })
      .catch((err) => {
        const error = err as Error;
        setCameraError({
          type: "unknown",
          message: `Camera error: ${error.message}`,
        });
        setLabState("initializing");
      });
  };

  const handleBack = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    router.push("/lobby");
  };

  const handleShareCard = async () => {
    if (!shareCardRef.current || !scoreResult) return;
    setIsSharing(true);
    let dataUrl = "";
    try {
      // Force load web fonts before capture so Bebas Neue renders correctly
      dataUrl = await toPng(shareCardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: false,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "omoggle-mog-score.png", { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `My Mog Score: ${scoreResult.score.toFixed(1)} | Omoggle`,
          text: `I got rated ${scoreResult.score.toFixed(1)}/10 by Omoggle AI. Can you beat me?`,
          files: [file],
        });
      } else {
        // Fallback: direct download
        const link = document.createElement("a");
        link.download = `omoggle-mog-score-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn("Share failed, downloading instead:", err);
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `omoggle-mog-score-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Compute PSL rank info for result rendering (used in both share card and result UI)
  const rankInfoForResult = scoreResult ? getPSLRankInfo(scoreResult.score) : null;

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col">
      {/* Off-screen Share Card — rendered but invisible, captured by html-to-image */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        <div ref={shareCardRef}>
          {scoreResult && rankInfoForResult && (
            <LabShareCard
              result={scoreResult}
              rankName={rankInfoForResult.name}
              rankColor={rankInfoForResult.color || "#a855f7"}
              rankTier={rankInfoForResult.tier}
              capturedImage={capturedImage}
            />
          )}
        </div>
      </div>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-mono text-sm uppercase">Back to Lobby</span>
        </button>
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-purple-500" />
          <span
            className="text-xl uppercase tracking-tight"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            THE LAB - SOLO CALIBRATION
          </span>
        </div>
        <div className="w-24" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {labState !== "result" ? (
          <div className="w-full max-w-2xl">
            {/* Video Container - Always renders video/canvas */}
            <div className="relative w-full max-w-3xl aspect-video mx-auto overflow-hidden border-2 border-purple-500 rounded-xl shadow-[0_0_15px_#A855F7]">
              {/* PERSISTENT VIDEO & CANVAS */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none scale-x-[-1]"
              />

              {/* OVERLAYS */}
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40">
                {/* Loading / Error State */}
                {labState === "initializing" && !cameraError && (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                    <p className="text-sm font-mono text-zinc-500 uppercase">
                      Accessing Camera & Loading AI Models...
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-900/50 flex items-center justify-center mb-4">
                      <span className="text-3xl">⚠</span>
                    </div>
                    <p className="text-sm font-mono text-red-400 uppercase mb-2">ERROR</p>
                    <p className="text-sm text-zinc-400 mb-6">{cameraError.message}</p>
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm uppercase tracking-wider transition-colors rounded"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  </div>
                )}

                {/* Warning Message if no face detected */}
                {warning && (
                  <div className="text-red-400 bg-red-500/20 px-4 py-2 rounded-md mb-4 text-sm font-mono">
                    {warning}
                  </div>
                )}

                {/* Ready State - Show Scan Button */}
                {labState === "ready" && !warning && (
                  <button
                    onClick={handleStartScan}
                    className="flex items-center gap-3 px-12 py-4 bg-purple-600 hover:bg-purple-500 text-zinc-200 text-xl uppercase tracking-wider transition-all rounded-none border border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                  >
                    <Scan className="w-6 h-6" />
                    START SCAN
                  </button>
                )}

                {/* Scanning State */}
                {labState === "scanning" && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-64 bg-zinc-800 h-2 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-purple-500 transition-all duration-75"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-sm font-mono text-purple-400 uppercase tracking-widest">
                      Analyzing Biometrics...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* High-end Side-by-Side Umax Report Card */
          scoreResult && rankInfoForResult && (() => {
            const rankInfo = rankInfoForResult;
            return (
              <div style={{
                backdropFilter: "blur(20px)",
                backgroundColor: "rgba(15, 15, 20, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "24px",
                padding: "40px",
                width: "100%",
                maxWidth: "880px",
                margin: "0 auto",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.1)",
                color: "white"
              }}>
                {/* Header */}
                <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "20px", marginBottom: "32px", textAlign: "left" }}>
                  <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#a1a1aa", letterSpacing: "3px", textTransform: "uppercase" }}>Biometric Analysis Report</span>
                  <h3 style={{ fontSize: "28px", fontFamily: "var(--font-bebas)", letterSpacing: "1px", margin: "4px 0 0 0", color: "#fff" }}>AI CALIBRATION COMPLETE</h3>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: "40px", textAlign: "left" }} className="grid-cols-1 md:grid-cols-2">
                  {/* Left Column: Captured Face with Mesh Overlay & Prestige Badge */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {capturedImage && (
                      <div style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "4/3",
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                      }}>
                        <img src={capturedImage} alt="Biometric Face Scan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{
                          position: "absolute",
                          bottom: "16px",
                          left: "16px",
                          backgroundColor: "rgba(9, 9, 11, 0.85)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontFamily: "monospace",
                          color: "#39FF14",
                          border: "1px solid rgba(57, 255, 20, 0.35)",
                          letterSpacing: "1px",
                          fontWeight: "bold"
                        }}>
                          BIOMETRIC_SCAN_SECURED
                        </div>
                      </div>
                    )}

                    <div style={{
                      background: rankInfo.bg || "rgba(24, 24, 27, 0.5)",
                      border: `1px solid ${rankInfo.border || "rgba(255, 255, 255, 0.1)"}`,
                      boxShadow: rankInfo.glow ? `0 0 20px ${rankInfo.border}50` : "none",
                      borderRadius: "16px",
                      padding: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div style={{ textAlign: "left" }}>
                        <span style={{ fontSize: "11px", fontFamily: "monospace", color: "rgba(255, 255, 255, 0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>Mog Score</span>
                        <div style={{ fontSize: "52px", fontWeight: "950", fontFamily: "var(--font-bebas)", color: rankInfo.color || "white", lineHeight: "1", marginTop: "4px" }}>
                          {scoreResult.score.toFixed(1)}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <div style={{
                          fontSize: "13px",
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          letterSpacing: "2px",
                          color: "black",
                          backgroundColor: rankInfo.color || "white",
                          padding: "8px 18px",
                          borderRadius: "6px",
                          boxShadow: `0 6px 16px ${rankInfo.color}40`,
                          textTransform: "uppercase"
                        }}>
                          {rankInfo.name}
                        </div>
                        <div style={{ fontSize: "10px", fontFamily: "monospace", color: rankInfo.color, opacity: 0.8, letterSpacing: "1px" }}>
                          {rankInfo.tier}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Biometric Detail Bars */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px", justifyContent: "center" }}>
                    {/* Canthal Tilt */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontFamily: "monospace", color: "#e4e4e7", marginBottom: "6px" }}>
                        <span style={{ letterSpacing: "1px" }}>CANTHAL TILT</span>
                        <span style={{ color: "#39FF14", fontWeight: "bold" }}>{scoreResult.metrics.canthalTilt}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#a1a1aa", marginBottom: "8px" }}>
                        <span>Eye Alignment Angle</span>
                        <span style={{ color: "#a1a1aa" }}>
                          {parseFloat(scoreResult.metrics.canthalTilt) > 0 ? "Positive" : "Negative"}
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#1e1e24", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(10, 50 + parseFloat(scoreResult.metrics.canthalTilt) * 4))}%`,
                          height: "100%",
                          backgroundColor: "#39FF14",
                          boxShadow: "0 0 8px #39FF14",
                          borderRadius: "99px"
                        }}></div>
                      </div>
                    </div>

                    {/* Symmetry */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontFamily: "monospace", color: "#e4e4e7", marginBottom: "6px" }}>
                        <span style={{ letterSpacing: "1px" }}>FACIAL SYMMETRY</span>
                        <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{scoreResult.metrics.symmetry}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#a1a1aa", marginBottom: "8px" }}>
                        <span>Structural Balance</span>
                        <span style={{ color: "#a1a1aa" }}>Optimal</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#1e1e24", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{
                          width: scoreResult.metrics.symmetry,
                          height: "100%",
                          backgroundColor: "#38bdf8",
                          boxShadow: "0 0 8px #38bdf8",
                          borderRadius: "99px"
                        }}></div>
                      </div>
                    </div>

                    {/* Jaw Ratio */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontFamily: "monospace", color: "#e4e4e7", marginBottom: "6px" }}>
                        <span style={{ letterSpacing: "1px" }}>JAW RATIO</span>
                        <span style={{ color: "#a855f7", fontWeight: "bold" }}>{scoreResult.metrics.jawline}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#a1a1aa", marginBottom: "8px" }}>
                        <span>Cheek-to-Jaw Width</span>
                        <span style={{ color: "#a1a1aa" }}>Chiseled</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#1e1e24", borderRadius: "99px", overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(10, parseFloat(scoreResult.metrics.jawline) * 100))}%`,
                          height: "100%",
                          backgroundColor: "#a855f7",
                          boxShadow: "0 0 8px #a855f7",
                          borderRadius: "99px"
                        }}></div>
                      </div>
                    </div>

                    {/* Potential & Eye Shape Boxes */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
                      <div style={{ backgroundColor: "rgba(39, 39, 42, 0.4)", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <div style={{ fontSize: "10px", color: "#a1a1aa", fontFamily: "monospace", letterSpacing: "1px" }}>EYE SHAPE</div>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#fbbf24", marginTop: "4px" }}>{scoreResult.metrics.eyeShape}</div>
                      </div>
                      <div style={{ backgroundColor: "rgba(39, 39, 42, 0.4)", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <div style={{ fontSize: "10px", color: "#a1a1aa", fontFamily: "monospace", letterSpacing: "1px" }}>POTENTIAL</div>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#10b981", marginTop: "4px" }}>{scoreResult.metrics.potential} / 10</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "16px", marginTop: "40px" }}>
                  <button
                    onClick={handleRetry}
                    className="font-mono text-sm uppercase transition-all duration-200"
                    style={{
                      flex: "1",
                      padding: "14px 28px",
                      backgroundColor: "#27272a",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    Scan Again
                  </button>
                  <button
                    onClick={handleShareCard}
                    disabled={isSharing}
                    className="font-mono text-sm uppercase transition-all duration-200"
                    style={{
                      flex: "1.4",
                      padding: "14px 28px",
                      backgroundColor: copied ? "#39FF14" : isSharing ? "#a16207" : "#fbbf24",
                      color: "black",
                      border: "none",
                      borderRadius: "10px",
                      cursor: isSharing ? "not-allowed" : "pointer",
                      fontWeight: "900",
                      opacity: isSharing ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {isSharing ? (
                      <>
                        <div style={{ width: "14px", height: "14px", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "black", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                        Generating Card...
                      </>
                    ) : copied ? "Image Downloaded!" : "Share Report Card"}
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </main>

      {/* Liveness Check Modal */}
      <CameraCheckModal
        isOpen={showLivenessCheck && !livenessVerified}
        onComplete={() => {
          setLivenessVerified(true);
          setShowLivenessCheck(false);
        }}
        onExit={() => router.push("/lobby")}
      />
    </div>
  );
}