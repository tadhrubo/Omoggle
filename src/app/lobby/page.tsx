"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, Trophy, BarChart3, ShieldCheck, Star, MessageCircle, Send, X, Copy, Check, Heart } from "lucide-react";
import SupportDeveloperModal from "@/components/SupportDeveloperModal";

import { RANK_GROUPS, getPrestigeRankInfo } from "@/utils/eloMath";

const getRankStyle = (tierName: string) => {
  return RANK_GROUPS.find(r => r.name === tierName) || RANK_GROUPS[RANK_GROUPS.length - 1];
};

export default function Lobby() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"modes" | "ranks">("modes");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("Guest");
  const [currentTier, setCurrentTier] = useState<string>("LTN");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

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
            .select('username, elo')
            .eq('id', session.user.id)
            .single();
        
        if (profile) {
          setCurrentUsername(profile.username || "Mogger");
          setCurrentTier(getPrestigeRankInfo(profile.elo || 1200).name);
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

  // Real-time chat subscription
  useEffect(() => {
    const channel = supabase
      .channel('global_chat')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'global_chat' }, 
        (payload: any) => { // FIXED: Added explicit any type
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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#050505", color: "white", padding: "40px 20px", fontFamily: "'Inter', sans-serif" }}>
      <style jsx>{`
        .lobby-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        .lobby-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 40px;
        }
        @media (max-width: 900px) {
          .lobby-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
          .lobby-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 20px;
          }
          .enter-arena-btn {
            width: 100%;
            margin-bottom: 20px !important;
          }
          .lobby-tabs {
            gap: 15px !important;
          }
        }
        @media (max-width: 600px) {
          .mode-card {
            padding: 20px !important;
            gap: 15px !important;
          }
          .mode-card-icon {
            padding: 10px !important;
          }
          .mode-card-title {
            fontSize: 16px !important;
          }
        }
      `}</style>

      <div className="lobby-container">
        
        {/* Header & Tab Switcher */}
        <header className="lobby-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "50px", borderBottom: "1px solid #18181b", paddingLeft: "70px" }}>
          <div>
            <div className="lobby-tabs" style={{ display: "flex", gap: "30px" }}>
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
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            {currentUserId && (
              <button onClick={() => router.push(`/profile/${currentUserId}`)} style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "white", fontWeight: "bold", padding: "12px 20px", borderRadius: "8px", border: "1px solid #27272a", cursor: "pointer", fontSize: "14px", transition: "background 0.2s" }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"}
              >
                MY PROFILE
              </button>
            )}
            <button
              onClick={() => setIsSupportModalOpen(true)}
              style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7", fontWeight: "bold", padding: "12px 20px", borderRadius: "8px", border: "1px solid rgba(168, 85, 247, 0.3)", cursor: "pointer", fontSize: "14px", transition: "background 0.2s", display: "flex", alignItems: "center", gap: "6px" }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.2)"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(168, 85, 247, 0.1)"}
            >
              <Heart size={14} fill="#a855f7" /> SUPPORT
            </button>
            <button className="enter-arena-btn" onClick={() => router.push("/arena")} style={{ backgroundColor: "#ef4444", color: "white", fontWeight: "900", padding: "12px 30px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "14px" }}>ENTER ARENA</button>
          </div>
        </header>

        <div className="lobby-grid">
          
          <main>
            {activeTab === "modes" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <ModeCard 
                  icon={<Trophy/>} 
                  title="RANKED MATCH" 
                  desc="Compete for ELO. Climb the global leaderboard." 
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
                />
                <ModeCard 
                  icon={<Swords/>} 
                  title="CASUAL 1V1" 
                  desc="Temporarily vaulted to ensure instant queue times in Ranked." 
                  color="#3f3f46" 
                  className="mode-card"
                />
                <ModeCard 
                  icon={<ShieldCheck/>} 
                  title="PRIVATE ROOM" 
                  className="mode-card"
                  desc="Create or join a private battle room with a custom code." 
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
                />
              </div>
            ) : (
              <div style={{ backgroundColor: "rgba(24, 24, 27, 0.5)", borderRadius: "16px", padding: "30px", border: "1px solid #18181b", backdropFilter: "blur(10px)" }}>
                <h2 style={{ fontSize: "11px", color: "#71717a", letterSpacing: "4px", marginBottom: "30px", textTransform: "uppercase" }}>Global Hall of Fame</h2>
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
                          <span style={{ fontSize: "9px", color: "#52525b", textTransform: "uppercase" }}>
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

            {/* Prestige Hierarchy Sidebar */}
            <div style={{ backgroundColor: "#0f0f12", border: "1px solid #18181b", borderRadius: "16px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", color: "#fbbf24" }}>
                <Star size={16} fill="#fbbf24" />
                <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>PRESTIGE HIERARCHY</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {RANK_GROUPS.map((r) => (
                  <div key={r.name} style={{ padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: r.color, textShadow: r.glow }}>{r.name}</div>
                      <div style={{ fontSize: "9px", color: "#3f3f46", fontWeight: "bold" }}>{r.minElo}+ ELO</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Global Chat with Prestige Colors */}
            <div style={{ backgroundColor: "#0f0f12", border: "1px solid #18181b", borderRadius: "16px", padding: "24px", maxHeight: "400px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px", color: "#a855f7" }}>
                <MessageCircle size={16} />
                <h3 style={{ fontSize: "11px", fontWeight: "900", letterSpacing: "2px", margin: 0 }}>GLOBAL CHAT</h3>
              </div>
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {chatMessages.map((msg) => {
                  const rank = getRankStyle(msg.tier);
                  return (
                    <div key={msg.id} style={{ fontSize: "11px", lineHeight: "1.4" }}>
                      <span style={{ color: rank.color, textShadow: rank.glow, fontWeight: "900" }}>{msg.username}:</span>
                      <span style={{ color: "#e4e4e7", marginLeft: "6px" }}>{msg.message}</span>
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
                  style={{ flex: 1, backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "10px 12px", color: "white", fontSize: "11px", outline: "none" }}
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

function ModeCard({ icon, title, desc, color, active = false, onClick, className }: any) {
  return (
    <button 
      onClick={onClick}
      className={className}
      style={{ display: "flex", alignItems: "center", gap: "25px", padding: "30px", backgroundColor: active ? "rgba(255,255,255,0.02)" : "transparent", border: `1px solid ${active ? color + "40" : "#18181b"}`, borderRadius: "12px", textAlign: "left", width: "100%", cursor: active ? "pointer" : "default", transition: "all 0.2s" }}
      onMouseOver={(e) => active && (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
      onMouseOut={(e) => active && (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
    >
      <div className="mode-card-icon" style={{ color: color, padding: "15px", backgroundColor: `${color}10`, borderRadius: "10px", border: `1px solid ${color}20` }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="mode-card-title" style={{ fontWeight: "900", fontSize: "18px", color: active ? "white" : "#3f3f46", letterSpacing: "-0.5px" }}>{title}</div>
        <div style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>{desc}</div>
      </div>
      <div style={{ color: active ? color : "#18181b", fontSize: "24px" }}>→</div>
    </button>
  );
}