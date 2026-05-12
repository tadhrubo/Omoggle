export type Profile = {
  id: string;
  username: string;
  elo_score: number;
  tier: string;
  battles_won: number;
  battles_lost: number;
  is_premium: boolean;
  created_at: string;
};

export type ArenaQueue = {
  id: string;
  peer_id: string;
  user_id: string | null;
  status: "searching" | "matched" | "playing" | "completed";
  target_peer_id: string | null;
  created_at: string;
};

export type Tier = "Unranked" | "Normie" | "Average" | "AboveAvg" | "Pro" | "Elite" | "God";

export const TIER_COLORS: Record<Tier, string> = {
  Unranked: "text-zinc-500",
  Normie: "text-zinc-400",
  Average: "text-zinc-300",
  AboveAvg: "text-blue-400",
  Pro: "text-red-400",
  Elite: "text-purple-400",
  God: "text-yellow-400",
};