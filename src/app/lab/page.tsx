"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Scan, Loader2, RefreshCw } from "lucide-react";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { calculateMogScore, type MogScoreResult } from "@/utils/faceMath";
import CameraCheckModal from "@/app/components/CameraCheckModal";

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
  const [warning, setWarning] = useState<string>("");
  const [showLivenessCheck, setShowLivenessCheck] = useState(true);
  const [livenessVerified, setLivenessVerified] = useState(false);

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
            const landmarks = result.faceLandmarks[0]; // Get the first face

            ctx.fillStyle = "#39FF14"; // Neon Green
            ctx.globalAlpha = 0.8;

            // Draw the specific points (we don't need all 468, just a subset to look cool)
            landmarks.forEach((point) => {
              // Map normalized coordinates (0-1) to actual canvas pixels
              // Mirror horizontally: x' = canvas.width - (x * canvas.width)
              const x = canvas.width - (point.x * canvas.width);
              const y = point.y * canvas.height;

              ctx.beginPath();
              ctx.arc(x, y, 2, 0, 2 * Math.PI);
              ctx.fill();
            });
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
      if (result && result.faceLandmarks.length > 0) {
        const mogResult = calculateMogScore(result);
        setScoreResult(mogResult);
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

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col">
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
        <div className="w-full max-w-2xl">
          {/* Video Container - Always renders video/canvas */}
          <div className="relative w-full max-w-3xl aspect-video mx-auto overflow-hidden border-2 border-purple-500 rounded-xl shadow-[0_0_15px_#A855F7]">

            {/* PERSISTENT VIDEO & CANVAS - Never conditionally hide these */}
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
              {(labState === "initializing" && !cameraError) && (
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

              {/* Result State */}
              {labState === "result" && scoreResult && (
                <div className="flex flex-col items-center backdrop-blur-md bg-zinc-950/80 p-6 rounded-xl border border-purple-500/50">
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">
                    Your Mog Score
                  </p>
                  <p
                    className="text-7xl font-bold text-purple-400 mb-4"
                    style={{ fontFamily: "var(--font-bebas)" }}
                  >
                    {scoreResult.score.toFixed(1)}
                  </p>
                  <div className="font-mono text-sm border border-zinc-800 p-3 rounded text-left">
                    <div className="mb-1">CANTHAL TILT: {scoreResult.metrics.canthalTilt}</div>
                    <div className="mb-1">SYMMETRY: {scoreResult.metrics.symmetry}</div>
                    <div>JAW RATIO: {scoreResult.metrics.jawline}</div>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="mt-4 text-xs text-zinc-400 hover:text-white font-mono uppercase"
                  >
                    ↺ Scan Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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