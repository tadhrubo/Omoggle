"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Swords, LogOut, User, X, Settings } from "lucide-react";
import AgeGate from "@/components/AgeGate";
import Link from "next/link";
import Image from "next/image";
import { useAnalytics } from "@/hooks/useAnalytics";

// ─── FAQ ACCORDION ─────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "What is Omoggle?", a: "Omoggle is a competitive 1v1 video chat arena where two users go head-to-head in a live mog battle. A real-time audience watches both feeds and votes on who mogs. Your result updates your ELO ranking on the global leaderboard." },
  { q: "How is the PSL rating calculated?", a: "Omoggle's AI measures canthal tilt, jawline definition, midface ratio, facial symmetry, and orbital structure from your live video feed. These sub-scores combine into a single PSL rating that's tracked across battles." },
  { q: "What is canthal tilt?", a: "Canthal tilt is the angle of the outer corners of your eyes relative to the inner corners. Positive canthal tilt (outer corners higher) is associated with dominance and hunter eyes — one of the highest-valued metrics in mog battles." },
  { q: "How is Omoggle different from Omegle?", a: "Omegle was a passive random chat platform with no structure or stakes. Omoggle is built around a competitive outcome — a verdict, an ELO rank, tiers to climb, and a community built around self-improvement and live competition." },
  { q: "Is it safe? Is content moderated?", a: "Video streams are peer-to-peer via WebRTC — we don't record or store your camera feed. Users can report opponents mid-battle. Repeat offenders are banned. Omoggle is for users 18 and over." },
  { q: "Do I need an account?", a: "No. You can enter Casual Arena as a Guest. To track ELO, build a win streak, and appear on the global leaderboard, sign in with Google — no password required." },
  { q: "Can I hide my face?", a: "Casual and Private Room modes allow you to participate without a ranked profile. However, a visible face is required for the AI scoring and audience vote to function. You can skip a battle at any time." },
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div>
      <div style={{ display: "inline-block", backgroundColor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "99px", padding: "4px 14px", marginBottom: "18px" }}>
        <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "700", letterSpacing: "2px" }}>FAQ</span>
      </div>
      <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: "900", color: "white", margin: "0 0 32px 0", fontStyle: "italic" }}>Frequently asked questions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "780px" }}>
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #27272a", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s" }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "#3f3f46"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "#27272a"}
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ color: "white", fontSize: "15px", fontWeight: "600" }}>{item.q}</span>
              <span style={{ color: "#71717a", fontSize: "22px", fontWeight: "300", lineHeight: 1, flexShrink: 0, marginLeft: "16px", transform: openIndex === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
            </button>
            {openIndex === i && (
              <div style={{ padding: "0 20px 18px 20px", color: "#a1a1aa", fontSize: "14px", lineHeight: "1.65" }}>{item.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { getPrestigeRankInfo } from "@/utils/eloMath";

/**
 * PRESTIGE HIERARCHY UTILITY
 * Single source of truth for Ranks and Visual Styles
 */
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
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent("session_start");
  }, [trackEvent]);
  
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
      <AgeGate />
      
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
              {displayAvatar && <Image src={displayAvatar} alt="Avatar" width={32} height={32} style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" }} />}
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

      <h1 style={{ textAlign: "center", lineHeight: "1.1", marginBottom: "30px", margin: 0 }}>
        <span style={{ fontSize: "clamp(5rem, 15vw, 9rem)", fontWeight: "400", letterSpacing: "-2px", display: "block" }}>MOG</span>
        <span style={{ fontSize: "clamp(5rem, 15vw, 9rem)", fontWeight: "400", color: "#ef4444", textShadow: "0 0 40px rgba(239, 68, 68, 0.6)", display: "block" }}>OR</span>
        <span style={{ fontSize: "clamp(4rem, 12vw, 8rem)", fontWeight: "400", letterSpacing: "-2px", display: "block" }}>BE MOGGED</span>
      </h1>

      <div style={{ color: "#71717a", fontSize: "12px", letterSpacing: "2px", marginBottom: "40px", fontFamily: "monospace" }}>anonymous • real-time • unfiltered</div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "50px" }}>
        <div style={{ width: "10px", height: "10px", backgroundColor: "#22c55e", borderRadius: "50%", boxShadow: "0 0 10px #22c55e" }}></div>
        <span style={{ color: "#22c55e", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>{(animatedArena + 7458).toLocaleString()} IN ARENA</span>
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

      {/* --- ONBOARDING FUNNEL --- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", width: "100%", maxWidth: "900px", margin: "0 auto 80px auto", padding: "0 20px" }}>
        
        {/* Step 1 */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #27272a", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "flex-start", gap: "15px" }}>
          <div style={{ backgroundColor: "rgba(34, 197, 94, 0.1)", color: "#22c55e", width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", flexShrink: 0 }}>1</div>
          <div>
            <h2 style={{ color: "white", fontSize: "14px", fontWeight: "bold", margin: "0 0 5px 0", letterSpacing: "1px" }}>CAMERA CHECK</h2>
            <p style={{ color: "#a1a1aa", fontSize: "12px", lineHeight: "1.4", margin: 0 }}>Ensure your stream is flawless before entering the live arena.</p>
          </div>
        </div>

        {/* Step 2 (Wired to /lab) */}
        <Link href="/lab" style={{ textDecoration: "none" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #27272a", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "flex-start", gap: "15px", cursor: "pointer", transition: "border-color 0.2s", height: "100%" }} onMouseOver={(e) => e.currentTarget.style.borderColor = "#a855f7"} onMouseOut={(e) => e.currentTarget.style.borderColor = "#27272a"}>
            <div style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7", width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", flexShrink: 0 }}>2</div>
            <div>
              <h3 style={{ color: "white", fontSize: "14px", fontWeight: "bold", margin: "0 0 5px 0", letterSpacing: "1px" }}>SOLO PSL SCAN</h3>
              <p style={{ color: "#a1a1aa", fontSize: "12px", lineHeight: "1.4", margin: 0 }}>Take an AI-powered solo scan to get your baseline face rating.</p>
            </div>
          </div>
        </Link>

        {/* Step 3 */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid #27272a", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "flex-start", gap: "15px" }}>
          <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", flexShrink: 0 }}>3</div>
          <div>
            <h3 style={{ color: "white", fontSize: "14px", fontWeight: "bold", margin: "0 0 5px 0", letterSpacing: "1px" }}>COMPETE & CLIMB</h3>
            <p style={{ color: "#a1a1aa", fontSize: "12px", lineHeight: "1.4", margin: 0 }}>Win audience votes and climb the global ladder.</p>
          </div>
        </div>

      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "clamp(30px, 8vw, 80px)", textAlign: "center" }}>
        {/* <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedUsers >= 1000 ? (animatedUsers / 1000).toFixed(1) + 'K' : animatedUsers}</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>MOGGERS REGISTERED</div></div> */}
        <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedArena + 7458}</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>ACTIVE NOW</div></div>
        <div><div style={{ color: "#ef4444", fontSize: "2.5rem", fontWeight: "900", marginBottom: "5px" }}>{animatedWait.toFixed(1)}S</div><div style={{ color: "#71717a", fontSize: "10px", letterSpacing: "2px" }}>AVG WAIT</div></div>
      </div>


      {/* ─── SEO CONTENT CLUSTER ─── */}
      <div style={{ width: "100%", maxWidth: "1100px", marginTop: "100px", padding: "0 20px", paddingBottom: "120px", textAlign: "left", zIndex: 10, position: "relative" }}>

        {/* BLOG SECTION */}
        <div style={{ marginBottom: "80px" }}>
          {/* Label */}
          <div style={{ display: "inline-block", backgroundColor: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "99px", padding: "4px 14px", marginBottom: "18px" }}>
            <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "700", letterSpacing: "2px" }}>BLOG</span>
          </div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: "900", color: "white", margin: "0 0 32px 0", fontStyle: "italic" }}>Read up before you queue</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {[
              { slug: "blog-how-psl-rating-works",       category: "PSL",      title: "How PSL Rating Actually Works",            description: "Symmetry, harmony, jaw, skin, canthal tilt — what each sub-score measures and why it matters in a mog battle." },
              { slug: "blog-hunter-eyes-vs-prey-eyes",   category: "STRATEGY", title: "Hunter Eyes vs Prey Eyes",                 description: "What they are, why they dominate in mog battles, and what you can actually do about your eye area." },
              { slug: "blog-omegle-alternatives-2026",   category: "CULTURE",  title: "Omegle Alternatives in 2026",              description: "From OmeTV to Monkey App to mogged games — a quick map of the random-video landscape after Omegle shut down." },
              { slug: "blog-how-to-win-mog-battles",     category: "STRATEGY", title: "5 Tips to Win Your First Mog Battle",     description: "Lighting, angles, framing — small pre-match details that swing audience votes more than your raw PSL." },
              { slug: "blog-what-is-mogging",            category: "CULTURE",  title: "What Is Mogging?",                        description: "The complete guide to the term, where it came from, and why millions are competing in mog battles in 2026." },
              { slug: "blog-looksmaxxing-guide-beginners", category: "STRATEGY", title: "Looksmaxxing for Beginners (2026)",    description: "Everything you need to know — what actually works, what doesn't, and how to measure progress objectively." },
            ].map((blog) => (
              <Link href={`/blog/${blog.slug}`} key={blog.slug} style={{ textDecoration: "none" }}>
                <div
                  style={{ backgroundColor: "rgba(255,255,255,0.025)", border: "1px solid #27272a", borderRadius: "14px", padding: "22px", cursor: "pointer", height: "100%", transition: "border-color 0.2s, background 0.2s", display: "flex", flexDirection: "column" }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "#3f3f46"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.045)"; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.025)"; }}
                >
                  <div style={{ display: "inline-block", backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "99px", padding: "3px 10px", marginBottom: "14px", alignSelf: "flex-start" }}>
                    <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: "700", letterSpacing: "2px" }}>{blog.category}</span>
                  </div>
                  <h3 style={{ color: "white", fontSize: "1.05rem", fontWeight: "700", margin: "0 0 10px 0", lineHeight: "1.3" }}>{blog.title}</h3>
                  <p style={{ color: "#a1a1aa", fontSize: "13px", lineHeight: "1.55", margin: "0 0 18px 0", flex: 1 }}>{blog.description}</p>
                  <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "700", letterSpacing: "1.5px" }}>READ ARTICLE →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* FAQ SECTION */}
        <FaqAccordion />
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