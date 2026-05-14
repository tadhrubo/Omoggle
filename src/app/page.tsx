"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, LogOut, User, X, Settings } from "lucide-react";

/**
 * PRESTIGE HIERARCHY UTILITY
 * Single source of truth for Ranks and Visual Styles
 */
const getTier = (elo: number) => {
  if (elo >= 2500) return { label: "TRUE ADAM", color: "#ffffff", glow: "0 0 20px #fff" };
  if (elo >= 2200) return { label: "TERRACHAD", color: "#fbbf24", glow: "0 0 15px #fbbf24" };
  if (elo >= 1900) return { label: "CHAD", color: "#ef4444", glow: "0 0 10px #ef4444" };
  if (elo >= 1600) return { label: "CHADLITE", color: "#a855f7", glow: "none" };
  if (elo >= 1300) return { label: "HTN", color: "#3b82f6", glow: "none" };
  if (elo >= 1000) return { label: "MTN", color: "#22c55e", glow: "none" };
  return { label: "LTN", color: "#71717a", glow: "none" };
};

// Custom hook for the ticking number animation in the footer
function useAnimatedNumber(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

export default function Home() {
  const router = useRouter();
  
  // ARCHITECT FIX: Stabilize the Supabase client so it doesn't re-create on every keystroke
  const [supabase] = useState(() => createClient());
  
  // Auth & UI State
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Profile Management State
  const [guestHandle, setGuestHandle] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Database Stats State
  const [dbStats, setDbStats] = useState({ inArena: 0, totalUsers: 0, avgWait: 0 });

  const animatedArena = useAnimatedNumber(dbStats.inArena, 2000);
  const animatedUsers = useAnimatedNumber(dbStats.totalUsers, 2500);
  const animatedWait = useAnimatedNumber(dbStats.avgWait * 10, 1500) / 10;

  useEffect(() => {
    let isMounted = true;

    // Load previously saved guest handle
    const savedGuest = localStorage.getItem("omoggle_guest_name");
    if (savedGuest) setGuestHandle(savedGuest);

    // Initial Load Logic
    const loadUserAndProfile = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession && isMounted) {
        setSession(currentSession);
        const { data } = await supabase.from('profiles').select('*').eq('id', currentSession.user.id).single();
        if (data && isMounted) {
          setProfile(data);
          setEditName(data.username); // This now only fires ONCE when the page loads
        }
      }
      if (isMounted) setLoadingAuth(false);
    };

    loadUserAndProfile();

    // Listen for Auth Changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (isMounted) {
        if (event === 'SIGNED_IN' && currentSession) {
          setSession(currentSession);
          // Only fetch the profile if it's a fresh sign-in
          supabase.from('profiles').select('*').eq('id', currentSession.user.id).single().then(({ data }) => {
            if (data && isMounted) {
              setProfile(data);
              setEditName(data.username);
            }
          });
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
        }
      }
    });

    // Background Stats Polling
    const fetchLiveStats = async () => {
      try {
        const { count: rankedCount } = await supabase.from('ranked_queue').select('*', { count: 'exact', head: true });
        const { count: casualCount } = await supabase.from('arena_queue').select('*', { count: 'exact', head: true });
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

        const totalInArena = (rankedCount || 0) + (casualCount || 0);
        if (isMounted) {
          setDbStats({ inArena: totalInArena, totalUsers: userCount || 0, avgWait: totalInArena > 0 ? 1.2 : 4.2 });
        }
      } catch (error) { 
        console.error("Stats Fetch Error", error); 
      }
    };
    
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000);
    
    // Cleanup
    return () => { 
      isMounted = false; 
      clearInterval(interval); 
      subscription.unsubscribe(); 
    };
  }, [supabase]); // ARCHITECT FIX: Removed 'profile' from dependencies. This stops the infinite loop!

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !session?.user?.id) return;
    
    setIsSaving(true);
    
    try {
      const elo = profile?.elo || 1200;
      const tier = getTier(elo).label;

      const { data, error } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id,
          username: editName.trim(), 
          avatar_url: session.user.user_metadata?.avatar_url || profile?.avatar_url || "",
          elo: elo,
          tier: tier
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      
      setProfile(data);
      setIsSettingsOpen(false);
    } catch (error: any) {
      console.error("Save Error:", error.message);
      alert(`System Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnterArena = () => {
    if (profile?.is_banned) {
      alert("Your account has been suspended. Contact support for assistance.");
      return;
    }
    if (session) {
      router.push("/lobby");
    } else {
      if (guestHandle.trim().length > 0) {
        localStorage.setItem("omoggle_guest_name", guestHandle.trim());
        router.push("/lobby");
      } else {
        setIsAuthModalOpen(true);
      }
    }
  };

  // Derived UI Variables
  const displayName = profile?.username || session?.user?.user_metadata?.full_name || "Mogger";
  const displayAvatar = profile?.avatar_url || session?.user?.user_metadata?.avatar_url;
  const displayElo = profile?.elo || 1200;
  const tierInfo = getTier(displayElo);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" }}>
      
      {/* --- DYNAMIC PROFILE PILL (Top Right) --- */}
      <div style={{ position: "absolute", top: "24px", right: "24px", zIndex: 40 }}>
        {loadingAuth ? (
          <div style={{ width: "24px", height: "24px", border: "2px solid #27272a", borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        ) : session ? (
          <div style={{ padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid #27272a", borderRadius: "99px", display: "flex", alignItems: "center", gap: "12px", backdropFilter: "blur(10px)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div 
              onClick={() => router.push(`/profile/${session.user.id}`)}
              style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", transition: "opacity 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.opacity = "0.7"}
              onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
            >
              <img src={displayAvatar} alt="Avatar" style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" }} />
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontSize: "14px", fontWeight: "900", color: "white", lineHeight: "1" }}>{displayName}</span>
                <span style={{ fontSize: "10px", color: "#a1a1aa", fontFamily: "monospace", marginTop: "2px" }}>
                  <span style={{ color: tierInfo.color, textShadow: tierInfo.glow, fontWeight: "bold" }}>{tierInfo.label}</span> • {displayElo} ELO
                </span>
              </div>
            </div>
            <div style={{ width: "1px", height: "24px", backgroundColor: "#27272a", margin: "0 4px" }}></div>
            <button 
              onClick={() => {
                setEditName(profile?.username || ""); // Resets input to actual name when opening modal
                setIsSettingsOpen(true);
              }} 
              style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", transition: "color 0.2s" }} 
              onMouseOver={(e) => e.currentTarget.style.color = "white"} 
              onMouseOut={(e) => e.currentTarget.style.color = "#71717a"}
            >
              <Settings size={16} />
            </button>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "#ef4444"} onMouseOut={(e) => e.currentTarget.style.color = "#71717a"}><LogOut size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setIsAuthModalOpen(true)} style={{ padding: "10px 24px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "99px", color: "white", fontSize: "12px", fontWeight: "bold", cursor: "pointer", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "white"; e.currentTarget.style.color = "black"; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "white"; }}><User size={16} /> SIGN IN</button>
        )}
      </div>

      <style jsx global>{` @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>

      {/* --- HERO CONTENT --- */}
      <div style={{ color: "#ef4444", fontSize: "10px", fontWeight: "bold", letterSpacing: "4px", marginBottom: "30px", display: "flex", alignItems: "center", gap: "10px" }}><span>♦</span> FACE THE COMPETITION <span>♦</span></div>

      <div style={{ textAlign: "center", lineHeight: "1.1", marginBottom: "30px" }}>
        <h1 style={{ fontSize: "clamp(5rem, 15vw, 9rem)", fontWeight: "400", margin: 0, letterSpacing: "-2px" }}>MOG</h1>
        <h1 style={{ fontSize: "clamp(5rem, 15vw, 9rem)", fontWeight: "400", margin: 0, color: "#ef4444", textShadow: "0 0 40px rgba(239, 68, 68, 0.6)" }}>OR</h1>
        <h1 style={{ fontSize: "clamp(4rem, 12vw, 8rem)", fontWeight: "400", margin: 0, letterSpacing: "-2px" }}>BE MOGGED</h1>
      </div>

      <div style={{ color: "#71717a", fontSize: "12px", letterSpacing: "2px", marginBottom: "40px", fontFamily: "monospace" }}>anonymous • real-time • unfiltered</div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "50px" }}>
        <div style={{ width: "10px", height: "10px", backgroundColor: "#22c55e", borderRadius: "50%", boxShadow: "0 0 10px #22c55e" }}></div>
        <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>{animatedArena.toLocaleString()} IN ARENA</span>
      </div>

      <div style={{ width: "100%", maxWidth: "400px", marginBottom: "80px", display: "flex", flexDirection: "column", gap: "15px" }}>
        {!session && !loadingAuth && (
          <input type="text" placeholder="ENTER GUEST HANDLE" value={guestHandle} onChange={(e) => setGuestHandle(e.target.value)} style={{ width: "100%", padding: "18px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #27272a", borderRadius: "12px", color: "white", textAlign: "center", fontSize: "16px", letterSpacing: "2px", outline: "none", fontFamily: "monospace", transition: "border-color 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#ef4444"} onBlur={(e) => e.target.style.borderColor = "#27272a"} />
        )}
        {profile?.is_banned ? (
          <div style={{ width: "100%", padding: "20px", backgroundColor: "#27272a", color: "#71717a", border: "1px solid #ef4444", borderRadius: "12px", fontSize: "18px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <X size={24} /> SUSPENDED
          </div>
        ) : (
          <button onClick={handleEnterArena} style={{ width: "100%", padding: "20px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "12px", fontSize: "18px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)" }} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}><Swords size={24} /> {session ? "ENTER LOBBY" : "ENTER THE ARENA"}</button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "clamp(30px, 8vw, 80px)", textAlign: "center" }}>
        <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedUsers >= 1000 ? (animatedUsers / 1000).toFixed(1) + 'K' : animatedUsers}</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>MOGGERS REGISTERED</div></div>
        <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedArena}</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>ACTIVE NOW</div></div>
        <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedWait.toFixed(1)}S</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>AVG WAIT</div></div>
      </div>

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: "420px", backgroundColor: "#0f0514", border: "1px solid #27272a", borderRadius: "24px", padding: "40px 30px", position: "relative", textAlign: "center" }}>
            <button onClick={() => setIsSettingsOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}><X size={24} /></button>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "900", color: "white", margin: "0 0 30px 0" }}>PROFILE SETTINGS</h2>
            <div style={{ textAlign: "left", marginBottom: "30px" }}>
              <label style={{ display: "block", color: "#a1a1aa", fontSize: "12px", fontWeight: "bold", marginBottom: "10px" }}>DISPLAY NAME</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={16} style={{ width: "100%", padding: "16px", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid #27272a", borderRadius: "12px", color: "white", fontSize: "16px", outline: "none", fontFamily: "monospace" }} />
            </div>
            <button onClick={handleSaveProfile} disabled={isSaving || !editName.trim()} style={{ width: "100%", padding: "16px", backgroundColor: "white", color: "black", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", cursor: "pointer", opacity: (!editName.trim() || isSaving) ? 0.5 : 1 }}>{isSaving ? "SAVING..." : "SAVE CHANGES"}</button>
          </div>
        </div>
      )}

      {/* --- AUTH MODAL --- */}
      {isAuthModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: "420px", backgroundColor: "#0f0514", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "24px", padding: "40px 30px", position: "relative", textAlign: "center" }}>
            <button onClick={() => setIsAuthModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}><X size={24} /></button>
            <h2 style={{ fontSize: "2rem", fontWeight: "900", color: "white", margin: "0 0 20px 0" }}>CLAIM YOUR RANK</h2>
            <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", margin: "0 0 25px 0" }}>Continue with Google to save your Elo, history, and leaderboard identity.</p>
            <button onClick={handleGoogleLogin} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "15px", padding: "16px", backgroundColor: "white", color: "black", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}><svg width="24" height="24" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google</button>
          </div>
        </div>
      )}
    </div>
  );
}