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