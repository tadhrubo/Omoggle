"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface LeaderboardEntry {
  id: string;
  username: string;
  elo: number;
  tier: string;
  avatar_url: string | null;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
  Platinum: "#e5e4e2",
  Diamond: "#b9f2ff",
  Crown: "#ff6b6b",
  "God Tier": "#9d4edd"
};

const TIER_GLOW: Record<string, string> = {
  Bronze: "0 0 20px #cd7f3280",
  Silver: "0 0 20px #c0c0c080",
  Gold: "0 0 25px #ffd70090",
  Platinum: "0 0 30px #e5e4e290",
  Diamond: "0 0 40px #b9f2ff90",
  Crown: "0 0 50px #ff6b6b90",
  "God Tier": "0 0 60px #9d4edd90"
};

function getTierFromElo(elo: number): string {
  if (elo >= 2000) return "God Tier";
  if (elo >= 1700) return "Crown";
  if (elo >= 1500) return "Diamond";
  if (elo >= 1350) return "Platinum";
  if (elo >= 1200) return "Gold";
  if (elo >= 1000) return "Silver";
  return "Bronze";
}

export default function LeaderboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, elo, tier, avatar_url")
        .order("elo", { ascending: false })
        .limit(50);

      if (data) setEntries(data);
      setLoading(false);
    };

    fetchLeaderboard();
  }, [supabase]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ef4444", fontFamily: "monospace", letterSpacing: "2px" }}>LOADING LEGENDS...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "30px", padding: "0 10px" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: "14px" }}>← LOBBY</button>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: "24px", letterSpacing: "3px", margin: 0 }}>GLOBAL RANKINGS</h1>
        <div style={{ width: "60px" }}></div>
      </div>

      {/* Top 3 Legendary Cards */}
      {entries.length >= 3 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "40px", flexWrap: "wrap" }}>
          {/* 2nd Place */}
          <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: "2px solid #c0c0c0", borderRadius: "16px", padding: "20px", width: "140px", textAlign: "center", boxShadow: "0 0 30px #c0c0c040" }}>
            <div style={{ fontSize: "40px", marginBottom: "5px" }}>🥈</div>
            <div style={{ color: "white", fontWeight: "bold", fontSize: "14px", marginBottom: "5px" }}>{entries[1]?.username || "—"}</div>
            <div style={{ color: "#c0c0c0", fontSize: "12px", fontFamily: "monospace" }}>{entries[1]?.elo || 0} ELO</div>
            <div style={{ color: TIER_COLORS[entries[1]?.tier || "Silver"], fontSize: "10px", marginTop: "5px" }}>{entries[1]?.tier || "Silver"}</div>
          </div>

          {/* 1st Place */}
          <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: "2px solid #ffd700", borderRadius: "16px", padding: "25px", width: "160px", textAlign: "center", boxShadow: "0 0 50px #ffd70060" }}>
            <div style={{ fontSize: "50px", marginBottom: "5px" }}>👑</div>
            <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: "16px", marginBottom: "5px", textShadow: "0 0 10px #ffd700" }}>{entries[0]?.username || "—"}</div>
            <div style={{ color: "#ffd700", fontSize: "14px", fontFamily: "monospace" }}>{entries[0]?.elo || 0} ELO</div>
            <div style={{ color: TIER_COLORS[entries[0]?.tier || "Gold"], fontSize: "11px", marginTop: "5px" }}>{entries[0]?.tier || "Gold"}</div>
          </div>

          {/* 3rd Place */}
          <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: "2px solid #cd7f32", borderRadius: "16px", padding: "20px", width: "140px", textAlign: "center", boxShadow: "0 0 30px #cd7f3240" }}>
            <div style={{ fontSize: "40px", marginBottom: "5px" }}>🥉</div>
            <div style={{ color: "white", fontWeight: "bold", fontSize: "14px", marginBottom: "5px" }}>{entries[2]?.username || "—"}</div>
            <div style={{ color: "#cd7f32", fontSize: "12px", fontFamily: "monospace" }}>{entries[2]?.elo || 0} ELO</div>
            <div style={{ color: TIER_COLORS[entries[2]?.tier || "Bronze"], fontSize: "10px", marginTop: "5px" }}>{entries[2]?.tier || "Bronze"}</div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", padding: "10px 20px", color: "#71717a", fontSize: "11px", fontFamily: "monospace", letterSpacing: "1px", borderBottom: "1px solid #27272a" }}>
          <span>RNK</span>
          <span>PLAYER</span>
          <span style={{ textAlign: "right" }}>ELO</span>
          <span style={{ textAlign: "right" }}>TIER</span>
        </div>

        {entries.slice(3).map((entry, index) => {
          const rank = index + 4;
          const tierColor = TIER_COLORS[entry.tier] || "#c0c0c0";

          return (
            <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", padding: "12px 20px", alignItems: "center", borderBottom: "1px solid #18181b", transition: "background 0.2s" }}>
              <span style={{ color: "#52525b", fontFamily: "monospace", fontSize: "12px" }}>#{rank}</span>
              <span style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{entry.username}</span>
              <span style={{ color: "#a1a1aa", fontFamily: "monospace", fontSize: "12px", textAlign: "right" }}>{entry.elo}</span>
              <span style={{ color: tierColor, fontSize: "11px", textAlign: "right", textShadow: `0 0 10px ${tierColor}40` }}>{entry.tier}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}