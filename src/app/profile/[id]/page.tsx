"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Flame, Trophy, Skull, Eye, Swords, Crown, ArrowLeft, Target } from "lucide-react";

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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [nemeses, setNemeses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"graveyard" | "rivals">("graveyard");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decayTimer, setDecayTimer] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Fetch profile
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (!p) { setLoading(false); return; }
      setProfile(p);

      // Check if own profile
      const { data: { session } } = await supabase.auth.getSession();
      const own = session?.user?.id === userId;
      setIsOwnProfile(own);

      // Increment views if not own profile
      if (!own) {
        supabase.rpc("increment_profile_views", { p_profile_id: userId }).then();
      }

      // Aura decay timer
      if (p.elo >= 1900 && p.last_ranked_at) {
        const decayStart = new Date(p.last_ranked_at);
        decayStart.setDate(decayStart.getDate() + 7);
        const now = new Date();
        const diff = decayStart.getTime() - now.getTime();
        if (diff > 0) {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          setDecayTimer(`${h}h ${m}m`);
        } else {
          setDecayTimer("DECAYING");
        }
      }

      // Fetch matches
      const { data: m } = await supabase
        .from("matches")
        .select("*")
        .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (m) {
        // Fetch opponent profiles
        const opponentIds = m.map(match => match.winner_id === userId ? match.loser_id : match.winner_id).filter(Boolean);
        const uniqueIds = [...new Set(opponentIds)];
        let opponentMap: Record<string, any> = {};
        if (uniqueIds.length > 0) {
          const { data: opponents } = await supabase.from("profiles").select("id, username, avatar_url, tier").in("id", uniqueIds);
          if (opponents) opponents.forEach(o => opponentMap[o.id] = o);
        }
        setMatches(m.map(match => ({
          ...match,
          isWin: match.winner_id === userId,
          opponent: opponentMap[match.winner_id === userId ? match.loser_id : match.winner_id] || null
        })));
      }

      // Fetch nemeses
      const { data: n } = await supabase
        .from("nemeses")
        .select("*, nemesis:profiles!nemesis_id(id, username, avatar_url, elo, tier)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (n) setNemeses(n);

      setLoading(false);
    };
    load();
  }, [userId, supabase]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#ef4444", fontFamily: "monospace", letterSpacing: "2px" }}>LOADING FIGHTER CARD...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#09090b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <span style={{ color: "#ef4444", fontFamily: "monospace", fontSize: "24px" }}>FIGHTER NOT FOUND</span>
        <button onClick={() => router.push("/lobby")} style={{ color: "#71717a", background: "none", border: "1px solid #27272a", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Return to Lobby</button>
      </div>
    );
  }

  const tier = getTier(profile.elo || 1200);
  const mogRate = (profile.total_mogs || 0) + (profile.total_mogged || 0) > 0
    ? Math.round(((profile.total_mogs || 0) / ((profile.total_mogs || 0) + (profile.total_mogged || 0))) * 100)
    : 0;
  const isOnFire = (profile.current_streak || 0) >= 3;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "white", fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        @keyframes flame { 0%,100%{box-shadow:0 0 20px #ef4444,0 0 40px #ff660080,0 0 60px #ef444440} 50%{box-shadow:0 0 30px #ff6600,0 0 50px #ef4444,0 0 80px #ffd70060} }
        @keyframes auraPulse { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes fireGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
        @keyframes decayPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      {/* ═══ ZONE 1: AURA HEADER ═══ */}
      <div style={{
        background: (tier as any).bg || "linear-gradient(135deg, #0a0a0a 0%, #18181b 100%)", backgroundSize: "200% 200%", animation: profile.elo >= 2500 ? "auraPulse 4s ease infinite" : "none",
        padding: "80px 20px 40px", borderBottom: `2px solid ${(tier as any).border || tier.color}40`, position: "relative"
      }}>
        {/* Back Button */}
        <button onClick={() => router.back()} style={{ position: "absolute", top: "24px", left: "85px", color: "#71717a", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace" }}>
          <ArrowLeft size={16} /> BACK
        </button>

        <div style={{ maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          {/* Avatar */}
          <div style={{ position: "relative" }}>
            <div style={{
              width: "120px", height: "120px", borderRadius: "50%", overflow: "hidden",
              border: `3px solid ${tier.color}`, animation: isOnFire ? "flame 1.5s ease-in-out infinite" : "none",
              boxShadow: isOnFire ? undefined : `0 0 20px ${tier.color}30`
            }}>
              {profile.avatar_url
                ? <Image src={profile.avatar_url} alt="" fill style={{ objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", backgroundColor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", fontWeight: "900", color: tier.color }}>{(profile.username || "?")[0].toUpperCase()}</div>
              }
            </div>
            {isOnFire && <div style={{ position: "absolute", top: "-10px", right: "-5px", fontSize: "28px", animation: "fireGlow 1s infinite" }}>🔥</div>}
            {(profile.current_streak || 0) >= 3 && (
              <div style={{ position: "absolute", bottom: "-8px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#ef4444", color: "white", fontSize: "10px", fontWeight: "900", padding: "2px 10px", borderRadius: "99px", whiteSpace: "nowrap" }}>
                {profile.current_streak} STREAK
              </div>
            )}
          </div>

          {/* Name & Tier */}
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: "900", margin: "0 0 6px 0", color: "white" }}>{profile.username}</h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <span style={{ color: tier.color, textShadow: tier.glow, fontWeight: "900", fontSize: "13px", letterSpacing: "2px" }}>{tier.label}</span>
              <span style={{ color: "#52525b" }}>•</span>
              <span style={{ color: "white", fontWeight: "900", fontSize: "20px" }}>{profile.elo || 1200}</span>
              <span style={{ color: "#52525b", fontSize: "12px", fontFamily: "monospace" }}>ELO</span>
            </div>
            {(profile.peak_elo || 1200) > (profile.elo || 1200) && (
              <div style={{ color: "#71717a", fontSize: "11px", fontFamily: "monospace", marginTop: "6px" }}>
                PEAK: <span style={{ color: getTier(profile.peak_elo).color, fontWeight: "bold" }}>{profile.peak_elo}</span>
              </div>
            )}
          </div>

          {/* Aura Decay Warning */}
          {decayTimer && (
            <div style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef444430", borderRadius: "8px",
              padding: "8px 20px", fontSize: "11px", fontFamily: "monospace", color: "#ef4444",
              animation: decayTimer === "DECAYING" ? "decayPulse 2s infinite" : "none"
            }}>
              {decayTimer === "DECAYING" ? "⚠ AURA DECAYING — ENTER ARENA" : `AURA DECAYS IN ${decayTimer}`}
            </div>
          )}

          {/* Profile Views */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#3f3f46", fontSize: "11px" }}>
            <Eye size={12} /> {profile.profile_views || 0} views
          </div>
        </div>
      </div>

      {/* ═══ ZONE 2: STATS GRID ═══ */}
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "30px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "30px" }}>
          <StatBox icon={<Flame size={16} />} label="CURRENT STREAK" value={profile.current_streak || 0} color={isOnFire ? "#ef4444" : "#71717a"} glow={isOnFire} />
          <StatBox icon={<Trophy size={16} />} label="BEST STREAK" value={profile.highest_streak || 0} color="#fbbf24" />
          <StatBox icon={<Crown size={16} />} label="MOG RATE" value={`${mogRate}%`} color="#a855f7" />
          <StatBox icon={<Swords size={16} />} label="TOTAL MOGS" value={profile.total_mogs || 0} color="#22c55e" />
          <StatBox icon={<Skull size={16} />} label="TOTAL MOGGED" value={profile.total_mogged || 0} color="#ef4444" />
          <StatBox icon={<Target size={16} />} label="PEAK ELO" value={profile.peak_elo || 1200} color={getTier(profile.peak_elo || 1200).color} />
        </div>

        {/* ═══ ZONE 3: TABS ═══ */}
        <div style={{ display: "flex", gap: "20px", borderBottom: "1px solid #18181b", marginBottom: "20px" }}>
          <button onClick={() => setActiveTab("graveyard")} style={{ background: "none", border: "none", color: activeTab === "graveyard" ? "white" : "#3f3f46", fontWeight: "bold", fontSize: "13px", cursor: "pointer", paddingBottom: "12px", borderBottom: activeTab === "graveyard" ? "2px solid #ef4444" : "none", letterSpacing: "2px" }}>
            ☠ GRAVEYARD
          </button>
          <button onClick={() => setActiveTab("rivals")} style={{ background: "none", border: "none", color: activeTab === "rivals" ? "white" : "#3f3f46", fontWeight: "bold", fontSize: "13px", cursor: "pointer", paddingBottom: "12px", borderBottom: activeTab === "rivals" ? "2px solid #fbbf24" : "none", letterSpacing: "2px" }}>
            ⚔ RIVALS
          </button>
        </div>

        {/* GRAVEYARD TAB */}
        {activeTab === "graveyard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {matches.length === 0 && <div style={{ color: "#3f3f46", fontFamily: "monospace", textAlign: "center", padding: "40px" }}>NO BATTLES YET</div>}
            {matches.map((m, i) => (
              <div key={m.id || i} style={{
                display: "flex", alignItems: "center", gap: "15px", padding: "14px 16px",
                backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "10px",
                borderLeft: `3px solid ${m.isWin ? "#22c55e" : "#ef4444"}`, position: "relative", overflow: "hidden"
              }}>
                {/* Opponent Avatar */}
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, position: "relative", filter: m.isWin ? "grayscale(100%)" : "none", opacity: m.isWin ? 0.6 : 1 }}>
                  {m.opponent?.avatar_url
                    ? <Image src={m.opponent.avatar_url} alt="" fill style={{ objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", backgroundColor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "900", color: "#52525b" }}>{(m.opponent?.username || "?")[0]}</div>
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: "bold", fontSize: "14px", color: "white" }}>{m.opponent?.username || "Anonymous"}</span>
                    <span style={{ fontSize: "10px", color: "#3f3f46", textTransform: "uppercase" }}>{m.mode}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#52525b", marginTop: "2px", fontFamily: "monospace" }}>
                    {m.winner_score?.toFixed(1)} - {m.loser_score?.toFixed(1)}
                    {m.elo_change > 0 && <span style={{ color: m.isWin ? "#22c55e" : "#ef4444", marginLeft: "8px" }}>{m.isWin ? "+" : "-"}{m.elo_change}</span>}
                  </div>
                </div>

                {/* Verdict Stamp */}
                <div style={{
                  fontSize: "11px", fontWeight: "900", letterSpacing: "1px", padding: "4px 12px",
                  borderRadius: "4px", transform: "rotate(-3deg)",
                  backgroundColor: m.isWin ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: m.isWin ? "#22c55e" : "#ef4444",
                  border: `1px solid ${m.isWin ? "#22c55e30" : "#ef444430"}`
                }}>
                  {m.isWin ? "MOGGED" : "GOT MOGGED"}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RIVALS TAB */}
        {activeTab === "rivals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {nemeses.length === 0 && <div style={{ color: "#3f3f46", fontFamily: "monospace", textAlign: "center", padding: "40px" }}>NO RIVALS YET — KEEP BATTLING</div>}
            {nemeses.map((n: any) => {
              const nTier = getTier(n.nemesis?.elo || 1200);
              return (
                <div key={n.id} onClick={() => router.push(`/profile/${n.nemesis?.id}`)} style={{
                  display: "flex", alignItems: "center", gap: "15px", padding: "16px",
                  backgroundColor: "rgba(251, 191, 36, 0.03)", borderRadius: "10px",
                  border: "1px solid #fbbf2420", cursor: "pointer", transition: "all 0.2s"
                }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", border: `2px solid ${nTier.color}` }}>
                    {n.nemesis?.avatar_url
                      ? <Image src={n.nemesis.avatar_url} alt="" fill style={{ objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", backgroundColor: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "900", color: nTier.color }}>{(n.nemesis?.username || "?")[0]}</div>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "900", fontSize: "15px" }}>{n.nemesis?.username}</div>
                    <div style={{ fontSize: "11px", color: nTier.color, fontFamily: "monospace" }}>{nTier.label} • {n.nemesis?.elo} ELO</div>
                  </div>
                  <div style={{ fontSize: "10px", color: "#fbbf24", fontWeight: "bold", letterSpacing: "1px" }}>
                    {n.reason === "streak_breaker" ? "BROKE YOUR STREAK" : "CLOSE RIVAL"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color, glow = false }: { icon: React.ReactNode; label: string; value: string | number; color: string; glow?: boolean }) {
  return (
    <div style={{
      backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid #18181b", borderRadius: "12px",
      padding: "16px", textAlign: "center", transition: "all 0.2s",
      boxShadow: glow ? `0 0 15px ${color}30` : "none"
    }}>
      <div style={{ color, marginBottom: "8px", display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: "900", color: "white", marginBottom: "4px" }}>{value}</div>
      <div style={{ fontSize: "9px", color: "#52525b", letterSpacing: "1px", fontWeight: "bold" }}>{label}</div>
    </div>
  );
}
