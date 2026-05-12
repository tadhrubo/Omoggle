"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useFaceScanner } from "@/hooks/useFaceScanner";
import { detectBlink, detectTurnLeft, checkFaceCentered, type FaceLandmarks, resetLivenessState } from "@/utils/faceMath";

interface CameraCheckModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onExit: () => void;
}

export default function CameraCheckModal({ isOpen, onComplete, onExit }: CameraCheckModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);

  const [streamActive, setStreamActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const blinkDetectedRef = useRef(false);
  const turnDetectedRef = useRef(false);
  const alignCompletedRef = useRef(false);
  const doneTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { detect, isLoaded } = useFaceScanner({ enabled: isOpen });

  useEffect(() => {
    if (!isOpen) return;
    let stream: MediaStream | null = null;
    resetLivenessState();

    const startCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera fail:", err);
        setError("Camera access denied. Please allow camera permissions.");
      }
    };
    startCam();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (doneTimeoutRef.current) clearTimeout(doneTimeoutRef.current);
    };
  }, [isOpen]);

  const handleVideoReady = () => {
    setStreamActive(true);

    const renderLoop = () => {
      if (videoRef.current && canvasRef.current && isLoaded) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState >= 2 && video.videoWidth > 0) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;

          const result = detect(video);
          const ctx = canvas.getContext("2d");

          if (ctx && result?.faceLandmarks && result.faceLandmarks.length > 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // CRITICAL FIX: The object-fit: cover coordinate mapping
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

            const landmarks = result.faceLandmarks[0] as unknown as FaceLandmarks[];

            ctx.fillStyle = "#39FF14"; // Neon Green
            ctx.globalAlpha = 0.8;
            
            landmarks.forEach((point: FaceLandmarks) => {
               // Map normalized points to the calculated object-fit dimensions
              const x = (point.x * renderWidth) + offsetX;
              const y = (point.y * renderHeight) + offsetY;
              
              ctx.beginPath();
              ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
              ctx.fill();
            });
            ctx.globalAlpha = 1;

            // Step logic
            if (currentStep === 0 && !alignCompletedRef.current) {
              if (checkFaceCentered(landmarks)) {
                alignCompletedRef.current = true;
                setCurrentStep(1);
              }
            } else if (currentStep === 1 && !blinkDetectedRef.current) {
              if (detectBlink(landmarks)) {
                blinkDetectedRef.current = true;
                setCurrentStep(2);
              }
            } else if (currentStep === 2 && !turnDetectedRef.current) {
              if (detectTurnLeft(landmarks)) {
                turnDetectedRef.current = true;
                setCurrentStep(3);
              }
            } else if (currentStep === 3) {
              setProgress(100);
              if (!doneTimeoutRef.current) {
                doneTimeoutRef.current = setTimeout(onComplete, 1000);
              }
            }
          }
        }
      }
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (currentStep === 3) return 100;
        const target = (currentStep / 3) * 100;
        if (prev < target) return Math.min(prev + 2, target);
        return prev;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [currentStep]);

  if (!isOpen) return null;

  const getInstructionText = () => {
    switch (currentStep) {
      case 0: return "ALIGN FACE";
      case 1: return "BLINK ONCE";
      case 2: return "TURN HEAD LEFT";
      case 3: return "VERIFIED";
      default: return "ALIGN FACE";
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="bg-[#09090b] border border-zinc-800 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col" style={{ width: "100%", maxWidth: "400px" }}>
        
        <h2 className="text-xl text-white text-center pt-5 font-black tracking-widest uppercase">
          Camera Access Check
        </h2>
        <p className="text-[10px] text-zinc-500 font-mono text-center pb-4 uppercase tracking-widest">
          Short-Lived Session Challenge
        </p>

        <div className="relative w-full bg-zinc-900 border-y border-zinc-800" style={{ height: "350px", minHeight: "350px" }}>
          {!streamActive && !error && (
            <div className="absolute inset-0 text-white flex items-center justify-center font-mono text-sm uppercase">
              Accessing Camera...
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
              <p className="text-red-400 text-sm font-mono text-center px-4">{error}</p>
            </div>
          )}

          <video ref={videoRef} autoPlay playsInline muted onLoadedData={handleVideoReady} className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" style={{ transform: "scaleX(-1)" }} />

          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-30">
            <span className="bg-black/80 backdrop-blur-md px-6 py-2 rounded-full text-white font-mono font-bold tracking-widest border border-white/10">
              {getInstructionText()}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col items-center">
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex justify-between w-full text-[10px] font-mono text-zinc-500 mb-4 px-2">
            <span className={currentStep === 0 ? "text-cyan-400" : ""}>ALIGN</span>
            <span className={currentStep === 1 ? "text-cyan-400" : ""}>BLINK</span>
            <span className={currentStep === 2 ? "text-cyan-400" : ""}>TURN</span>
            <span className={currentStep === 3 ? "text-cyan-400" : ""}>DONE</span>
          </div>

          <p className="text-[10px] text-zinc-600 text-center mb-4 px-4 leading-relaxed">
            Facial landmarks are processed locally in your browser and are never uploaded.
          </p>

          <button onClick={onExit} className="border border-red-500/50 text-red-500 hover:bg-red-500/10 px-8 py-2 rounded-full font-mono text-xs transition flex items-center gap-2">
            <X className="w-4 h-4" />
            EXIT
          </button>
        </div>
      </div>
    </div>
  );
}