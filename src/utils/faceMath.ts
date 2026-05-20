import { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type FaceLandmarks = Landmark;

// MediaPipe face landmark indices
const LANDMARKS = {
  // Eyes
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  LEFT_UPPER_LID: 159,
  LEFT_LOWER_LID: 145,
  RIGHT_UPPER_LID: 386,
  RIGHT_LOWER_LID: 373,

  // Cheekbones
  LEFT_CHEEK: 50,
  RIGHT_CHEEK: 280,

  // Nose
  NOSE_TIP: 1,
  NOSE_BOTTOM: 6,

  // Jaw
  LEFT_JAW: 172,
  RIGHT_JAW: 397,
  CHIN: 152,
  CHIN_LEFT: 148,
  CHIN_RIGHT: 176,

  // Face boundaries
  LEFT_TEMPLE: 234,
  RIGHT_TEMPLE: 454,
};

// Extract landmark by index
function getLandmark(landmarks: Landmark[], index: number): Landmark {
  return landmarks[index];
}

// Calculate angle between two points
function calculateAngle(p1: Landmark, p2: Landmark): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
}

// Calculate distance between two points
function calculateDistance(p1: Landmark, p2: Landmark): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate canthal tilt (eye angle)
// Normalize angle to output a sensible degree (e.g., between -15° and +15°)
// Positive tilt = attractive uptilted eyes
function calculateCanthalTilt(landmarks: Landmark[]): number {
  const leftInner = getLandmark(landmarks, LANDMARKS.LEFT_EYE_INNER);
  const leftOuter = getLandmark(landmarks, LANDMARKS.LEFT_EYE_OUTER);
  const rightInner = getLandmark(landmarks, LANDMARKS.RIGHT_EYE_INNER);
  const rightOuter = getLandmark(landmarks, LANDMARKS.RIGHT_EYE_OUTER);

  // Calculate tilt as vertical difference / horizontal difference for each eye
  // Left eye: outer is typically lower than inner in positive tilt
  const leftTilt = ((leftInner.y - leftOuter.y) / (leftOuter.x - leftInner.x)) * (180 / Math.PI);

  // Right eye: outer is typically lower than inner in positive tilt
  const rightTilt = ((rightOuter.y - rightInner.y) / (rightOuter.x - rightInner.x)) * (180 / Math.PI);

  // Average tilt - normalize to a sensible range
  return (leftTilt + rightTilt) / 2;
}

// Calculate facial symmetry
function calculateSymmetry(landmarks: Landmark[]): number {
  const noseTip = getLandmark(landmarks, LANDMARKS.NOSE_TIP);
  const chin = getLandmark(landmarks, LANDMARKS.CHIN);
  const leftCheek = getLandmark(landmarks, LANDMARKS.LEFT_CHEEK);
  const rightCheek = getLandmark(landmarks, LANDMARKS.RIGHT_CHEEK);

  // Calculate face midline
  const midX = (noseTip.x + chin.x) / 2;

  // Distance from midline for each cheek
  const leftDeviation = Math.abs(leftCheek.x - midX);
  const rightDeviation = Math.abs(rightCheek.x - midX);

  // Symmetry score - lower variance is better
  const variance = Math.abs(leftDeviation - rightDeviation);
  return Math.max(0, 1 - variance * 10);
}

// Calculate jawline to mid-face ratio
function calculateJawlineRatio(landmarks: Landmark[]): number {
  const leftCheek = getLandmark(landmarks, LANDMARKS.LEFT_CHEEK);
  const rightCheek = getLandmark(landmarks, LANDMARKS.RIGHT_CHEEK);
  const leftJaw = getLandmark(landmarks, LANDMARKS.LEFT_JAW);
  const rightJaw = getLandmark(landmarks, LANDMARKS.RIGHT_JAW);
  const chin = getLandmark(landmarks, LANDMARKS.CHIN);
  const noseTip = getLandmark(landmarks, LANDMARKS.NOSE_TIP);

  // Mid-face width (cheek to cheek)
  const midFaceWidth = calculateDistance(leftCheek, rightCheek);

  // Jaw width
  const jawWidth = calculateDistance(leftJaw, rightJaw);

  // Lower face height (nose to chin)
  const lowerFaceHeight = calculateDistance(noseTip, chin);

  // Ideal jawline: narrower than mid-face, strong chin definition
  const jawRatio = jawWidth / midFaceWidth;
  const chinStrength = lowerFaceHeight / midFaceWidth;

  // Good jawline: slightly narrower than cheeks, strong chin
  return Math.min(1, (1 - Math.abs(jawRatio - 0.75)) * 0.5 + chinStrength * 0.5);
}

// Calculate overall face structure score
function calculateStructureScore(landmarks: Landmark[]): number {
  const canthalTilt = calculateCanthalTilt(landmarks);
  const symmetry = calculateSymmetry(landmarks);
  const jawline = calculateJawlineRatio(landmarks);

  // Canthal tilt: positive adds up to 2 points
  const tiltScore = Math.max(0, canthalTilt / 10) * 2;

  // Symmetry contributes up to 3 points
  const symmetryScore = symmetry * 3;

  // Jawline contributes up to 2 points
  const jawlineScore = jawline * 2;

  return tiltScore + symmetryScore + jawlineScore;
}

export interface MogScoreResult {
  score: number;
  metrics: {
    canthalTilt: string;
    symmetry: string;
    jawline: string;
    potential: string;
    eyeShape: string;
  };
}

/**
 * PSL-calibrated Mog Score for high-performance loops.
 * 
 * Scale mirrors UMAX app scoring where the average person scores 4.5-5.5.
 * - 1-4:   Below average (structural deficiencies)
 * - 4-5.5: Average (most people)
 * - 5.5-7: Above average
 * - 7-8:   Attractive (top 15%)
 * - 8-9:   Very attractive (top 5%)
 * - 9+:    Exceptional (model-tier, extremely rare)
 */
export function calculateMogScore(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length === 0) return 0;

  const tilt = calculateCanthalTilt(landmarks);
  const symmetry = calculateSymmetry(landmarks);
  const jawline = calculateJawlineRatio(landmarks);

  // ── 1. Canthal Tilt ──────────────────────────────────────────────────────
  // Typical humans: -3° to +3°. Positive is hunter-eyed. Ideal: +4° to +8°.
  // Raw camera-estimated degrees are smaller than real degrees.
  // Map so tilt=0 → 4.5pts, tilt=+5 → 6pts, tilt=-5 → 3pts
  const tiltScore = Math.max(1.0, Math.min(10.0, 4.5 + tilt * 0.3));

  // ── 2. Facial Symmetry ───────────────────────────────────────────────────
  // calculateSymmetry() returns 0-1.
  // Humans typically range 0.85-0.99. Map to a 1-9.5 range.
  // symmetry=0.95 → ~5.5 (average), symmetry=0.99 → ~7, symmetry=0.85 → ~4
  const symmetryScore = Math.max(1.0, Math.min(10.0, (symmetry - 0.80) * 60));

  // ── 3. Jaw/Chin Structure ────────────────────────────────────────────────
  // calculateJawlineRatio() returns 0-1.
  // Typical range: 0.55-0.80. Map so 0.65 → 5, 0.75 → 7, 0.55 → 3
  const jawScore = Math.max(1.0, Math.min(10.0, (jawline - 0.40) * 18));

  // ── Composite PSL score ──────────────────────────────────────────────────
  // Weighted: symmetry matters most visually, then jaw structure, then eye tilt
  const raw = tiltScore * 0.30 + symmetryScore * 0.40 + jawScore * 0.30;

  // Apply a PSL penalty curve: compress upper range so 9+ is truly exceptional.
  // Scores above 7 are halved in their excess above 7 to prevent score inflation.
  let psl: number;
  if (raw <= 7.0) {
    psl = raw;
  } else {
    // Each point above 7 maps to only 0.6 additional points (diminishing gains)
    psl = 7.0 + (raw - 7.0) * 0.6;
  }

  return parseFloat(Math.max(1.0, Math.min(9.9, psl)).toFixed(1));
}

/**
 * Calculates a detailed Mog Score with metrics for UI display.
 * Potential score: realistic ceiling based on what could change (e.g. fitness, grooming).
 */
export function calculateDetailedMogScore(landmarks: Landmark[]): MogScoreResult {
  const score = calculateMogScore(landmarks);
  
  const canthalTilt = calculateCanthalTilt(landmarks);
  const symmetry = calculateSymmetry(landmarks);
  const jawline = calculateJawlineRatio(landmarks);

  // Realistic potential: genetics are fixed, but soft tissue/posture adds ~0.3-0.8
  const potential = Math.min(9.9, score + Math.max(0.3, (9.9 - score) * 0.15)).toFixed(1);

  let eyeShape = "Almond Eyes";
  if (canthalTilt > 4) eyeShape = "Hunter Eyes";
  else if (canthalTilt > 1.5) eyeShape = "Slightly Positive";
  else if (canthalTilt < -2) eyeShape = "Droopy Eyes";
  else if (canthalTilt < 0) eyeShape = "Neutral Tilt";

  return {
    score,
    metrics: {
      canthalTilt: canthalTilt.toFixed(2) + "°",
      symmetry: (symmetry * 100).toFixed(1) + "%",
      jawline: jawline.toFixed(2),
      potential,
      eyeShape
    },
  };
}

// Get specific landmark indices for drawing
export function getDrawingIndices(): {
  eyes: number[];
  jawline: number[];
  nose: number[];
} {
  return {
    eyes: [
      LANDMARKS.LEFT_EYE_OUTER,
      LANDMARKS.LEFT_EYE_INNER,
      LANDMARKS.RIGHT_EYE_INNER,
      LANDMARKS.RIGHT_EYE_OUTER,
    ],
    jawline: [
      LANDMARKS.LEFT_JAW,
      LANDMARKS.CHIN_LEFT,
      LANDMARKS.CHIN,
      LANDMARKS.CHIN_RIGHT,
      LANDMARKS.RIGHT_JAW,
    ],
    nose: [
      LANDMARKS.NOSE_TIP,
      LANDMARKS.NOSE_BOTTOM,
    ],
  };
}

// Calculate Eye Aspect Ratio (EAR) for blink detection
function calculateEyeAspectRatio(landmarks: Landmark[]): number {
  // Left eye landmarks
  const upperLid = getLandmark(landmarks, LANDMARKS.LEFT_UPPER_LID);
  const lowerLid = getLandmark(landmarks, LANDMARKS.LEFT_LOWER_LID);
  const innerCorner = getLandmark(landmarks, LANDMARKS.LEFT_EYE_INNER);
  const outerCorner = getLandmark(landmarks, LANDMARKS.LEFT_EYE_OUTER);

  // Vertical distance (EYE HEIGHT)
  const eyeHeight = calculateDistance(upperLid, lowerLid);

  // Horizontal distance (EYE WIDTH)
  const eyeWidth = calculateDistance(innerCorner, outerCorner);

  // EAR = Eye Height / Eye Width
  return eyeHeight / eyeWidth;
}

// Previous EAR value for blink detection
let previousEAR = 0.3;
let maxEAR = 0.20; // Self-calibrating baseline
let blinkThresholdCrossed = false;

export function detectBlink(landmarks: Landmark[]): boolean {
  const currentEAR = calculateEyeAspectRatio(landmarks);
  
  // Dynamically calibrate open EAR
  if (currentEAR > maxEAR && currentEAR < 0.35) {
    maxEAR = currentEAR;
  }

  const closedThreshold = maxEAR * 0.65;
  const openThreshold = maxEAR * 0.85;

  if (currentEAR < closedThreshold && previousEAR >= closedThreshold) {
    blinkThresholdCrossed = true;
  }

  if (blinkThresholdCrossed && currentEAR > openThreshold && previousEAR <= openThreshold) {
    blinkThresholdCrossed = false;
    previousEAR = currentEAR;
    return true;
  }

  previousEAR = currentEAR;
  return false;
}

// Check if face is centered in frame
export function checkFaceCentered(landmarks: Landmark[]): boolean {
  const leftTemple = getLandmark(landmarks, LANDMARKS.LEFT_TEMPLE);
  const rightTemple = getLandmark(landmarks, LANDMARKS.RIGHT_TEMPLE);
  const noseTip = getLandmark(landmarks, LANDMARKS.NOSE_TIP);

  // Check horizontal centering (nose should be near center)
  const isHorizontallyCentered = noseTip.x > 0.35 && noseTip.x < 0.65;

  // Check face width is appropriate (not too close or too far)
  const faceWidth = rightTemple.x - leftTemple.x;
  const isAppropriateDistance = faceWidth > 0.25 && faceWidth < 0.6;

  return isHorizontallyCentered && isAppropriateDistance;
}

// Store initial nose position for comparison
let initialNoseX: number | null = null;

export function detectTurnLeft(landmarks: Landmark[]): boolean {
  const noseTip = getLandmark(landmarks, LANDMARKS.NOSE_TIP);
  const leftCheek = getLandmark(landmarks, LANDMARKS.LEFT_CHEEK);
  const rightCheek = getLandmark(landmarks, LANDMARKS.RIGHT_CHEEK);

  if (!noseTip || !leftCheek || !rightCheek) return false;

  // 1. Cheek ratio method: horizontal distances from nose tip to each cheek
  const leftDist = Math.abs(noseTip.x - leftCheek.x);
  const rightDist = Math.abs(noseTip.x - rightCheek.x);
  
  if (leftDist > 0 && rightDist > 0) {
    const ratio = leftDist / rightDist;
    // When turning left (screen-left in mirrored stream), nose gets closer to left cheek boundary
    if (ratio < 0.75) {
      return true;
    }
  }

  // 2. Fallback: nose movement relative to initial position
  if (initialNoseX === null) {
    initialNoseX = noseTip.x;
    return false;
  }

  const noseMovement = noseTip.x - initialNoseX;
  const faceWidth = rightCheek.x - leftCheek.x;
  const threshold = faceWidth * 0.08; // Optimized from 0.15 to 0.08 for faster response

  return noseMovement < -threshold;
}

// Reset function for liveness detection state
export function resetLivenessState(): void {
  previousEAR = 0.3;
  maxEAR = 0.20;
  blinkThresholdCrossed = false;
  initialNoseX = null;
}