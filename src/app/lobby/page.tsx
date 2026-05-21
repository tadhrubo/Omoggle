"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, Trophy, BarChart3, ShieldCheck, Star, MessageCircle, Send, X, Copy, Check, Heart } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import SupportDeveloperModal from "@/components/SupportDeveloperModal";
import { usePresence } from "@/hooks/usePresence";
import { RANK_GROUPS, getPrestigeRankInfo, getKFactor } from "@/utils/eloMath";

const getRankStyle = (tierName: string) => {
  if (tierName === "SYSTEM") {
    return {
      name: "SYSTEM",
      color: "#fca5a5",
      glow: "0 0 10px rgba(239, 68, 68, 0.4)",
      bg: "transparent",
      border: "#ef4444"
    };
  }
  return RANK_GROUPS.find(r => r.name === tierName) || RANK_GROUPS[RANK_GROUPS.length - 1];
};

const getWeeklyPercentile = (elo: number) => {
  if (elo >= 2500) return "TOP 0.1%";
  if (elo >= 2200) return `TOP ${(1.5 - ((elo - 2200) / 300) * 1.4).toFixed(2)}%`;
  if (elo >= 1900) return `TOP ${(5 - ((elo - 1900) / 300) * 3.5).toFixed(1)}%`;
  if (elo >= 1600) return `TOP ${(15 - ((elo - 1600) / 300) * 10).toFixed(1)}%`;
  if (elo >= 1300) return `TOP ${(30 - ((elo - 1300) / 300) * 15).toFixed(0)}%`;
  if (elo >= 1000) return `TOP ${(50 - ((elo - 1000) / 300) * 20).toFixed(0)}%`;
  if (elo >= 750) return `TOP ${(70 - ((elo - 750) / 250) * 20).toFixed(0)}%`;
  if (elo >= 500) return `TOP ${(85 - ((elo - 500) / 250) * 15).toFixed(0)}%`;
  return "TOP 95%";
};

function getEloProgress(elo: number) {
  const currentIndex = RANK_GROUPS.findIndex(r => elo >= r.minElo);
  const currentRank = RANK_GROUPS[currentIndex] || RANK_GROUPS[RANK_GROUPS.length - 1];
  
  if (currentIndex === 0 || currentIndex === -1) {
    return {
      percent: 100,
      nextMinElo: "MAX",
      currentMinElo: currentRank.minElo,
      nextRankName: "MAX"
    };
  }
  
  const nextRank = RANK_GROUPS[currentIndex - 1];
  const range = nextRank.minElo - currentRank.minElo;
  const currentDiff = elo - currentRank.minElo;
  const percent = Math.min(100, Math.max(0, (currentDiff / range) * 100));
  
  return {
    percent,
    nextMinElo: nextRank.minElo,
    currentMinElo: currentRank.minElo,
    nextRankName: nextRank.name
  };
}

const RANK_DETAILS: Record<string, { pct: string, aura: string, reward: string }> = {
  "TRUE ADAM": { pct: "Top 0.1%", aura: "Aura Level 10", reward: "Crown (Red Name Glow)" },
  "TERRACHAD": { pct: "Top 1.5%", aura: "Aura Level 9", reward: "Amber Sparkle Border" },
  "CHAD": { pct: "Top 5%", aura: "Aura Level 8", reward: "Crimson Pulse Badge" },
  "CHADLITE": { pct: "Top 15%", aura: "Aura Level 7", reward: "Purple Aura Glow" },
  "HTN": { pct: "Top 30%", aura: "Aura Level 6", reward: "Blue Shield Frame" },
  "MTN": { pct: "Top 50%", aura: "Aura Level 5", reward: "Green Rank Icon" },
  "LTN": { pct: "Top 70%", aura: "Aura Level 4", reward: "Blue Outline Banner" },
  "SUB5": { pct: "Bottom 30%", aura: "Aura Level 3", reward: "Gray Border Frame" },
  "NPC": { pct: "Bottom 15%", aura: "Aura Level 2", reward: "Default Avatar Frame" },
  "DOOMER": { pct: "Bottom 5%", aura: "Aura Level 1", reward: "Doomer Background" }
};

export default function Lobby() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modes" | "ranks">("modes");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [currentTier, setCurrentTier] = useState<string>("LTN");
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [highestStreak, setHighestStreak] = useState<number>(0);
  const [currentElo, setCurrentElo] = useState<number>(1000);
  const [rankedQueueCount, setRankedQueueCount] = useState(0);
  const [activeRoomsCount, setActiveRoomsCount] = useState(0);
  const [liveActivities, setLiveActivities] = useState<any[]>([]);
  const lastFetchedMatchTimeRef = useRef<string | null>(null);
  
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { onlineCount } = usePresence();

  const getAvgWaitTime = () => {
    if (rankedQueueCount > 0) return "< 10s";
    if (onlineCount <= 1) return "--";
    if (onlineCount < 5) return "~ 2m";
    if (onlineCount < 10) return "~ 1m";
    return "~ 30s";
  };

  // Private Room State
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);
  const [privateTab, setPrivateTab] = useState<"create" | "join">("create");
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  // Guest Registration Modal States
  const [isAuthRequiredModalOpen, setIsAuthRequiredModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<"ranked" | "private">("ranked");

  const generateRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setGeneratedCode(code);
    setCodeCopied(false);
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleEnterPrivateRoom = (code: string) => {
    if (code.trim().length >= 4) {
      router.push(`/arena/private?room=${code.trim().toUpperCase()}`);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      // Fetch leaderboard
      const { data: leaders } = await supabase
        .from('profiles')
        .select('*')
        .order('elo', { ascending: false })
        .limit(10);
      if (leaders) setLeaderboard(leaders);



      // Fetch current user and their recent matches
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        const { data: profile } = await supabase
            .from('profiles')
            .select('username, elo, current_streak, highest_streak')
            .eq('id', session.user.id)
            .single();
        
        if (profile) {
          setCurrentUsername(profile.username || "Mogger");
          setCurrentTier(getPrestigeRankInfo(profile.elo || 1200).name);
          setCurrentStreak(profile.current_streak || 0);
          setHighestStreak(profile.highest_streak || 0);
          setCurrentElo(profile.elo || 1000);
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
      const { data: messages } = await supabase
        .from('global_chat')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (messages) setChatMessages(messages.reverse());
    };
    fetchData();
  }, [supabase]);

  // Fetch live arena counts and global matches
  const fetchArenaMetrics = useCallback(async () => {
    try {
      // 1. Fetch exact head count from ranked_queue
      const { count: queueCount, error: qErr } = await supabase
        .from("ranked_queue")
        .select("*", { count: "exact", head: true });
      if (!qErr && queueCount !== null) {
        setRankedQueueCount(queueCount);
      }

      // 2. Fetch unique room code list from private_rooms
      const { data: rooms, error: rErr } = await supabase
        .from("private_rooms")
        .select("room_code");
      if (!rErr && rooms) {
        const uniqueRooms = new Set(rooms.map(r => r.room_code)).size;
        setActiveRoomsCount(uniqueRooms);
      }

      // 3. Fetch last 4 matches with winner/loser usernames
      const { data: matches, error: mErr } = await supabase
        .from("matches")
        .select(`
          id,
          winner_id,
          loser_id,
          winner_score,
          loser_score,
          elo_change,
          mode,
          created_at,
          winner:profiles!matches_winner_id_fkey(username),
          loser:profiles!matches_loser_id_fkey(username)
        `)
        .order("created_at", { ascending: false })
        .limit(4);

      if (!mErr && matches && matches.length > 0) {
        const formattedActivities = matches.map((m: any) => {
          const winnerName = m.winner?.username || "Anonymous";
          const loserName = m.loser?.username || "Anonymous";
          const eloChange = m.elo_change || 0;
          return {
            id: m.id,
            text: `${winnerName} defeated ${loserName} (+${eloChange} ELO)`,
            type: "win",
            highlight: `+${eloChange} ELO`,
            timestamp: new Date(m.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            created_at: m.created_at
          };
        });

        setLiveActivities(formattedActivities);

        // Update the last fetched match timestamp to the latest match's created_at
        // Or if it's the initial fetch, seed it
        const latestTime = matches[0].created_at;
        if (!lastFetchedMatchTimeRef.current || latestTime > lastFetchedMatchTimeRef.current) {
          lastFetchedMatchTimeRef.current = latestTime;
        }
      }
    } catch (err) {
      console.error("Error fetching arena metrics:", err);
    }
  }, [supabase]);

  // Poll arena metrics (queue count, active rooms, recent matches)
  useEffect(() => {
    fetchArenaMetrics(); // Initial fetch
    const interval = setInterval(fetchArenaMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchArenaMetrics]);

  // Real-time chat subscription
  useEffect(() => {
    const channel = supabase
      .channel('global_chat')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'global_chat' }, 
        (payload: any) => { 
          setChatMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    await supabase.from('global_chat').insert([{ 
        user_id: currentUserId, 
        username: currentUsername, 
        message: chatInput.trim(), 
        tier: currentTier 
    }]);
    setChatInput("");
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendChatMessage();
  };

  const progress = getEloProgress(currentElo);
  const currentRank = getPrestigeRankInfo(currentElo);
  const weeklyPercentile = getWeeklyPercentile(currentElo);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#030303", color: "white", padding: "30px 16px", fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        @keyframes pulseDot {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .online-pulse-dot {
          animation: pulseDot 2s infinite ease-in-out;
        }
        .pulse-fast {
          animation: pulseDot 1s infinite ease-in-out;
        }
        @keyframes flicker {
          0% { transform: scale(1) rotate(0deg); opacity: 0.9; }
          50% { transform: scale(1.1) rotate(-3deg); opacity: 1; filter: drop-shadow(0 0 8px #f97316); }
          100% { transform: scale(1) rotate(2deg); opacity: 0.9; }
        }
        .flame-icon-active {
          animation: flicker 0.15s infinite alternate;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rank-hierarchy-row {
          position: relative;
        }
        .rank-hierarchy-row:hover .rank-tooltip {
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translateY(-50%) translateX(-8px) !important;
        }
        @media (max-width: 900px) {
          .rank-hierarchy-row:hover .rank-tooltip {
            transform: translateX(-50%) translateY(-8px) !important;
          }
        }
      `}</style>
      <style jsx>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .lobby-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        .lobby-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
        }
        .lobby-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .lobby-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }
        .support-btn {
          background: linear-gradient(135deg, #7c3aed, #a855f7, #c084fc);
          background-size: 200% 200%;
          animation: gradientShift 3s ease infinite;
          color: white;
          font-weight: 900;
          padding: 10px 20px;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          white-space: nowrap;
        }
        .support-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 0 28px rgba(168, 85, 247, 0.55);
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (max-width: 900px) {
          .lobby-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
          .lobby-header-top {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
        }
        @media (max-width: 600px) {
          .lobby-actions {
            gap: 6px;
          }
          .lobby-actions button {
            flex: 1 1 auto;
            min-width: 0;
            justify-content: center;
          }
        }
      `}</style>

      <div className="lobby-container">
        
        {/* Logo Button Row with Online Pulse */}
        <div style={{ padding: "10px 0 25px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "inline-flex", transition: "transform 0.2s ease" }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Image
              src="/logo.png"
              alt="Omoggle Logo"
              width={48}
              height={48}
              priority
              style={{
                borderRadius: "12px",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </Link>

          {/* Pulsing online player counter */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(34, 197, 94, 0.05)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            padding: "8px 16px",
            borderRadius: "50px",
            boxShadow: "0 0 15px rgba(34, 197, 94, 0.05)"
          }}>
            <span className="online-pulse-dot" style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              display: "inline-block",
              boxShadow: "0 0 8px #22c55e"
            }} />
            <span style={{ fontSize: "11px", fontWeight: "900", color: "#22c55e", letterSpacing: "1px" }}>
              {(onlineCount || 1).toLocaleString()} PLAYERS ONLINE
            </span>
          </div>
        </div>

        <div style={{
          background: "linear-gradient(135deg, rgba(20, 20, 25, 0.7) 0%, rgba(10, 10, 12, 0.9) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "30px",
          boxShadow: "0 15px 35px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(12px)",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "150px",
            height: "150px",
            borderRadius: "50%",
            background: currentUserId ? currentRank.color + "12" : "#ef444408",
            filter: "blur(50px)",
            zIndex: 0,
            pointerEvents: "none"
          }} />

          {currentUserId ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px", position: "relative", zIndex: 1 }}>
              {/* Profile Details & Emblem */}
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* Custom Emblem */}
                <div style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "16px",
                  background: currentRank.bg,
                  border: `2px solid ${currentRank.border}`,
                  boxShadow: currentRank.glow ? `${currentRank.glow}, inset 0 0 10px rgba(255,255,255,0.2)` : "inset 0 0 10px rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "950",
                  color: currentRank.color,
                  fontSize: "26px",
                  fontStyle: "italic",
                  textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {currentRank.name.charAt(0)}
                  {/* Glowing Overlay */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)",
                    transform: "translateX(-100%)",
                    animation: "shimmer 2.5s infinite"
                  }} />
                </div>

                <div>
                  <div style={{ fontSize: "10px", fontWeight: "900", color: "#ef4444", letterSpacing: "2.5px" }}>YOUR CURRENT STATUS</div>
                  <div style={{ fontSize: "24px", fontWeight: "950", color: "white", display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    {currentUsername}
                  </div>
                  <div style={{ fontSize: "13px", color: "#a1a1aa", marginTop: "3px", fontWeight: "600" }}>
                    <span style={{ color: currentRank.color, textShadow: currentRank.glow, fontWeight: "900" }}>{currentRank.name}</span>
                    <span style={{ color: "#3f3f46", margin: "0 8px" }}>•</span>
                    <span style={{ color: "white", fontWeight: "bold" }}>{currentElo} ELO</span>
                  </div>
                </div>
              </div>

              {/* Streaks & Ranking */}
              <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
                <div style={{ borderLeft: "2px solid #18181b", paddingLeft: "20px" }}>
                  <div style={{ fontSize: "10px", color: "#52525b", fontWeight: "900", letterSpacing: "1px" }}>STREAKS</div>
                  <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg className={currentStreak >= 3 ? "flame-icon-active" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.657 16.657L13.414 20.9M13.414 20.9L9.172 16.657M13.414 20.9V14M13 3C13 3 17 7 17 10C17 14.5 12 18 12 18C12 18 7 14.5 7 10C7 6.5 11 3 11 3C11 3 9 7 9 9C9 11.5 11 12 11 12C11 12 13 11.5 13 9C13 7 13 3 13 3Z" 
                          stroke={currentStreak >= 3 ? "#f97316" : "#3f3f46"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                          fill={currentStreak >= 3 ? "#ef4444" : "none"} 
                        />
                      </svg>
                      <span style={{ fontSize: "13px", fontWeight: "950", color: currentStreak >= 3 ? "#ef4444" : "#71717a" }}>
                        {currentStreak} WIN STREAK
                      </span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#52525b", fontWeight: "bold" }}>PEAK STREAK: {highestStreak}</div>
                  </div>
                </div>

                <div style={{ borderLeft: "2px solid #18181b", paddingLeft: "20px" }}>
                  <div style={{ fontSize: "10px", color: "#52525b", fontWeight: "900", letterSpacing: "1px" }}>WEEKLY RANKING</div>
                  <div style={{ fontSize: "16px", fontWeight: "950", color: "#fbbf24", marginTop: "4px", textShadow: "0 0 12px rgba(251, 191, 36, 0.35)", letterSpacing: "0.5px" }}>
                    {weeklyPercentile}
                  </div>
                  <div style={{ fontSize: "10px", color: "#52525b", fontWeight: "bold", marginTop: "2px" }}>THIS WEEK</div>
                </div>
              </div>

              {/* Progress Tracker */}
              <div style={{ width: "100%", marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "#71717a", fontWeight: "900", marginBottom: "8px", letterSpacing: "0.5px" }}>
                  <span>PROGRESS TO {progress.nextRankName.toUpperCase()}</span>
                  <span>{currentElo} / {progress.nextMinElo} ELO</span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#141416", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.02)" }}>
                  <div style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, #ef4444, ${currentRank.color})`,
                    boxShadow: `0 0 10px ${currentRank.color}30`,
                    borderRadius: "4px",
                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                  }} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              <div style={{ flex: "1 1 300px" }}>
                <div style={{ fontSize: "10px", fontWeight: "900", color: "#ef4444", letterSpacing: "2.5px" }}>YOUR CURRENT STATUS</div>
                <div style={{ fontSize: "20px", fontWeight: "950", color: "white", marginTop: "4px", letterSpacing: "0.5px" }}>GUEST PROFILE</div>
                <div style={{ fontSize: "13px", color: "#a1a1aa", marginTop: "6px", lineHeight: "1.5" }}>
                  Ranked calibration, match logs, and ELO leaderboards are disabled for guests. Sign up to claim your digital prestige.
                </div>
              </div>
              <button onClick={handleGoogleLogin} style={{
                backgroundColor: "#ef4444", color: "white", fontWeight: "955", padding: "14px 28px", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "13px", boxShadow: "0 0 20px rgba(239, 68, 68, 0.35)", transition: "all 0.15s", letterSpacing: "0.5px"
              }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                CLAIM ELO RATING
              </button>
            </div>
          )}
        </div>

        {/* ─── ROW 1: Tabs ─── */}
        <div className="lobby-header-top">
          <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid #18181b", paddingBottom: 0 }}>
            <button 
              onClick={() => setActiveTab("modes")}
              style={{ background: "none", border: "none", color: activeTab === "modes" ? "white" : "#3f3f46", fontSize: "13px", fontWeight: "bold", cursor: "pointer", paddingBottom: "12px", borderBottom: activeTab === "modes" ? "2px solid #ef4444" : "2px solid transparent", transition: "color 0.15s", letterSpacing: "1px" }}
            >BATTLE MODES</button>
            <button 
              onClick={() => setActiveTab("ranks")}
              style={{ background: "none", border: "none", color: activeTab === "ranks" ? "white" : "#3f3f46", fontSize: "13px", fontWeight: "bold", cursor: "pointer", paddingBottom: "12px", borderBottom: activeTab === "ranks" ? "2px solid #ef4444" : "2px solid transparent", transition: "color 0.15s", letterSpacing: "1px" }}
            >GLOBAL RANKS</button>
          </div>
        </div>

        {/* ─── ROW 2: Action Buttons ─── */}
        <div className="lobby-actions">
          <button className="enter-arena-btn" onClick={() => router.push("/arena")} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", padding: "10px 24px", borderRadius: "50px", border: "none", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap", letterSpacing: "0.5px" }}>ENTER ARENA</button>
          {currentUserId && (
            <button onClick={() => router.push(`/profile/${currentUserId}`)} style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#d4d4d8", fontWeight: "bold", padding: "10px 18px", borderRadius: "50px", border: "1px solid #27272a", cursor: "pointer", fontSize: "13px", transition: "background 0.15s", whiteSpace: "nowrap", letterSpacing: "0.5px" }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"}
            >
              MY PROFILE
            </button>
          )}
          <button
            className="support-btn"
            onClick={() => setIsSupportModalOpen(true)}
            style={{ letterSpacing: "0.5px" }}
          >
            <Heart size={14} fill="white" /> SUPPORT THE DEVS
          </button>
        </div>

        <div className="lobby-grid">
          
          <main>
            {activeTab === "modes" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <ModeCard 
                  icon={<Trophy/>} 
                  title="RANKED MATCH" 
                  desc="Compete for ELO rating. Standard arena matchmaking rules apply. Win streaks grant multipliers." 
                  color="#fbbf24" 
                  active 
                  className="mode-card"
                  onClick={() => {
                    if (!currentUserId) {
                      setAuthModalReason("ranked");
                      setIsAuthRequiredModalOpen(true);
                    } else {
                      router.push("/arena?mode=ranked");
                    }
                  }}
                  stats={
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#fbbf24", background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.15)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                        QUEUE: {rankedQueueCount} PLAYERS
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#38bdf8", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.15)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                        AVG WAIT: {getAvgWaitTime()}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#22c55e", background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.15)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                        +{getKFactor(currentElo)} ELO POSSIBLE
                      </span>
                      {currentStreak >= 3 && (
                        <span className="pulse-fast" style={{ fontSize: "10px", fontWeight: "955", color: "#ef4444", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "4px 10px", borderRadius: "6px", boxShadow: "0 0 10px rgba(239, 68, 68, 0.2)", letterSpacing: "0.5px" }}>
                          🔥 STREAK BONUS ACTIVE
                        </span>
                      )}
                    </div>
                  }
                />
                
                <ModeCard 
                  icon={<Swords/>} 
                  title="CASUAL 1V1" 
                  desc="Temporarily vaulted to ensure instant queue times in Ranked. Will return in Season 1." 
                  color="#3f3f46" 
                  className="mode-card"
                  stats={
                    <span style={{ fontSize: "10px", fontWeight: "900", color: "#71717a", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                      VAULTED SEASON 0
                    </span>
                  }
                />
                
                <ModeCard 
                  icon={<ShieldCheck/>} 
                  title="PRIVATE ROOM" 
                  className="mode-card"
                  desc="Challenge friends or hosts in custom secure spaces using direct battle codes." 
                  color="#22c55e" 
                  active
                  onClick={() => {
                    if (!currentUserId) {
                      setAuthModalReason("private");
                      setIsAuthRequiredModalOpen(true);
                    } else {
                      setIsPrivateModalOpen(true);
                      generateRoomCode();
                    }
                  }}
                  stats={
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#22c55e", background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.15)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                        {activeRoomsCount === 1 ? "1 ACTIVE ROOM" : `${activeRoomsCount} ACTIVE ROOMS`}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#71717a", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)", padding: "4px 10px", borderRadius: "6px", letterSpacing: "0.5px" }}>
                        NO ELO RATING IMPACT
                      </span>
                    </div>
                  }
                />
              </div>
            ) : (
              <div style={{ backgroundColor: "rgba(24, 24, 27, 0.3)", borderRadius: "24px", padding: "30px", border: "1px solid #18181b", backdropFilter: "blur(10px)" }}>
                <h2 style={{ fontSize: "11px", color: "#71717a", letterSpacing: "4px", marginBottom: "30px", textTransform: "uppercase", fontWeight: "900" }}>Global Hall of Fame</h2>
                {leaderboard.map((user, i) => {
                   const rank = getPrestigeRankInfo(user.elo || 1200);
                   return (
                    <div key={user.id} onClick={() => router.push(`/profile/${user.id}`)} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "opacity 0.2s" }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = "0.7"}
                      onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                    >
                      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                        <span style={{ color: i < 3 ? "#fbbf24" : "#3f3f46", fontWeight: "900", fontSize: "18px" }}>{i + 1}</span>
                        <span style={{ fontWeight: "bold", fontSize: "16px" }}>{user.username}</span>
                      </div>
                      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                        <span style={{ fontSize: "10px", color: rank.color, textShadow: rank.glow, fontWeight: "900", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "4px" }}>{rank.name}</span>
                        <span style={{ color: "white", fontWeight: "900", width: "50px", textAlign: "right" }}>{user.elo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Live Arena Activity Ticker */}
            <div style={{
              backgroundColor: "#0b0b0d",
              border: "1px solid rgba(255,255,255,0.03)",
              borderRadius: "20px",
              padding: "24px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
            }}>
              {/* Pulsing indicator */}
              <div style={{ position: "absolute", top: "24px", right: "24px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="online-pulse-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block", boxShadow: "0 0 6px #ef4444" }} />
                <span style={{ fontSize: "9px", fontWeight: "955", color: "#ef4444", letterSpacing: "1px" }}>LIVE</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#ef4444" }}>
                <Swords size={16} />
                <h3 style={{ fontSize: "11px", fontWeight: "955", letterSpacing: "2.5px", margin: 0 }}>ARENA ACTIVITY</h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", minHeight: "150px" }}>
                {liveActivities.map((act) => (
                  <div key={act.id} style={{
                    padding: "10px 12px",
                    backgroundColor: "rgba(255,255,255,0.01)",
                    border: "1px solid rgba(255,255,255,0.03)",
                    borderRadius: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    animation: "slideIn 0.3s ease-out",
                    lineHeight: "1.4"
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ color: "#d4d4d8", fontWeight: "600" }}>{act.text}</span>
                      <span style={{ fontSize: "9px", color: "#52525b" }}>{act.timestamp}</span>
                    </div>
                    {act.type === "win" && (
                      <span style={{ color: "#22c55e", fontWeight: "950", fontSize: "9px", background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                        +ELO
                      </span>
                    )}
                    {act.type === "rankup" && (
                      <span style={{ color: "#fbbf24", fontWeight: "950", fontSize: "9px", background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                        UP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Battles */}
            {recentMatches.length > 0 && (
              <div style={{ backgroundColor: "#0b0b0d", border: "1px solid rgba(255,255,255,0.03)", borderRadius: "20px", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px", color: "#ef4444" }}>
                  <Swords size={16} />
                  <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>RECENT BATTLES</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentMatches.map((match) => {
                    const isWinner = match.winner_id === currentUserId;
                    return (
                      <div key={match.id} style={{ padding: "10px", backgroundColor: "rgba(255,255,255,0.01)", borderRadius: "8px", borderLeft: `3px solid ${isWinner ? "#22c55e" : "#ef4444"}`, border: "1px solid rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: "bold", color: isWinner ? "#22c55e" : "#ef4444" }}>
                            {isWinner ? "VICTORY" : "DEFEAT"}
                          </span>
                          <span style={{ fontSize: "9px", color: "#52525b", textTransform: "uppercase" }}>
                            {match.mode}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#71717a", marginTop: "4px" }}>
                          {match.winner_score?.toFixed(1)} - {match.loser_score?.toFixed(1)}
                          {match.elo_change > 0 && <span style={{ color: isWinner ? "#22c55e" : "#ef4444", marginLeft: "8px" }}>{isWinner ? "+" : "-"}{match.elo_change}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prestige Hierarchy Sidebar with Interactive Tooltips */}
            <div style={{ backgroundColor: "#0b0b0d", border: "1px solid rgba(255,255,255,0.03)", borderRadius: "20px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#fbbf24" }}>
                <Star size={16} fill="#fbbf24" />
                <h3 style={{ fontSize: "11px", fontWeight: "955", letterSpacing: "2.5px", margin: 0 }}>PRESTIGE RANKS</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {RANK_GROUPS.map((r) => {
                  const isUnlocked = currentUserId ? currentElo >= r.minElo : false;
                  return (
                    <div key={r.name} className="rank-hierarchy-row" style={{
                      padding: "12px",
                      backgroundColor: "rgba(255,255,255,0.01)",
                      borderRadius: "10px",
                      border: `1px solid ${isUnlocked ? r.color + "25" : "rgba(255, 255, 255, 0.02)"}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "help",
                      transition: "all 0.2s"
                    }}>
                      
                      {/* Interactive hover reward detail card */}
                      <div className="rank-tooltip" style={{
                        position: "absolute",
                        left: "-255px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: "240px",
                        backgroundColor: "#0d0d11",
                        border: `1px solid ${r.color}40`,
                        borderRadius: "12px",
                        padding: "12px 16px",
                        boxShadow: `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${r.color}15`,
                        zIndex: 100,
                        opacity: 0,
                        pointerEvents: "none",
                        transition: "all 0.2s ease",
                        lineHeight: "1.4"
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: "900", color: r.color, textShadow: r.glow, letterSpacing: "1px", textTransform: "uppercase" }}>{r.name} UNLOCKS</div>
                        <div style={{ fontSize: "11px", color: "#d4d4d8", marginTop: "6px" }}><strong>Aura Power:</strong> {RANK_DETAILS[r.name]?.aura}</div>
                        <div style={{ fontSize: "11px", color: "#d4d4d8", marginTop: "2px" }}><strong>Cosmetic:</strong> {RANK_DETAILS[r.name]?.reward}</div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "12px", color: isUnlocked ? "#22c55e" : "#52525b" }}>{isUnlocked ? "✓" : "🔒"}</span>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "955", color: r.color, textShadow: r.glow }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: "9px", color: "#71717a", fontWeight: "900", marginTop: "1px" }}>
                            {RANK_DETAILS[r.name]?.pct}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: "9px", color: isUnlocked ? "white" : "#52525b", fontWeight: "bold" }}>{r.minElo}+ ELO</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global Chat with Prestige Styling */}
            <div style={{ backgroundColor: "#0b0b0d", border: "1px solid rgba(255,255,255,0.03)", borderRadius: "20px", padding: "24px", maxHeight: "400px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px", color: "#a855f7" }}>
                <MessageCircle size={16} />
                <h3 style={{ fontSize: "11px", fontWeight: "955", letterSpacing: "2.5px", margin: 0 }}>ARENA CHAT</h3>
              </div>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                {chatMessages.map((msg) => {
                  const isSystem = msg.username === "SYSTEM" || msg.tier === "SYSTEM";
                  const rank = getRankStyle(msg.tier);
                  
                  if (isSystem) {
                    return null;
                  }
                  
                  return (
                    <div key={msg.id} style={{ fontSize: "11px", lineHeight: "1.4", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <span style={{
                        fontWeight: "955",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        textShadow: rank.glow,
                        color: rank.color
                      }}>
                        {msg.username}:
                      </span>
                      <span style={{ color: "#d4d4d8", wordBreak: "break-word" }}>{msg.message}</span>
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
                  style={{ flex: 1, backgroundColor: "#141416", border: "1px solid #27272a", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "11px", outline: "none" }}
                />
                <button onClick={sendChatMessage} style={{ backgroundColor: "#a855f7", border: "none", borderRadius: "8px", padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={14} color="white" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ─── REGISTRATION REQUIRED MODAL ─── */}
      {isAuthRequiredModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, backdropFilter: "blur(8px)", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "440px", backgroundColor: "#0a0a0c", border: "1px solid #ef444430", borderRadius: "24px", padding: "40px 30px", position: "relative", textAlign: "center" }}>
            
            {/* Close Button */}
            <button onClick={() => setIsAuthRequiredModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}>
              <X size={24} />
            </button>

            {/* Header Icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "15px" }}>
              <Trophy size={32} color="#fbbf24" style={{ filter: "drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))" }} />
            </div>

            {/* Header */}
            <h2 style={{ fontSize: "1.6rem", fontWeight: "900", color: "white", margin: "0 0 10px 0", letterSpacing: "1px" }}>
              REGISTRATION REQUIRED
            </h2>
            
            <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", marginBottom: "30px" }}>
              {authModalReason === "ranked" 
                ? "Ranked matchmaking requires a persistent ELO profile and rank ranking history to track your genetic ascendancy. Guests can only play in the Casual Arena."
                : "Private rooms require a verified player signature to authenticate secure connections. Guests can only play in the Casual Arena."
              }
            </p>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={handleGoogleLogin}
                style={{
                  width: "100%", padding: "16px", backgroundColor: "#ef4444", color: "white",
                  border: "none", borderRadius: "12px", cursor: "pointer",
                  fontWeight: "900", fontSize: "15px", transition: "all 0.2s",
                  boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)"
                }}
              >
                SIGN UP WITH GOOGLE
              </button>
              
              <button
                onClick={() => setIsAuthRequiredModalOpen(false)}
                style={{
                  width: "100%", padding: "14px", backgroundColor: "transparent", color: "#71717a",
                  border: "1px solid #27272a", borderRadius: "12px", cursor: "pointer",
                  fontWeight: "bold", fontSize: "14px", transition: "all 0.2s"
                }}
              >
                KEEP PLAYING CASUAL
              </button>
            </div>

            {/* Footer notice */}
            <p style={{ fontSize: "10px", color: "#52525b", marginTop: "20px", margin: "20px 0 0 0" }}>
              Signing up takes 3 seconds and is completely free.
            </p>

          </div>
        </div>
      )}

      {/* ─── PRIVATE ROOM MODAL ─── */}
      {isPrivateModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(8px)", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "460px", backgroundColor: "#0a0a0c", border: "1px solid #22c55e30", borderRadius: "24px", padding: "40px 30px", position: "relative", textAlign: "center" }}>
            
            {/* Close Button */}
            <button onClick={() => { setIsPrivateModalOpen(false); setGeneratedCode(null); setJoinCode(""); }} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}>
              <X size={24} />
            </button>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "10px" }}>
              <ShieldCheck size={28} color="#22c55e" />
              <h2 style={{ fontSize: "1.8rem", fontWeight: "900", color: "white", margin: 0 }}>PRIVATE ROOM</h2>
            </div>
            <p style={{ color: "#71717a", fontSize: "13px", marginBottom: "30px" }}>Battle your friends in a private 1v1 arena</p>

            {/* Tab Switcher */}
            <div style={{ display: "flex", marginBottom: "30px", borderRadius: "10px", overflow: "hidden", border: "1px solid #27272a" }}>
              <button
                onClick={() => { setPrivateTab("create"); if (!generatedCode) generateRoomCode(); }}
                style={{
                  flex: 1, padding: "12px", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "13px", letterSpacing: "1px",
                  backgroundColor: privateTab === "create" ? "#22c55e" : "#18181b",
                  color: privateTab === "create" ? "black" : "#71717a",
                  transition: "all 0.2s"
                }}
              >CREATE ROOM</button>
              <button
                onClick={() => setPrivateTab("join")}
                style={{
                  flex: 1, padding: "12px", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "13px", letterSpacing: "1px",
                  backgroundColor: privateTab === "join" ? "#22c55e" : "#18181b",
                  color: privateTab === "join" ? "black" : "#71717a",
                  transition: "all 0.2s"
                }}
              >JOIN ROOM</button>
            </div>

            {/* Create Room Tab */}
            {privateTab === "create" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <p style={{ color: "#a1a1aa", fontSize: "13px", margin: 0 }}>Share this code with your opponent</p>
                
                {/* Room Code Display */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "15px",
                  backgroundColor: "#18181b", border: "1px solid #22c55e30", borderRadius: "12px", padding: "20px"
                }}>
                  <span style={{
                    fontSize: "2.5rem", fontWeight: "900", letterSpacing: "8px", color: "#22c55e",
                    fontFamily: "monospace", textShadow: "0 0 15px rgba(34, 197, 94, 0.4)"
                  }}>
                    {generatedCode || "------"}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    style={{
                      background: "none", border: "1px solid #27272a", borderRadius: "8px", padding: "8px",
                      cursor: "pointer", color: codeCopied ? "#22c55e" : "#71717a", transition: "all 0.2s"
                    }}
                  >
                    {codeCopied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>

                {codeCopied && (
                  <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "bold" }}>✓ Copied to clipboard!</span>
                )}

                {/* Generate New + Enter */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={generateRoomCode}
                    style={{
                      flex: 1, padding: "14px", backgroundColor: "#18181b", color: "#a1a1aa",
                      border: "1px solid #27272a", borderRadius: "12px", cursor: "pointer",
                      fontWeight: "bold", fontSize: "13px", transition: "all 0.2s"
                    }}
                  >NEW CODE</button>
                  <button
                    onClick={() => generatedCode && handleEnterPrivateRoom(generatedCode)}
                    style={{
                      flex: 2, padding: "14px", backgroundColor: "#22c55e", color: "black",
                      border: "none", borderRadius: "12px", cursor: "pointer",
                      fontWeight: "900", fontSize: "15px", transition: "all 0.2s",
                      boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)"
                    }}
                  >ENTER ROOM</button>
                </div>
              </div>
            )}

            {/* Join Room Tab */}
            {privateTab === "join" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <p style={{ color: "#a1a1aa", fontSize: "13px", margin: 0 }}>Enter the room code shared by your opponent</p>
                
                <input
                  type="text"
                  placeholder="ENTER CODE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  maxLength={6}
                  style={{
                    width: "100%", padding: "20px", backgroundColor: "#18181b",
                    border: "1px solid #27272a", borderRadius: "12px", color: "#22c55e",
                    textAlign: "center", fontSize: "2rem", fontWeight: "900",
                    letterSpacing: "8px", fontFamily: "monospace", outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#22c55e"}
                  onBlur={(e) => e.target.style.borderColor = "#27272a"}
                  onKeyDown={(e) => { if (e.key === "Enter") handleEnterPrivateRoom(joinCode); }}
                />

                <button
                  onClick={() => handleEnterPrivateRoom(joinCode)}
                  disabled={joinCode.length < 4}
                  style={{
                    width: "100%", padding: "16px", backgroundColor: joinCode.length >= 4 ? "#22c55e" : "#27272a",
                    color: joinCode.length >= 4 ? "black" : "#52525b", border: "none", borderRadius: "12px",
                    cursor: joinCode.length >= 4 ? "pointer" : "not-allowed",
                    fontWeight: "900", fontSize: "15px", transition: "all 0.2s",
                    boxShadow: joinCode.length >= 4 ? "0 0 20px rgba(34, 197, 94, 0.3)" : "none"
                  }}
                >JOIN BATTLE</button>
              </div>
            )}

            {/* Info Footer */}
            <div style={{ marginTop: "25px", padding: "12px", backgroundColor: "rgba(34, 197, 94, 0.05)", borderRadius: "8px", border: "1px solid #22c55e15" }}>
              <p style={{ color: "#52525b", fontSize: "11px", margin: 0, lineHeight: "1.5" }}>
                Private battles don't affect your ELO rating. Both players need to enter the arena with the same code.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUPPORT DEVELOPER MODAL ─── */}
      <SupportDeveloperModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} />
    </div>
  );
}

function ModeCard({ icon, title, desc, color, active = false, onClick, className, stats }: any) {
  return (
    <button 
      onClick={onClick}
      className={className}
      disabled={!active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "25px",
        padding: "30px",
        backgroundColor: active ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.002)",
        border: `1px solid ${active ? color + "40" : "#18181b"}`,
        borderRadius: "16px",
        textAlign: "left",
        width: "100%",
        cursor: active ? "pointer" : "not-allowed",
        transition: "all 0.25s ease",
        boxShadow: active ? `0 4px 20px ${color}05` : "none",
        opacity: active ? 1 : 0.45
      }}
      onMouseOver={(e) => {
        if (active) {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 8px 30px ${color}15`;
        }
      }}
      onMouseOut={(e) => {
        if (active) {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.015)";
          e.currentTarget.style.borderColor = `${color}40`;
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = `0 4px 20px ${color}05`;
        }
      }}
    >
      <div className="mode-card-icon" style={{
        color: color,
        padding: "16px",
        backgroundColor: `${color}10`,
        borderRadius: "12px",
        border: `1px solid ${color}20`,
        boxShadow: active ? `inset 0 0 10px ${color}15` : "none",
        transition: "all 0.2s"
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="mode-card-title" style={{ fontWeight: "950", fontSize: "18px", color: active ? "white" : "#52525b", letterSpacing: "0.5px" }}>{title}</div>
        <div style={{ fontSize: "13px", color: active ? "#a1a1aa" : "#3f3f46", marginTop: "4px", lineHeight: "1.4" }}>{desc}</div>
        {stats && <div style={{ marginTop: "12px" }}>{stats}</div>}
      </div>
      <div style={{ color: active ? color : "#27272a", fontSize: "20px", fontWeight: "900", transition: "transform 0.2s" }}>→</div>
    </button>
  );
}