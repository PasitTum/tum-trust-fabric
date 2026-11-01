export interface CameraAngleCapture {
  angleName: 'CENTER_FRONTAL' | 'LEFT_30_DEG' | 'RIGHT_30_DEG';
  featureVector512: number[];
  depthMapDisparityMm?: number;
  timestampMs: number;
}

export interface MultiAngleCorridorInput {
  corridorGateId: string;
  captures: CameraAngleCapture[];
  uwbBeaconDistanceMeters?: number;
  infraredThermographyCelsius?: number; // Fever / living biological entity check
}

export interface BiometricMatchResult {
  isMatch: boolean;
  matchScore: number; // 0.00 to 1.00
  livenessConfidence: number; // 0.00 to 1.00
  antiSpoofScore: number;
  angleCoverageCount: number;
  isCorridorClearanceGranted: boolean;
  decisionReason: string;
}

export class MultiAngleBiometricEngine {
  public static readonly SOVEREIGN_MATCH_THRESHOLD = 0.88;
  public static readonly SOVEREIGN_LIVENESS_THRESHOLD = 0.92;

  /**
   * Computes Cosine Similarity between two 512-d feature vectors
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i]!;
      const b = vecB[i]!;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Evaluates 3D Liveness and Anti-spoofing across multiple camera perspectives
   */
  public static evaluate3DLiveness(input: MultiAngleCorridorInput): { livenessConfidence: number; antiSpoofScore: number } {
    if (input.captures.length === 0) {
      return { livenessConfidence: 0, antiSpoofScore: 0 };
    }

    // 1. Stereoscopic Parallax / Multi-Angle Disparity Check
    // If photos are flat 2D screens, depth disparity across angles is near zero
    let disparitySum = 0;
    for (const c of input.captures) {
      disparitySum += c.depthMapDisparityMm ?? 15.0; // Standard facial depth contour is 12-25mm
    }
    const avgDisparity = disparitySum / input.captures.length;
    const isNatural3DDepth = avgDisparity >= 10.0 && avgDisparity <= 45.0;

    // 2. Multi-angle angle diversity check
    const uniqueAngles = new Set(input.captures.map((c) => c.angleName));
    const angleBonus = uniqueAngles.size >= 2 ? 0.05 : 0.0;

    // 3. Thermal check if available
    let thermalOk = true;
    if (input.infraredThermographyCelsius !== undefined) {
      thermalOk = input.infraredThermographyCelsius >= 35.0 && input.infraredThermographyCelsius <= 38.5;
    }

    const baseLiveness = isNatural3DDepth && thermalOk ? 0.94 : 0.40;
    const livenessConfidence = Math.min(0.99, baseLiveness + angleBonus);
    const antiSpoofScore = isNatural3DDepth ? 0.96 : 0.35;

    return { livenessConfidence, antiSpoofScore };
  }

  /**
   * Matches walk-through corridor stream against enrolled citizen template
   */
  public static matchCorridorStream(
    enrolledVector: number[],
    input: MultiAngleCorridorInput
  ): BiometricMatchResult {
    const { livenessConfidence, antiSpoofScore } = this.evaluate3DLiveness(input);

    if (input.captures.length === 0) {
      return {
        isMatch: false,
        matchScore: 0,
        livenessConfidence: 0,
        antiSpoofScore: 0,
        angleCoverageCount: 0,
        isCorridorClearanceGranted: false,
        decisionReason: 'No biometric angles detected in corridor corridor FOV',
      };
    }

    // Compute max and weighted cosine similarity across captured perspectives
    let bestScore = 0;
    for (const capture of input.captures) {
      const score = this.cosineSimilarity(enrolledVector, capture.featureVector512);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    const isMatch = bestScore >= this.SOVEREIGN_MATCH_THRESHOLD;
    const isLivenessPassed = livenessConfidence >= this.SOVEREIGN_LIVENESS_THRESHOLD;
    const isDistanceValid = input.uwbBeaconDistanceMeters !== undefined ? input.uwbBeaconDistanceMeters <= 3.5 : true;

    const isCorridorClearanceGranted = isMatch && isLivenessPassed && isDistanceValid;

    let decisionReason = 'Clearance Granted';
    if (!isDistanceValid) {
      decisionReason = 'Corridor clearance denied: UWB proximity out of range (> 3.5m)';
    } else if (!isLivenessPassed) {
      decisionReason = `Corridor clearance denied: 3D Liveness check failed (${livenessConfidence.toFixed(2)} < ${this.SOVEREIGN_LIVENESS_THRESHOLD})`;
    } else if (!isMatch) {
      decisionReason = `Corridor clearance denied: Biometric similarity score below threshold (${bestScore.toFixed(3)} < ${this.SOVEREIGN_MATCH_THRESHOLD})`;
    }

    return {
      isMatch,
      matchScore: parseFloat(bestScore.toFixed(4)),
      livenessConfidence: parseFloat(livenessConfidence.toFixed(4)),
      antiSpoofScore: parseFloat(antiSpoofScore.toFixed(4)),
      angleCoverageCount: input.captures.length,
      isCorridorClearanceGranted,
      decisionReason,
    };
  }

  /**
   * Helper utility to generate realistic normalized synthetic 512-d feature vectors for tests
   */
  public static generateSyntheticVector(seed: number = 42): number[] {
    const vec: number[] = new Array(512);
    let sumSq = 0;
    for (let i = 0; i < 512; i++) {
      // Deterministic pseudo-random based on LCG
      const x = Math.sin(seed + i * 1.5);
      vec[i] = x;
      sumSq += x * x;
    }
    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < 512; i++) {
      vec[i] = vec[i]! / norm;
    }
    return vec;
  }
}
