// Dynamically adjusts volatility based on rank
// High ranks are harder to climb; low ranks are easier to escape
export function getKFactor(elo: number): number {
  if (elo >= 2200) return 16; // TRUE ADAM / TERRACHAD (Highly stable)
  if (elo >= 1600) return 24; // CHAD / CHADLITE (Medium stability)
  return 32;                  // HTN / MTN / LTN (High volatility)
}

// Standard Competitive ELO Formula
export function calculateEloUpdate(myElo: number, opponentElo: number, isWinner: boolean) {
  const kFactor = getKFactor(myElo);
  
  // Calculate expected win probability (0.0 to 1.0)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
  
  // Actual score (1 for win, 0 for loss)
  const actualScore = isWinner ? 1 : 0;
  
  // Calculate new ELO
  const newElo = Math.round(myElo + kFactor * (actualScore - expectedScore));
  const eloChange = newElo - myElo;
  
  return { newElo, eloChange };
}

export interface RankGroup {
  name: string;
  minElo: number;
  color: string;
  glow: string;
  bg: string;
  border: string;
}

export const RANK_GROUPS: RankGroup[] = [
  { name: "TRUE ADAM", minElo: 2500, color: "#ffffff", glow: "0 0 20px #fff", bg: "linear-gradient(135deg, #09090b 0%, #1e1b4b 50%, #311042 100%)", border: "#ffffff" },
  { name: "TERRACHAD", minElo: 2200, color: "#fbbf24", glow: "0 0 15px #fbbf24", bg: "linear-gradient(135deg, #09090b 0%, #78350f 50%, #451a03 100%)", border: "#fbbf24" },
  { name: "CHAD", minElo: 1900, color: "#ef4444", glow: "0 0 10px #ef4444", bg: "linear-gradient(135deg, #09090b 0%, #7f1d1d 50%, #450a0a 100%)", border: "#ef4444" },
  { name: "CHADLITE", minElo: 1600, color: "#c084fc", glow: "0 0 8px #c084fc", bg: "linear-gradient(135deg, #09090b 0%, #581c87 100%)", border: "#c084fc" },
  { name: "HTN", minElo: 1300, color: "#3b82f6", glow: "none", bg: "linear-gradient(135deg, #09090b 0%, #1e3a8a 100%)", border: "#3b82f6" },
  { name: "MTN", minElo: 1000, color: "#22c55e", glow: "none", bg: "linear-gradient(135deg, #09090b 0%, #064e3b 100%)", border: "#22c55e" },
  { name: "LTN", minElo: 750, color: "#60a5fa", glow: "none", bg: "linear-gradient(135deg, #09090b 0%, #172554 100%)", border: "#60a5fa" },
  { name: "SUB5", minElo: 500, color: "#9ca3af", glow: "none", bg: "linear-gradient(135deg, #09090b 0%, #374151 100%)", border: "#9ca3af" },
  { name: "NPC", minElo: 250, color: "#6b7280", glow: "none", bg: "linear-gradient(135deg, #09090b 0%, #1f2937 100%)", border: "#6b7280" },
  { name: "DOOMER", minElo: 0, color: "#4b5563", glow: "none", bg: "linear-gradient(135deg, #050505 0%, #111827 100%)", border: "#4b5563" },
];

// Custom Prestige Hierarchy Mapping based on ELO
export function getPrestigeRankInfo(elo: number): RankGroup {
  return RANK_GROUPS.find(r => elo >= r.minElo) || RANK_GROUPS[RANK_GROUPS.length - 1];
}

export function getPrestigeRank(elo: number): string {
  return getPrestigeRankInfo(elo).name;
}