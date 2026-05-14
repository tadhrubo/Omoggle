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
  };
}

export function calculateMogScore(result: FaceLandmarkerResult): MogScoreResult {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return {
      score: 1.0,
      metrics: {
        canthalTilt: "0.00°",
        symmetry: "0.0%",
        jawline: "0.00",
      },
    };
  }

  const landmarks = result.faceLandmarks[0] as unknown as Landmark[];

  // Calculate base score from structure (3.0 to 8.0)
  const structureScore = calculateStructureScore(landmarks);
  const baseScore = Math.min(8, Math.max(3, 3 + structureScore));

  // Calculate metrics
  const canthalTilt = calculateCanthalTilt(landmarks);
  const symmetry = calculateSymmetry(landmarks);
  const jawline = calculateJawlineRatio(landmarks);

  // Reduced viral variance (max 0.5) - score is heavily weighted by actual facial math
  const viralVariance = Math.random() * 0.5;

  // Final score capped at 9.9
  const finalScore = Math.min(9.9, baseScore + viralVariance);

  return {
    score: Math.round(finalScore * 10) / 10, // Round to 1 decimal
    metrics: {
      canthalTilt: canthalTilt.toFixed(2) + "°",
      symmetry: (symmetry * 100).toFixed(1) + "%",
      jawline: jawline.toFixed(2),
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
let blinkThresholdCrossed = false;

export function detectBlink(landmarks: Landmark[]): boolean {
  const currentEAR = calculateEyeAspectRatio(landmarks);
  console.log("Current EAR:", currentEAR.toFixed(3));

  // Blink detection logic:
  // 1. EAR drops below threshold (eye closes)
  // 2. EAR rises back above threshold (eye opens again)
  if (currentEAR < 0.22 && previousEAR >= 0.22) {
    blinkThresholdCrossed = true;
  }

  if (blinkThresholdCrossed && currentEAR > 0.25 && previousEAR <= 0.25) {
    // Reset and return true (blink completed)
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

  // Store initial position on first call
  if (initialNoseX === null) {
    initialNoseX = noseTip.x;
    return false;
  }

  // Calculate how far nose has moved from initial position
  const noseMovement = noseTip.x - initialNoseX;

  // When user turns head left (from camera perspective, mirroring),
  // the nose moves toward the right side of the frame
  // Threshold: significant movement means nose moved more than 15% of face width
  const faceWidth = rightCheek.x - leftCheek.x;
  const threshold = faceWidth * 0.15;

  return noseMovement < -threshold;
}

// Reset function for liveness detection state
export function resetLivenessState(): void {
  previousEAR = 0.3;
  blinkThresholdCrossed = false;
  initialNoseX = null;
}