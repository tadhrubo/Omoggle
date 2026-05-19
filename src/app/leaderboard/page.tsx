"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface LeaderboardEntry {
  id: string;
  username: string;
  elo: number;
  tier: string;
  avatar_url: string | null;
}

import { getPrestigeRankInfo } from "@/utils/eloMath";

const getTier = (elo: number) => {
  const info = getPrestigeRankInfo(elo);
  return {
    label: info.name,
    color: info.color,
    glow: info.glow,
    bg: info.bg,
    border: info.border
  };
};

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "30px", padding: "0 10px 0 75px" }}>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: "14px" }}>← LOBBY</button>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: "24px", letterSpacing: "3px", margin: 0 }}>GLOBAL RANKINGS</h1>
        <div style={{ width: "60px" }}></div>
      </div>

      {/* Top 3 Legendary Cards */}
      {entries.length >= 3 && (() => {
        const tier1 = getTier(entries[0]?.elo || 0);
        const tier2 = getTier(entries[1]?.elo || 0);
        const tier3 = getTier(entries[2]?.elo || 0);
        return (
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "40px", flexWrap: "wrap" }}>
            {/* 2nd Place */}
            <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: `2px solid ${tier2.color}`, borderRadius: "16px", padding: "20px", width: "140px", textAlign: "center", boxShadow: `0 0 30px ${tier2.color}40` }}>
              <div style={{ fontSize: "40px", marginBottom: "5px" }}>🥈</div>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px", marginBottom: "5px" }}>{entries[1]?.username || "—"}</div>
              <div style={{ color: "#c0c0c0", fontSize: "12px", fontFamily: "monospace" }}>{entries[1]?.elo || 0} ELO</div>
              <div style={{ color: tier2.color, textShadow: tier2.glow, fontSize: "10px", marginTop: "5px", fontWeight: "bold" }}>{tier2.label}</div>
            </div>

            {/* 1st Place */}
            <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: `2px solid ${tier1.color}`, borderRadius: "16px", padding: "25px", width: "160px", textAlign: "center", boxShadow: `0 0 50px ${tier1.color}60` }}>
              <div style={{ fontSize: "50px", marginBottom: "5px" }}>👑</div>
              <div style={{ color: tier1.color, fontWeight: "bold", fontSize: "16px", marginBottom: "5px", textShadow: tier1.glow }}>{entries[0]?.username || "—"}</div>
              <div style={{ color: tier1.color, fontSize: "14px", fontFamily: "monospace" }}>{entries[0]?.elo || 0} ELO</div>
              <div style={{ color: tier1.color, textShadow: tier1.glow, fontSize: "11px", marginTop: "5px", fontWeight: "bold" }}>{tier1.label}</div>
            </div>

            {/* 3rd Place */}
            <div style={{ background: "linear-gradient(180deg, #27272a 0%, #18181b 100%)", border: `2px solid ${tier3.color}`, borderRadius: "16px", padding: "20px", width: "140px", textAlign: "center", boxShadow: `0 0 30px ${tier3.color}40` }}>
              <div style={{ fontSize: "40px", marginBottom: "5px" }}>🥉</div>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "14px", marginBottom: "5px" }}>{entries[2]?.username || "—"}</div>
              <div style={{ color: "#cd7f32", fontSize: "12px", fontFamily: "monospace" }}>{entries[2]?.elo || 0} ELO</div>
              <div style={{ color: tier3.color, textShadow: tier3.glow, fontSize: "10px", marginTop: "5px", fontWeight: "bold" }}>{tier3.label}</div>
            </div>
          </div>
        );
      })()}

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
          const tierInfo = getTier(entry.elo || 0);

          return (
            <div key={entry.id} onClick={() => router.push(`/profile/${entry.id}`)} style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px 80px", padding: "12px 20px", alignItems: "center", borderBottom: "1px solid #18181b", transition: "background 0.2s", cursor: "pointer" }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <span style={{ color: "#52525b", fontFamily: "monospace", fontSize: "12px" }}>#{rank}</span>
              <span style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>{entry.username}</span>
              <span style={{ color: "#a1a1aa", fontFamily: "monospace", fontSize: "12px", textAlign: "right" }}>{entry.elo}</span>
              <span style={{ color: tierInfo.color, fontSize: "11px", textAlign: "right", textShadow: tierInfo.glow !== "none" ? tierInfo.glow : `0 0 10px ${tierInfo.color}40` }}>{tierInfo.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}