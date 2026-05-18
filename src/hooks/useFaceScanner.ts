"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

interface UseFaceScannerOptions {
  enabled?: boolean;
}

interface UseFaceScannerReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  detect: (video: HTMLVideoElement) => FaceLandmarkerResult | null;
  landmarks: FaceLandmarkerResult | null;
}

export function useFaceScanner({
  enabled = true,
}: UseFaceScannerOptions = {}): UseFaceScannerReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled) return;

    let isCancelled = false;

    const initializeLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsLoaded(true);
        setIsLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to load face scanner");
          setIsLoading(false);
        }
      }
    };

    initializeLandmarker();

    return () => {
      isCancelled = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [enabled]);

  const detect = useCallback((video: HTMLVideoElement): FaceLandmarkerResult | null => {
    if (!landmarkerRef.current || video.readyState < 2) {
      return null;
    }

    // CRITICAL FIX: Use performance.now() to guarantee strictly increasing timestamps
    const startTimeMs = performance.now();

    if (startTimeMs > lastVideoTimeRef.current) {
      try {
        const result = landmarkerRef.current.detectForVideo(video, startTimeMs);
        lastVideoTimeRef.current = startTimeMs;

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          // Landmarks state update removed to prevent 60fps re-renders in parent components
        }
        return result;
      } catch (error) {
        console.warn("MediaPipe frame dropped:", error);
        return null;
      }
    }

    return null;
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    detect,
    landmarks: null,
  };
}