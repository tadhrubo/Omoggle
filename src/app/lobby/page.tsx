"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Swords, Trophy, BarChart3, ShieldCheck, Star, MessageCircle, Send } from "lucide-react";

// Community-accurate ranks with Sub-Tier logic (1-5)
const RANK_GROUPS = [
  { name: "TRUE ADAM", minElo: 2500, color: "#ffffff", levels: 1 }, // Unique Tier
  { name: "TERRACHAD", minElo: 2200, color: "#fbbf24", levels: 5 },
  { name: "CHAD", minElo: 1900, color: "#ef4444", levels: 5 },
  { name: "CHADLITE", minElo: 1600, color: "#a855f7", levels: 5 },
  { name: "HTN", minElo: 1300, color: "#3b82f6", levels: 5 },
  { name: "MTN", minElo: 1000, color: "#22c55e", levels: 5 },
  { name: "LTN", minElo: 0, color: "#71717a", levels: 5 },
];

export default function Lobby() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modes" | "ranks">("modes");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [currentTier, setCurrentTier] = useState<string>("Silver");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      // Fetch leaderboard
      const { data: leaders } = await supabase.from('profiles').select('*').order('elo', { ascending: false }).limit(10);
      if (leaders) setLeaderboard(leaders);

      // Fetch current user and their recent matches
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        const { data: profile } = await supabase.from('profiles').select('username, tier').eq('id', session.user.id).single();
        if (profile) {
          setCurrentUsername(profile.username || "Mogger");
          setCurrentTier(profile.tier || "Silver");
        }
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .or(`winner_id.eq.${session.user.id},loser_id.eq.${session.user.id}`)
          .order('created_at', { ascending: false })
          .limit(5);
        if (matches) setRecentMatches(matches);
      }

      // Fetch recent chat messages
      const { data: messages } = await supabase.from('global_chat').select('*').order('created_at', { ascending: false }).limit(50);
      if (messages) setChatMessages(messages.reverse());
    };
    fetchData();
  }, [supabase]);

  // Real-time chat subscription
  useEffect(() => {
    const channel = supabase.channel('global_chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_chat' }, (payload) => {
      setChatMessages(prev => [...prev, payload.new]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    await supabase.from('global_chat').insert([{ user_id: currentUserId, username: currentUsername, message: chatInput.trim(), tier: currentTier }]);
    setChatInput("");
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendChatMessage();
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#050505", color: "white", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        {/* Header & Tab Switcher */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "50px", borderBottom: "1px solid #18181b" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
              <span style={{ color: "#ef4444", fontWeight: "900", fontSize: "1.5rem" }}>OMOGGLE</span>
              <span style={{ backgroundColor: "#ef4444", color: "white", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px" }}>BETA</span>
            </div>
            <div style={{ display: "flex", gap: "30px" }}>
              <button 
                onClick={() => setActiveTab("modes")}
                style={{ background: "none", border: "none", color: activeTab === "modes" ? "white" : "#3f3f46", fontSize: "14px", fontWeight: "bold", cursor: "pointer", paddingBottom: "15px", borderBottom: activeTab === "modes" ? "2px solid #ef4444" : "none" }}
              >BATTLE MODES</button>
              <button 
                onClick={() => setActiveTab("ranks")}
                style={{ background: "none", border: "none", color: activeTab === "ranks" ? "white" : "#3f3f46", fontSize: "14px", fontWeight: "bold", cursor: "pointer", paddingBottom: "15px", borderBottom: activeTab === "ranks" ? "2px solid #ef4444" : "none" }}
              >GLOBAL RANKS</button>
            </div>
          </div>
          <button onClick={() => router.push("/arena")} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", padding: "12px 30px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "14px", marginBottom: "15px" }}>ENTER ARENA</button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "40px" }}>
          
          {/* Left Panel: Active Content */}
          <main>
            {activeTab === "modes" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <ModeCard 
    icon={<Swords/>} 
    title="CASUAL 1V1" 
    desc="Random opponent. No ELO risk." 
    color="#ef4444" 
    active 
    onClick={() => router.push("/arena?mode=casual")} // <-- ADDED PARAM
  />
                <ModeCard 
                  icon={<Trophy/>} 
                  title="RANKED MATCH" 
                  desc="Competitive ELO. Climb from LTN to TRUE ADAM." 
                  color="#fbbf24" 
                  active 
                  onClick={() => router.push("/arena?mode=ranked")} // <-- ADDED PARAM
                />
                <ModeCard 
                  icon={<ShieldCheck/>} 
                  title="PRIVATE ROOM" 
                  desc="Private lobbies for custom battle codes. (Coming Soon)" 
                  color="#22c55e" 
                />
              </div>
            ) : (
              <div style={{ backgroundColor: "rgba(24, 24, 27, 0.5)", borderRadius: "16px", padding: "30px", border: "1px solid #18181b", backdropFilter: "blur(10px)" }}>
                <h2 style={{ fontSize: "11px", color: "#71717a", letterSpacing: "4px", marginBottom: "30px", textTransform: "uppercase" }}>Global Hall of Fame</h2>
                {leaderboard.map((user, i) => (
                  <div key={user.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                      <span style={{ color: i < 3 ? "#fbbf24" : "#3f3f46", fontWeight: "900", fontSize: "18px" }}>{i + 1}</span>
                      <span style={{ fontWeight: "bold", fontSize: "16px" }}>{user.username}</span>
                    </div>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "#ef4444", fontWeight: "900", background: "rgba(239,68,68,0.1)", padding: "4px 10px", borderRadius: "4px" }}>{user.tier}</span>
                      <span style={{ color: "white", fontWeight: "900", width: "50px", textAlign: "right" }}>{user.elo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>

          {/* Right Sidebar: Recent Battles + Prestige */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Recent Battles */}
            {recentMatches.length > 0 && (
              <div style={{ backgroundColor: "#0f0f12", border: "1px solid #18181b", borderRadius: "16px", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px", color: "#ef4444" }}>
                  <Swords size={16} />
                  <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>RECENT BATTLES</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentMatches.map((match) => {
                    const isWinner = match.winner_id === currentUserId;
                    return (
                      <div key={match.id} style={{ padding: "10px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", borderLeft: `3px solid ${isWinner ? "#39FF14" : "#ef4444"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: "bold", color: isWinner ? "#39FF14" : "#ef4444" }}>
                            {isWinner ? "VICTORY" : "DEFEAT"}
                          </span>
                          <span style={{ fontSize: "9px", color: "#52525b" }}>
                            {match.mode}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#71717a", marginTop: "4px" }}>
                          {match.winner_score?.toFixed(1)} - {match.loser_score?.toFixed(1)}
                          {match.elo_change > 0 && <span style={{ color: isWinner ? "#39FF14" : "#ef4444", marginLeft: "8px" }}>{isWinner ? "+" : "-"}{match.elo_change}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prestige Hierarchy */}
            <div style={{ backgroundColor: "#0f0f12", border: "1px solid #18181b", borderRadius: "16px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#fbbf24" }}>
                <Star size={16} fill="#fbbf24" />
                <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>PRESTIGE HIERARCHY</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {RANK_GROUPS.map((r) => (
                  <div key={r.name} style={{ padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: r.color }}>{r.name}</div>
                      <div style={{ fontSize: "9px", color: "#3f3f46", fontWeight: "bold" }}>{r.minElo}+ ELO</div>
                    </div>
                    {/* Sub-Tier Visualization */}
                    {r.levels > 1 && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map(lvl => (
                          <div key={lvl} style={{ flex: 1, height: "3px", backgroundColor: lvl === 3 || lvl === 5 ? r.color : "#18181b", borderRadius: "2px", opacity: lvl === 3 || lvl === 5 ? 1 : 0.3 }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Global Chat */}
            <div style={{ backgroundColor: "#0f0f12", border: "1px solid #18181b", borderRadius: "16px", padding: "24px", maxHeight: "300px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px", color: "#a855f7" }}>
                <MessageCircle size={16} />
                <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>GLOBAL CHAT</h3>
              </div>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {chatMessages.map((msg) => {
                  const tierColor = { Bronze: "#cd7f32", Silver: "#c0c0c0", Gold: "#ffd700", Platinum: "#e5e4e2", Diamond: "#b9f2ff", Crown: "#ff6b6b", "God Tier": "#9d4edd" }[msg.tier as string] || "#c0c0c0";
                  return (
                    <div key={msg.id} style={{ fontSize: "11px" }}>
                      <span style={{ color: tierColor, fontWeight: "bold" }}>{msg.username}:</span>
                      <span style={{ color: "#a1a1aa", marginLeft: "6px" }}>{msg.message}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Say something..."
                  style={{ flex: 1, backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "8px 12px", color: "white", fontSize: "11px", outline: "none" }}
                />
                <button onClick={sendChatMessage} style={{ backgroundColor: "#a855f7", border: "none", borderRadius: "8px", padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={14} color="white" />
                </button>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, desc, color, active = false, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "25px", padding: "30px", backgroundColor: active ? "rgba(255,255,255,0.02)" : "transparent", border: `1px solid ${active ? color + "40" : "#18181b"}`, borderRadius: "12px", textAlign: "left", width: "100%", cursor: active ? "pointer" : "default" }}>
      <div style={{ color: color, padding: "15px", backgroundColor: `${color}10`, borderRadius: "10px", border: `1px solid ${color}20` }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "900", fontSize: "18px", color: active ? "white" : "#3f3f46", letterSpacing: "-0.5px" }}>{title}</div>
        <div style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>{desc}</div>
      </div>
      <div style={{ color: "#18181b", fontSize: "24px" }}>→</div>
    </button>
  );
}