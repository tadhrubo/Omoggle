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

// Custom Prestige Hierarchy Mapping based on ELO
export function getPrestigeRank(elo: number): string {
  if (elo >= 2500) return "TRUE ADAM";
  if (elo >= 2200) return "TERRACHAD";
  if (elo >= 1900) return "CHAD";
  if (elo >= 1600) return "CHADLITE";
  if (elo >= 1300) return "HTN";
  if (elo >= 1000) return "MTN";
  if (elo >= 750) return "LTN";
  if (elo >= 500) return "SUB5";
  if (elo >= 250) return "NPC";
  return "DOOMER";
}