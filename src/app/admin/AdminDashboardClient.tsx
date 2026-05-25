"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePresence } from "@/hooks/usePresence";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar, 
  Users, 
  Sword, 
  Award, 
  Share2, 
  Activity, 
  ChevronRight,
  LogOut,
  Search,
  ShieldAlert,
  Ban,
  ShieldCheck,
  Zap,
  UserX,
  FileCode,
  Flame,
  ChevronLeft,
  X
} from "lucide-react";

// Initialize client-side Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AnalyticsEvent {
  id: string;
  event_type: 
    | "session_start" 
    | "battle_join" 
    | "battle_complete" 
    | "share_click"
    | "casual_battle_join"
    | "casual_battle_complete"
    | "casual_share_download"
    | "casual_share_social";
  user_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  elo: number;
  tier: string;
  wins: number;
  matches_played: number;
  current_streak: number;
  highest_streak: number;
  peak_elo: number;
  total_mogs: number;
  total_mogged: number;
  profile_views: number;
  is_banned: boolean;
  report_count: number;
  avatar_url: string;
  created_at: string;
}

interface Match {
  id: string;
  winner_id: string | null;
  loser_id: string | null;
  winner_score: number;
  loser_score: number;
  elo_change: number;
  mode: string;
  created_at: string;
}

interface AdminDashboardClientProps {
  initialEvents: AnalyticsEvent[];
  initialProfiles?: Profile[];
  initialMatches?: Match[];
}

export default function AdminDashboardClient({ 
  initialEvents,
  initialProfiles = [],
  initialMatches = []
}: AdminDashboardClientProps) {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"chart" | "players" | "matches">("chart");

  // ── Real-time presence counter (replaces inflated WebSocket count) ─────
  const { onlineCount } = usePresence();

  const [timeRange, setTimeRange] = useState<"24h" | "30d" | "12w" | "12m">("30d");
  const [activeMetric, setActiveMetric] = useState<
    | "session_start"
    | "battle_join"
    | "battle_complete"
    | "share_click"
    | "signups"
    | "all"
    | "casual_battle_join"
    | "casual_battle_complete"
    | "casual_share_download"
    | "casual_share_social"
    | "active_users"
  >("session_start");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    value: number;
    x: number;
    y: number;
    index: number;
  } | null>(null);

  // Search & Pagination States
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [playersSearch, setPlayersSearch] = useState("");
  const [playersPage, setPlayersPage] = useState(1);
  const playersPerPage = 10;

  const [matchesSearch, setMatchesSearch] = useState("");
  const [matchesPage, setMatchesPage] = useState(1);
  const matchesPerPage = 10;

  // Moderation Feedback & Error diagnostics
  const [moderationError, setModerationError] = useState<{
    message: string;
    profileId: string;
  } | null>(null);


  const now = useMemo(() => new Date(), []);
  const oneDay = 24 * 60 * 60 * 1000;

  // --- CORE ANALYTICAL COMPUTATIONS ---
  const kpis = useMemo(() => {
    const totalSessions = initialEvents.filter(e => e.event_type === "session_start").length;
    const battlesJoined = initialEvents.filter(e => e.event_type === "battle_join" || e.event_type === "casual_battle_join").length;
    const battlesCompleted = initialEvents.filter(e => e.event_type === "battle_complete" || e.event_type === "casual_battle_complete").length;
    const shareClicks = initialEvents.filter(e => e.event_type === "share_click" || e.event_type === "casual_share_download" || e.event_type === "casual_share_social").length;

    const completionRate = battlesJoined > 0 ? Math.round((battlesCompleted / battlesJoined) * 100) : 0;
    const shareRate = battlesCompleted > 0 ? Math.round((shareClicks / battlesCompleted) * 100) : 0;

    // Group user activity
    const userFirstSeen = new Map<string, number>();
    initialEvents.forEach(e => {
      const time = new Date(e.created_at).getTime();
      if (!userFirstSeen.has(e.user_id) || time < userFirstSeen.get(e.user_id)!) {
        userFirstSeen.set(e.user_id, time);
      }
    });

    const uniqueUsers = userFirstSeen.size;
    const sessionsPerUser = uniqueUsers > 0 ? (totalSessions / uniqueUsers).toFixed(1) : "0";

    // DAU (Last 24 Hours)
    const dauUsers = new Set(
      initialEvents
        .filter(e => now.getTime() - new Date(e.created_at).getTime() <= oneDay)
        .map(e => e.user_id)
    );
    const dau = dauUsers.size;

    let newDau = 0, returningDau = 0;
    dauUsers.forEach(uid => {
      (now.getTime() - userFirstSeen.get(uid)! <= oneDay) ? newDau++ : returningDau++;
    });

    // D1 Retention (Yesterday's Cohort)
    let yesterdayCohort = 0, yesterdayRetained = 0;
    userFirstSeen.forEach((firstTime, uid) => {
      const age = now.getTime() - firstTime;
      if (age > oneDay && age <= 2 * oneDay) {
        yesterdayCohort++;
        if (dauUsers.has(uid)) yesterdayRetained++;
      }
    });
    const d1Retention = yesterdayCohort > 0 ? Math.round((yesterdayRetained / yesterdayCohort) * 100) : 0;

    const totalSignups = initialProfiles.length;
    const signupConversion = uniqueUsers > 0 ? Math.min(Math.round((totalSignups / uniqueUsers) * 100), 100) : 0;

    return {
      dau,
      newDau,
      returningDau,
      d1Retention,
      yesterdayCohort,
      completionRate,
      battlesJoined,
      battlesCompleted,
      totalSessions,
      uniqueUsers,
      sessionsPerUser,
      shareClicks,
      shareRate,
      signupConversion
    };
  }, [initialEvents, initialProfiles, now]);

  // --- SECURE SESSION TERMINATION ---
  const handleLogout = () => {
    document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
    window.location.reload();
  };

  // --- MODERATION ACTION HANDLING ---
  const handleToggleBan = async (profileId: string, currentBanStatus: boolean) => {
    setModerationError(null);
    try {
      // Execute security definer RPC
      const { error } = await supabase.rpc("admin_set_ban_status", {
        p_user_id: profileId,
        p_is_banned: !currentBanStatus
      });

      if (error) {
        // Fallback: try a direct update if policy allows
        const { error: directError } = await supabase
          .from("profiles")
          .update({ is_banned: !currentBanStatus })
          .eq("id", profileId);

        if (directError) {
          throw new Error(error.message || directError.message);
        }
      }

      // Sync local state
      setProfiles(prev => 
        prev.map(p => p.id === profileId ? { ...p, is_banned: !currentBanStatus } : p)
      );
    } catch (err: any) {
      console.error("Moderation failure:", err.message);
      setModerationError({
        message: err.message || "Failed to toggle ban. RPC 'admin_set_ban_status' is likely missing or database RLS policies block anonymous updates.",
        profileId
      });
    }
  };

  // --- SEARCH AND FILTER PIPELINES ---
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const search = playersSearch.toLowerCase().trim();
      if (!search) return true;
      return (
        p.username.toLowerCase().includes(search) ||
        p.tier.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search)
      );
    });
  }, [profiles, playersSearch]);

  const paginatedProfiles = useMemo(() => {
    const start = (playersPage - 1) * playersPerPage;
    return filteredProfiles.slice(start, start + playersPerPage);
  }, [filteredProfiles, playersPage]);

  const maxPlayersPage = Math.ceil(filteredProfiles.length / playersPerPage) || 1;

  const filteredMatches = useMemo(() => {
    return initialMatches.filter(m => {
      const search = matchesSearch.toLowerCase().trim();
      if (!search) return true;

      // Find user records
      const winnerName = profiles.find(p => p.id === m.winner_id)?.username || "";
      const loserName = profiles.find(p => p.id === m.loser_id)?.username || "";

      return (
        m.mode.toLowerCase().includes(search) ||
        winnerName.toLowerCase().includes(search) ||
        loserName.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search)
      );
    });
  }, [initialMatches, matchesSearch, profiles]);

  const paginatedMatches = useMemo(() => {
    const start = (matchesPage - 1) * matchesPerPage;
    return filteredMatches.slice(start, start + matchesPerPage);
  }, [filteredMatches, matchesPage]);

  const maxMatchesPage = Math.ceil(filteredMatches.length / matchesPerPage) || 1;

  // --- METRIC THEME COLOR MAP ---
  const getMetricColor = (metricId: string) => {
    if (metricId === "active_users") return "#22c55e"; // Emerald
    if (metricId.startsWith("casual_")) return "#3b82f6"; // Blue
    if (metricId === "session_start") return "#a1a1aa"; // Zinc
    if (metricId === "signups") return "#a855f7"; // Purple
    return "#ef4444"; // Red for ranked/all
  };

  const getMetricColors = (metricId: string) => {
    if (metricId === "active_users") {
      return {
        accent: "#22c55e", // Emerald
        accentDark: "#15803d",
        accentDarker: "#052e16",
        glowColor: "#22c55e",
        bgGradient: "from-green-500 to-emerald-400"
      };
    }
    if (metricId.startsWith("casual_")) {
      return {
        accent: "#3b82f6", // Blue
        accentDark: "#1d4ed8",
        accentDarker: "#172554",
        glowColor: "#3b82f6",
        bgGradient: "from-blue-500 to-indigo-400"
      };
    }
    if (metricId === "session_start") {
      return {
        accent: "#a1a1aa", // Zinc
        accentDark: "#71717a",
        accentDarker: "#27272a",
        glowColor: "#a1a1aa",
        bgGradient: "from-zinc-500 to-zinc-400"
      };
    }
    if (metricId === "signups") {
      return {
        accent: "#a855f7", // Purple
        accentDark: "#7e22ce",
        accentDarker: "#3b0764",
        glowColor: "#a855f7",
        bgGradient: "from-purple-500 to-fuchsia-400"
      };
    }
    return {
      accent: "#ef4444", // Red
      accentDark: "#b91c1c",
      accentDarker: "#450a0a",
      glowColor: "#ef4444",
      bgGradient: "from-red-500 to-rose-400"
    };
  };

  const metricColors = useMemo(() => getMetricColors(activeMetric), [activeMetric]);

  // --- TIME GROUPING & FILTERING LOGIC ---
  const chartData = useMemo(() => {
    const result: { label: string; value: number; date: Date; _users?: Set<string> }[] = [];

    if (timeRange === "24h") {
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        d.setMinutes(0, 0, 0);
        const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        result.push({ label, value: 0, date: d, _users: new Set() });
      }
      if (activeMetric === "signups") {
        initialProfiles.forEach(p => {
          if (!p.created_at) return;
          const pd = new Date(p.created_at);
          if (now.getTime() - pd.getTime() <= 24 * 60 * 60 * 1000) {
            const hourIndex = result.findIndex(r => {
              return pd.getHours() === r.date.getHours() && pd.getDate() === r.date.getDate();
            });
            if (hourIndex !== -1) {
              result[hourIndex].value++;
            }
          }
        });
      } else {
        initialEvents.forEach(e => {
          const ed = new Date(e.created_at);
          if (now.getTime() - ed.getTime() <= 24 * 60 * 60 * 1000) {
            const hourIndex = result.findIndex(r => {
              return ed.getHours() === r.date.getHours() && ed.getDate() === r.date.getDate();
            });
            if (hourIndex !== -1) {
              if (activeMetric === "all" || e.event_type === activeMetric) {
                result[hourIndex].value++;
              }
              if (activeMetric === "active_users") {
                if (e.user_id) result[hourIndex]._users!.add(e.user_id);
              }
            }
          }
        });
      }
    } else if (timeRange === "30d") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        d.setHours(0, 0, 0, 0);
        const label = d.toLocaleDateString([], { month: "short", day: "2-digit" });
        result.push({ label, value: 0, date: d, _users: new Set() });
      }
      if (activeMetric === "signups") {
        initialProfiles.forEach(p => {
          if (!p.created_at) return;
          const pd = new Date(p.created_at);
          if (now.getTime() - pd.getTime() <= 30 * 24 * 60 * 60 * 1000) {
            const dayIndex = result.findIndex(r => {
              return pd.getDate() === r.date.getDate() && pd.getMonth() === r.date.getMonth();
            });
            if (dayIndex !== -1) {
              result[dayIndex].value++;
            }
          }
        });
      } else {
        initialEvents.forEach(e => {
          const ed = new Date(e.created_at);
          if (now.getTime() - ed.getTime() <= 30 * 24 * 60 * 60 * 1000) {
            const dayIndex = result.findIndex(r => {
              return ed.getDate() === r.date.getDate() && ed.getMonth() === r.date.getMonth();
            });
            if (dayIndex !== -1) {
              if (activeMetric === "all" || e.event_type === activeMetric) {
                result[dayIndex].value++;
              }
              if (activeMetric === "active_users") {
                if (e.user_id) result[dayIndex]._users!.add(e.user_id);
              }
            }
          }
        });
      }
    } else if (timeRange === "12w") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        const label = "Wk of " + startOfWeek.toLocaleDateString([], { month: "short", day: "numeric" });
        result.push({ label, value: 0, date: startOfWeek, _users: new Set() });
      }
      if (activeMetric === "signups") {
        initialProfiles.forEach(p => {
          if (!p.created_at) return;
          const pd = new Date(p.created_at);
          if (now.getTime() - pd.getTime() <= 12 * 7 * 24 * 60 * 60 * 1000) {
            let matchedIndex = -1;
            for (let i = 0; i < result.length; i++) {
              const bucketStart = result[i].date.getTime();
              const bucketEnd = bucketStart + 7 * 24 * 60 * 60 * 1000;
              if (pd.getTime() >= bucketStart && pd.getTime() < bucketEnd) {
                matchedIndex = i;
                break;
              }
            }
            if (matchedIndex !== -1) {
              result[matchedIndex].value++;
            }
          }
        });
      } else {
        initialEvents.forEach(e => {
          const ed = new Date(e.created_at);
          if (now.getTime() - ed.getTime() <= 12 * 7 * 24 * 60 * 60 * 1000) {
            let matchedIndex = -1;
            for (let i = 0; i < result.length; i++) {
              const bucketStart = result[i].date.getTime();
              const bucketEnd = bucketStart + 7 * 24 * 60 * 60 * 1000;
              if (ed.getTime() >= bucketStart && ed.getTime() < bucketEnd) {
                matchedIndex = i;
                break;
              }
            }
            if (matchedIndex !== -1) {
              if (activeMetric === "all" || e.event_type === activeMetric) {
                result[matchedIndex].value++;
              }
              if (activeMetric === "active_users") {
                if (e.user_id) result[matchedIndex]._users!.add(e.user_id);
              }
            }
          }
        });
      }
    } else if (timeRange === "12m") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString([], { month: "short", year: "2-digit" });
        result.push({ label, value: 0, date: d, _users: new Set() });
      }
      if (activeMetric === "signups") {
        initialProfiles.forEach(p => {
          if (!p.created_at) return;
          const pd = new Date(p.created_at);
          const monthIndex = result.findIndex(r => {
            return pd.getMonth() === r.date.getMonth() && pd.getFullYear() === r.date.getFullYear();
          });
          if (monthIndex !== -1) {
            result[monthIndex].value++;
          }
        });
      } else {
        initialEvents.forEach(e => {
          const ed = new Date(e.created_at);
          const monthIndex = result.findIndex(r => {
            return ed.getMonth() === r.date.getMonth() && ed.getFullYear() === r.date.getFullYear();
          });
          if (monthIndex !== -1) {
            if (activeMetric === "all" || e.event_type === activeMetric) {
              result[monthIndex].value++;
            }
            if (activeMetric === "active_users") {
              if (e.user_id) result[monthIndex]._users!.add(e.user_id);
            }
          }
        });
      }
    }

    if (activeMetric === "active_users") {
      result.forEach(r => {
        r.value = r._users ? r._users.size : 0;
      });
    }

    return result;
  }, [initialEvents, initialProfiles, timeRange, activeMetric, now]);

  // --- SVG PLOTTING PARAMETERS ---
  const svgParams = useMemo(() => {
    const width = 1000;
    const height = 320;
    const paddingTop = 30;
    const paddingBottom = 40;
    const paddingLeft = 50;
    const paddingRight = 30;

    const values = chartData.map(d => d.value);
    const maxValue = Math.max(...values, 5);

    const points = chartData.map((d, index) => {
      const x = paddingLeft + (index / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - (d.value / maxValue) * (height - paddingTop - paddingBottom);
      return { x, y, label: d.label, value: d.value, index };
    });

    return { width, height, points, maxValue, paddingLeft, paddingRight, paddingTop, paddingBottom };
  }, [chartData]);

  // Build polyline path
  const linePath = useMemo(() => {
    if (svgParams.points.length === 0) return "";
    return svgParams.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [svgParams]);

  // Build area fill path under the line
  const areaPath = useMemo(() => {
    if (svgParams.points.length === 0) return "";
    const firstPoint = svgParams.points[0];
    const lastPoint = svgParams.points[svgParams.points.length - 1];
    const bottomY = svgParams.height - svgParams.paddingBottom;
    return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
  }, [svgParams, linePath]);

  // Funnel conversions
  const funnelSteps = useMemo(() => {
    const step1 = kpis.totalSessions;
    const step2 = kpis.battlesJoined;
    const step3 = kpis.battlesCompleted;
    const step4 = kpis.shareClicks;

    const getPercent = (value: number, base: number) => 
      base > 0 ? Math.round((value / base) * 100) : 0;

    return [
      { name: "Website Sessions", count: step1, percent: 100, color: "from-zinc-500 to-zinc-400" },
      { name: "Battles Joined", count: step2, percent: getPercent(step2, step1), color: "from-blue-500 to-cyan-400" },
      { name: "Battles Completed", count: step3, percent: getPercent(step3, step2), color: "from-green-500 to-emerald-400" },
      { name: "Score Shared", count: step4, percent: getPercent(step4, step3), color: "from-purple-500 to-fuchsia-400" },
    ];
  }, [kpis]);

  // Feed logs
  const feedLogs = useMemo(() => {
    return initialEvents
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [initialEvents]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "session_start":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-zinc-800 bg-zinc-900/60 text-zinc-400 tracking-wider">SESSION</span>;
      case "battle_join":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-cyan-900 bg-cyan-950/40 text-cyan-400 tracking-wider">BATTLE JOIN</span>;
      case "battle_complete":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-green-900 bg-green-950/40 text-green-400 tracking-wider">BATTLE COMP</span>;
      case "share_click":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-purple-900 bg-purple-950/40 text-purple-400 tracking-wider">SHARE CLICK</span>;
      case "casual_battle_join":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-blue-900 bg-blue-950/40 text-blue-400 tracking-wider">CASUAL JOIN</span>;
      case "casual_battle_complete":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-indigo-900 bg-indigo-950/40 text-indigo-400 tracking-wider">CASUAL COMP</span>;
      case "casual_share_download":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-sky-900 bg-sky-950/40 text-sky-400 tracking-wider">CASUAL DL</span>;
      case "casual_share_social":
        return <span className="px-2.5 py-1 rounded text-[9px] font-bold border border-emerald-900 bg-emerald-950/40 text-emerald-400 tracking-wider">CASUAL SHARE</span>;
      default:
        return null;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white p-6 md:p-10 font-mono selection:bg-red-500 selection:text-black">
      
      {/* Sleek Cyberpunk Header HUD */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-zinc-800/60 pb-8 mb-8 relative">
        <div className="absolute top-0 right-0 text-[10px] text-zinc-800 font-bold hidden xl:block uppercase">
          SECURE IP LINKED // ACCESS LEVEL 1
        </div>
        
        <div>
          <div className="flex items-center gap-2 text-red-500 text-[10px] font-black tracking-[0.3em] uppercase mb-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
            OMOGGLE SECURE BATTLECOM PANEL
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-none">
            TELEMETRY FEED <span className="text-zinc-700">//</span> CENTRAL HQ
          </h1>
        </div>

        {/* Header control buttons */}
        <div className="flex flex-wrap items-center gap-3">

          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-red-500/50 hover:bg-red-950/20 text-xs font-bold text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer shadow-lg shadow-red-950/10"
          >
            <LogOut size={14} />
            <span>TERMINATE SESSION</span>
          </button>
        </div>
      </div>



      {/* Moderation Failures System Banner */}
      {moderationError && (
        <div className="border border-red-900 bg-red-950/20 px-6 py-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex gap-3 items-start">
            <ShieldAlert size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-xs uppercase tracking-wider text-red-400 block mb-0.5">MODERATION TRANS-LOG VIOLATION</span>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {moderationError.message}
              </p>
            </div>
          </div>
          <div className="flex gap-2">

            <button
              onClick={() => setModerationError(null)}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase rounded text-zinc-500 hover:text-white transition-all cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* Grid of Key Performance Indicators (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* KPI 1: Live Active Users — Supabase Presence */}
        <div className="relative group overflow-hidden border border-emerald-900/50 p-5 bg-zinc-950/40 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:border-emerald-700/60 min-h-[130px]">
          <div className="absolute top-4 right-4 opacity-5 text-white pointer-events-none">
            <Users style={{ width: "52px", height: "52px" }} />
          </div>
          <p className="text-zinc-500 text-[10px] tracking-wider uppercase mb-1.5">LIVE USERS ONLINE</p>
          <div className="flex items-center gap-3">
            <p className="text-4xl font-black tracking-tighter text-emerald-400">{onlineCount}</p>
            {/* Pulse dot */}
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.9)", display: "inline-block", flexShrink: 0 }} />
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 font-sans">
            Via <span className="text-emerald-400 font-mono font-bold mx-1">Supabase Presence</span> — zero inflation
          </div>
        </div>

        {/* KPI 2: Registered Profiles */}
        <div className="relative group overflow-hidden border border-zinc-800/80 p-5 bg-zinc-950/40 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:border-zinc-700 min-h-[130px]">
          <div className="absolute top-4 right-4 opacity-5 text-white pointer-events-none">
            <ShieldCheck style={{ width: "52px", height: "52px" }} />
          </div>
          <p className="text-zinc-500 text-[10px] tracking-wider uppercase mb-1.5">REGISTERED PLAYERS</p>
          <p className="text-4xl font-black tracking-tighter text-cyan-400">{profiles.length}</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 font-sans">
            Total users stored in <span className="text-zinc-300 font-mono">profiles</span>
          </div>
        </div>

        {/* KPI 3: Total Battles Logged */}
        <div className="relative group overflow-hidden border border-zinc-800/80 p-5 bg-zinc-950/40 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:border-zinc-700 min-h-[130px]">
          <div className="absolute top-4 right-4 opacity-5 text-white pointer-events-none">
            <Sword style={{ width: "52px", height: "52px" }} />
          </div>
          <p className="text-zinc-500 text-[10px] tracking-wider uppercase mb-1.5">TOTAL BATTLES LOGGED</p>
          <p className="text-4xl font-black tracking-tighter text-emerald-500">{initialMatches.length}</p>
          <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 font-sans">
            <span className="text-emerald-400 font-mono font-bold">{initialMatches.filter(m => m.mode?.toUpperCase() === 'RANKED').length}</span> RANKED
            <span className="text-zinc-800 font-bold">•</span>
            <span className="text-blue-400 font-mono font-bold">{initialMatches.filter(m => m.mode?.toUpperCase() === 'CASUAL').length}</span> CASUAL
          </div>
        </div>

        {/* KPI 4: Sign Up Conversion */}
        <div className="relative group overflow-hidden border border-zinc-800/80 p-5 bg-zinc-950/40 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:border-zinc-700 min-h-[130px]">
          <div className="absolute top-4 right-4 opacity-5 text-white pointer-events-none">
            <Users style={{ width: "52px", height: "52px" }} />
          </div>
          <p className="text-zinc-500 text-[10px] tracking-wider uppercase mb-1.5">SIGN UP CONVERSION</p>
          <p className="text-4xl font-black tracking-tighter text-purple-500">{kpis.signupConversion}%</p>
          <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3 font-sans">
            <span className="text-purple-400 font-mono font-bold">{profiles.length}</span> conversion actions
          </div>
        </div>
      </div>

      {/* Modern Cyberpunk Terminal Tab Bar */}
      <div className="flex gap-2 border-b border-zinc-800/60 mb-6 pb-px overflow-x-auto">
        <button 
          onClick={() => setActiveTab("chart")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-widest relative transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === "chart" ? "text-red-500" : "text-zinc-500 hover:text-white"
          }`}
        >
          <BarChart3 size={14} />
          <span>Datalink Chart & Funnel</span>
          {activeTab === "chart" && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-500"></div>}
        </button>
        
        <button 
          onClick={() => setActiveTab("players")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-widest relative transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === "players" ? "text-red-500" : "text-zinc-500 hover:text-white"
          }`}
        >
          <Users size={14} />
          <span>Player Database ({profiles.length})</span>
          {activeTab === "players" && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-500"></div>}
        </button>

        <button 
          onClick={() => setActiveTab("matches")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-widest relative transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 ${
            activeTab === "matches" ? "text-red-500" : "text-zinc-500 hover:text-white"
          }`}
        >
          <Sword size={14} />
          <span>Global Matches Log ({initialMatches.length})</span>
          {activeTab === "matches" && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-500"></div>}
        </button>
      </div>

      {/* Tab 1: Aggregated Analytics Graph & Event Ticker */}
      {activeTab === "chart" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Main Chart Box */}
          <div className="border border-zinc-800 bg-zinc-950/20 backdrop-blur-2xl rounded-2xl p-5 md:p-6 shadow-2xl">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
              <div>
                <h2 className="text-base font-black tracking-tight text-white mb-0.5">TELEMETRY HISTOGRAM</h2>
                <p className="text-zinc-600 text-[10px] uppercase font-bold">SYSTEM VISITS AND INTERACTION FREQUENCY</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                {/* Metric Selectors */}
                <div className="flex flex-wrap p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl gap-0.5 max-w-full">
                  {[
                    { id: "session_start", label: "Sessions", icon: <Clock size={11} /> },
                    { id: "battle_join", label: "Ranked Joins", icon: <Sword size={11} /> },
                    { id: "battle_complete", label: "Ranked Completed", icon: <Award size={11} /> },
                    { id: "share_click", label: "Ranked Shares", icon: <Share2 size={11} /> },
                    { id: "casual_battle_join", label: "Casual Joins", icon: <Sword size={11} /> },
                    { id: "casual_battle_complete", label: "Casual Completed", icon: <Award size={11} /> },
                    { id: "casual_share_download", label: "Casual Downloads", icon: <Share2 size={11} /> },
                    { id: "casual_share_social", label: "Casual Shares", icon: <Share2 size={11} /> },
                    { id: "active_users", label: "Active Users", icon: <Activity size={11} /> },
                    { id: "signups", label: "Sign Ups", icon: <Users size={11} /> },
                    { id: "all", label: "All Events", icon: <Activity size={11} /> },
                  ].map(metric => (
                    <button
                      key={metric.id}
                      onClick={() => {
                        setActiveMetric(metric.id as any);
                        setHoveredPoint(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                        activeMetric === metric.id
                          ? "bg-zinc-900 border border-zinc-800 shadow-md"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                      style={{
                        color: activeMetric === metric.id ? getMetricColor(metric.id) : undefined
                      }}
                    >
                      {metric.icon}
                      <span>{metric.label}</span>
                    </button>
                  ))}
                </div>

                {/* Scaling Intervals Selector */}
                <div className="flex p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl gap-0.5 flex-shrink-0">
                  {[
                    { id: "24h", label: "24H" },
                    { id: "30d", label: "30D" },
                    { id: "12w", label: "12W" },
                    { id: "12m", label: "12M" }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setTimeRange(opt.id as any);
                        setHoveredPoint(null);
                      }}
                      className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        timeRange === opt.id
                          ? "bg-zinc-900 border border-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Graph Styles */}
                <div className="flex p-0.5 bg-zinc-950 border border-zinc-800 rounded-xl flex-shrink-0">
                  <button
                    onClick={() => setChartType("line")}
                    className={`p-2 rounded-lg transition-all cursor-pointer ${chartType === "line" ? "bg-zinc-900 text-red-500 border border-zinc-800" : "text-zinc-500 hover:text-white"}`}
                  >
                    <TrendingUp size={14} />
                  </button>
                  <button
                    onClick={() => setChartType("bar")}
                    className={`p-2 rounded-lg transition-all cursor-pointer ${chartType === "bar" ? "bg-zinc-900 text-red-500 border border-zinc-800" : "text-zinc-500 hover:text-white"}`}
                  >
                    <BarChart3 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* SVG Render Graphic */}
            <div className="relative w-full overflow-x-auto bg-[#08080a] border border-zinc-900 rounded-xl p-3">
              <div className="min-w-[800px] relative">
                <svg
                  viewBox={`0 0 ${svgParams.width} ${svgParams.height}`}
                  className="w-full h-auto overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metricColors.accent} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={metricColors.accent} stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metricColors.accent} stopOpacity="0.75" />
                      <stop offset="100%" stopColor={metricColors.accentDark} stopOpacity="0.15" />
                    </linearGradient>
                    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={metricColors.glowColor} floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Horizontal Guide Rules */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                    const y = svgParams.paddingTop + ratio * (svgParams.height - svgParams.paddingTop - svgParams.paddingBottom);
                    const value = Math.round(svgParams.maxValue * (1 - ratio));
                    return (
                      <g key={index}>
                        <line
                          x1={svgParams.paddingLeft}
                          y1={y}
                          x2={svgParams.width - svgParams.paddingRight}
                          y2={y}
                          stroke="#27272a"
                          strokeOpacity="0.4"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={svgParams.paddingLeft - 10}
                          y={y + 3}
                          fill="#52525b"
                          fontSize="9.5"
                          textAnchor="end"
                          fontWeight="bold"
                        >
                          {value}
                        </text>
                      </g>
                    );
                  })}

                  {chartType === "line" ? (
                    <>
                      {/* Area Fill */}
                      <path d={areaPath} fill="url(#lineGradient)" />

                      {/* Polyline */}
                      <path
                        d={linePath}
                        fill="none"
                        stroke={metricColors.accent}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#neonGlow)"
                      />

                      {/* Nodes */}
                      {svgParams.points.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredPoint?.index === i ? "6" : "3.5"}
                          fill={hoveredPoint?.index === i ? "#ffffff" : "#09090b"}
                          stroke={hoveredPoint?.index === i ? metricColors.accent : metricColors.accentDark}
                          strokeWidth={hoveredPoint?.index === i ? "3" : "2"}
                          className="cursor-pointer transition-all duration-100"
                          onMouseEnter={() => {
                            setHoveredPoint({
                              label: p.label,
                              value: p.value,
                              x: p.x,
                              y: p.y,
                              index: p.index
                            });
                          }}
                        />
                      ))}
                    </>
                  ) : (
                    // Bar Charts
                    svgParams.points.map((p, i) => {
                      const barWidth = Math.max(10, (svgParams.width - svgParams.paddingLeft - svgParams.paddingRight) / (chartData.length * 1.6));
                      const bottomY = svgParams.height - svgParams.paddingBottom;
                      const barHeight = bottomY - p.y;
                      return (
                        <rect
                          key={i}
                          x={p.x - barWidth / 2}
                          y={p.y}
                          width={barWidth}
                          height={Math.max(barHeight, 2)}
                          fill="url(#barGradient)"
                          stroke={metricColors.accent}
                          strokeWidth="1"
                          rx="2"
                          className="cursor-pointer transition-all duration-150 hover:opacity-80"
                          onMouseEnter={() => {
                            setHoveredPoint({
                              label: p.label,
                              value: p.value,
                              x: p.x,
                              y: p.y,
                              index: p.index
                            });
                          }}
                        />
                      );
                    })
                  )}

                  {/* Horizontal axis timestamp labels */}
                  {chartData.map((d, index) => {
                    const skipAmount = Math.ceil(chartData.length / 8);
                    if (index % skipAmount !== 0 && index !== chartData.length - 1) return null;

                    const p = svgParams.points[index];
                    return (
                      <text
                        key={index}
                        x={p.x}
                        y={svgParams.height - 12}
                        fill="#4b5563"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {d.label}
                      </text>
                    );
                  })}
                </svg>

                {/* Floating tooltip */}
                {hoveredPoint && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${(hoveredPoint.x / svgParams.width) * 100}%`,
                      top: `${(hoveredPoint.y / svgParams.height) * 100 - 15}%`,
                      transform: "translate(-50%, -100%)",
                      borderColor: `${metricColors.accent}cc`,
                      boxShadow: `0 0 20px ${metricColors.accent}40`,
                    }}
                    className="pointer-events-none z-30 min-w-[120px] px-3 py-2 bg-black border rounded-xl backdrop-blur-md transition-all duration-75"
                  >
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">{hoveredPoint.label}</p>
                    <div className="flex items-center gap-1.5 text-white font-extrabold text-base">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metricColors.accent }}></span>
                      {hoveredPoint.value} <span className="text-[10px] text-zinc-400 font-normal font-sans">EVENTS</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grid Bottom: Conversion and Realtime Stream events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Acquisition Conversion steps */}
            <div className="border border-zinc-800 bg-zinc-950/20 backdrop-blur-2xl rounded-2xl p-5 md:p-6 lg:col-span-1 shadow-xl">
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold tracking-wider uppercase mb-5">
                <BarChart3 size={12} className="text-red-500" />
                CONVERSION ACQUISITION FUNNEL
              </div>

              <div className="flex flex-col gap-4">
                {funnelSteps.map((step, idx) => (
                  <div key={idx} className="relative p-3.5 bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden">
                    <div 
                      style={{ width: `${step.percent}%` }}
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${step.color} opacity-[0.03]`}
                    ></div>

                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <h4 className="text-zinc-400 text-[10px] font-bold uppercase mb-0.5">{step.name}</h4>
                        <span className="text-white text-xl font-black">{step.count}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-600 text-[9px] font-bold uppercase block">RATIO</span>
                        <span className="text-red-500 text-base font-black">{step.percent}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Ticker Table */}
            <div className="border border-zinc-800 bg-zinc-950/20 backdrop-blur-2xl rounded-2xl p-5 md:p-6 lg:col-span-2 shadow-xl">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-bold tracking-wider uppercase">
                  <Activity size={12} className="text-red-500 animate-pulse" />
                  REAL-TIME ACTION STRIPS (LAST 8)
                </div>
                <span className="text-[9px] text-zinc-600 border border-zinc-800 rounded-lg px-2 py-0.5 bg-zinc-950 font-bold">SYSTEM RED LIVE</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-900 pb-2.5 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                      <th className="pb-2.5 pr-4">ANON USER REFERENCE</th>
                      <th className="pb-2.5 px-4">EVENT DECRYPTION</th>
                      <th className="pb-2.5 pl-4 text-right">TIMESTAMP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedLogs.map((log) => (
                      <tr 
                        key={log.id} 
                        className="border-b border-zinc-900/60 hover:bg-zinc-900/10 transition-colors text-xs font-mono text-zinc-400"
                      >
                        <td className="py-3.5 pr-4 font-bold flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-800"></span>
                          {log.user_id ? log.user_id.substring(0, 14) + "..." : "Anonymous Guest"}
                        </td>
                        <td className="py-3.5 px-4">
                          {getEventBadge(log.event_type)}
                        </td>
                        <td className="py-3.5 pl-4 text-right text-zinc-500">
                          {getRelativeTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                    {feedLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-zinc-600 font-bold uppercase text-xs">
                          No events recorded in timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: User Profiles Management Directory */}
      {activeTab === "players" && (
        <div className="border border-zinc-800 bg-zinc-950/20 backdrop-blur-2xl rounded-2xl p-5 md:p-6 shadow-2xl animate-fade-in space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight text-white mb-0.5">REGISTERED PLAYER DIRECTORY</h2>
              <p className="text-zinc-600 text-[10px] uppercase font-bold">MODERATE REGISTRATIONS, combat stats AND USER ELIGIBILITY</p>
            </div>
            
            {/* Search Input Box */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="SEARCH USERNAME, TIER, OR ID..."
                value={playersSearch}
                onChange={(e) => {
                  setPlayersSearch(e.target.value);
                  setPlayersPage(1);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white uppercase tracking-wider outline-none transition-all placeholder:text-zinc-700 font-mono"
              />
              <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-700" />
            </div>
          </div>

          {/* Directory Database Grid */}
          <div className="overflow-x-auto border border-zinc-900 rounded-xl">
            <table className="w-full border-collapse text-left text-xs min-w-[900px]">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4">USER PROFILE</th>
                  <th className="p-4 text-center">ELO SCORE</th>
                  <th className="p-4 text-center">RANK TIER</th>
                  <th className="p-4 text-center">WINS / TOTAL</th>
                  <th className="p-4 text-center">MOGS STREAK</th>
                  <th className="p-4 text-center">PROFILE VIEWS</th>
                  <th className="p-4 text-center">REPORTS</th>
                  <th className="p-4 text-right">MODERATION ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 font-mono text-zinc-300">
                {paginatedProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/20 transition-all">
                    {/* User profile identifier */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full border border-zinc-800 overflow-hidden flex-shrink-0 bg-zinc-900 flex items-center justify-center">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-zinc-600 font-black text-xs">{p.username[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-extrabold text-white flex items-center gap-1.5">
                            <span>{p.username}</span>
                            {p.is_banned && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] bg-red-950/60 text-red-500 border border-red-900 font-bold uppercase">BANNED</span>
                            )}
                          </div>
                          <span className="text-[9px] text-zinc-600 block mt-0.5">{p.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Elo rating */}
                    <td className="p-4 text-center font-extrabold text-white">
                      {p.elo}
                    </td>

                    {/* Tier badge */}
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold border ${
                        p.tier === "CHAD" || p.tier === "GIGA"
                          ? "bg-red-950/40 text-red-400 border-red-900"
                          : p.tier === "MTN"
                          ? "bg-cyan-950/40 text-cyan-400 border-cyan-900"
                          : "bg-zinc-900/40 text-zinc-400 border-zinc-850"
                      } tracking-wider`}>
                        {p.tier}
                      </span>
                    </td>

                    {/* Record */}
                    <td className="p-4 text-center text-zinc-400 font-medium">
                      <span className="text-emerald-500 font-bold">{p.wins}</span> W
                      <span className="mx-1 text-zinc-800">/</span>
                      <span className="text-zinc-400 font-bold">{p.matches_played}</span> PLAYED
                    </td>

                    {/* Mog Streaks */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Flame size={12} className={p.current_streak > 0 ? "text-orange-500 fill-orange-500" : "text-zinc-800"} />
                        <span className={p.current_streak > 0 ? "text-orange-400 font-bold" : "text-zinc-500"}>
                          {p.current_streak}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-sans">
                          (pk: {p.highest_streak})
                        </span>
                      </div>
                    </td>

                    {/* Views */}
                    <td className="p-4 text-center text-zinc-500 font-bold">
                      {p.profile_views}
                    </td>

                    {/* Report metrics count */}
                    <td className="p-4 text-center">
                      <span className={`font-bold ${p.report_count > 0 ? "text-red-500" : "text-zinc-600"}`}>
                        {p.report_count}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleBan(p.id, p.is_banned)}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all tracking-wider inline-flex items-center gap-1.5 cursor-pointer hover:scale-[1.03] ${
                          p.is_banned
                            ? "bg-green-950/20 hover:bg-green-950/40 text-green-400 border-green-900/60"
                            : "bg-red-950/20 hover:bg-red-950/40 text-red-400 border-red-900/60"
                        }`}
                      >
                        {p.is_banned ? (
                          <>
                            <ShieldCheck size={11} />
                            <span>UNBAN PROFILE</span>
                          </>
                        ) : (
                          <>
                            <Ban size={11} />
                            <span>BAN USER</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-zinc-600 font-bold uppercase tracking-wider text-xs">
                      No player profiles match your query filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination panel */}
          {maxPlayersPage > 1 && (
            <div className="flex justify-between items-center border-t border-zinc-900 pt-4">
              <span className="text-[10px] text-zinc-600 font-bold uppercase">
                SHOWING {Math.min(filteredProfiles.length, (playersPage - 1) * playersPerPage + 1)}-{Math.min(filteredProfiles.length, playersPage * playersPerPage)} OF {filteredProfiles.length} PLAYERS
              </span>

              <div className="flex gap-1">
                <button
                  disabled={playersPage === 1}
                  onClick={() => setPlayersPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:border-zinc-800 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-white flex items-center justify-center">
                  PAGE {playersPage} / {maxPlayersPage}
                </span>
                <button
                  disabled={playersPage === maxPlayersPage}
                  onClick={() => setPlayersPage(p => Math.min(maxPlayersPage, p + 1))}
                  className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:border-zinc-800 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Global Matches Log Table */}
      {activeTab === "matches" && (
        <div className="border border-zinc-800 bg-zinc-950/20 backdrop-blur-2xl rounded-2xl p-5 md:p-6 shadow-2xl animate-fade-in space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-black tracking-tight text-white mb-0.5">GLOBAL MATCHES LOG</h2>
              <p className="text-zinc-600 text-[10px] uppercase font-bold">COMPREHENSIVE TELEMETRY DATABASE OF COMBAT LOGS</p>
            </div>
            
            {/* Match Search Input */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="SEARCH BY MODE, ID, OR PLAYER NAME..."
                value={matchesSearch}
                onChange={(e) => {
                  setMatchesSearch(e.target.value);
                  setMatchesPage(1);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white uppercase tracking-wider outline-none transition-all placeholder:text-zinc-700 font-mono"
              />
              <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-700" />
            </div>
          </div>

          {/* Database Matches Table */}
          <div className="overflow-x-auto border border-zinc-900 rounded-xl">
            <table className="w-full border-collapse text-left text-xs min-w-[800px]">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                  <th className="p-4">BATTLE SESSION ID</th>
                  <th className="p-4 text-center">MODE TYPE</th>
                  <th className="p-4">WINNING GLADIATOR</th>
                  <th className="p-4">DEFEATED OPONENT</th>
                  <th className="p-4 text-center">SCORING TALLIES</th>
                  <th className="p-4 text-center">ELO SHIFT</th>
                  <th className="p-4 text-right">BATTLE FINISHED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 font-mono text-zinc-400">
                {paginatedMatches.map((m) => {
                  const winner = profiles.find(p => p.id === m.winner_id);
                  const loser = profiles.find(p => p.id === m.loser_id);

                  return (
                    <tr key={m.id} className="hover:bg-zinc-900/20 transition-all">
                      {/* Battle ID */}
                      <td className="p-4 text-zinc-500 font-bold select-all">
                        {m.id.substring(0, 18)}...
                      </td>

                      {/* Battle Mode */}
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-[9px] font-bold border ${
                          m.mode?.toUpperCase() === "RANKED"
                            ? "bg-red-950/40 text-red-400 border-red-900"
                            : m.mode?.toUpperCase() === "CASUAL"
                            ? "bg-blue-950/40 text-blue-400 border-blue-900"
                            : "bg-zinc-900/40 text-zinc-400 border-zinc-850"
                        } tracking-widest uppercase`}>
                          {m.mode}
                        </span>
                      </td>

                      {/* Winner username */}
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center flex-shrink-0 text-[8px]">
                            {winner?.avatar_url ? (
                              <img src={winner.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>W</span>
                            )}
                          </div>
                          <span>{winner?.username || "Unknown Gladiator"}</span>
                        </div>
                      </td>

                      {/* Loser username */}
                      <td className="p-4 text-zinc-400">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center flex-shrink-0 text-[8px]">
                            {loser?.avatar_url ? (
                              <img src={loser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>L</span>
                            )}
                          </div>
                          <span>{loser?.username || "Unknown Opponent"}</span>
                        </div>
                      </td>

                      {/* Score tallies */}
                      <td className="p-4 text-center font-extrabold text-white">
                        <span className="text-emerald-500">{m.winner_score}</span>
                        <span className="mx-1 text-zinc-650">:</span>
                        <span className="text-red-500">{m.loser_score}</span>
                      </td>

                      {/* Elo Shift */}
                      <td className="p-4 text-center font-bold text-white">
                        <span className="text-red-500">+{m.elo_change}</span> ELO
                      </td>

                      {/* Battle timestamp */}
                      <td className="p-4 text-right text-zinc-500 font-sans text-xs">
                        {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}

                {filteredMatches.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-zinc-600 font-bold uppercase tracking-wider text-xs">
                      No battle session records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination panel */}
          {maxMatchesPage > 1 && (
            <div className="flex justify-between items-center border-t border-zinc-900 pt-4">
              <span className="text-[10px] text-zinc-600 font-bold uppercase">
                SHOWING {Math.min(filteredMatches.length, (matchesPage - 1) * matchesPerPage + 1)}-{Math.min(filteredMatches.length, matchesPage * matchesPerPage)} OF {filteredMatches.length} BATTLES
              </span>

              <div className="flex gap-1">
                <button
                  disabled={matchesPage === 1}
                  onClick={() => setMatchesPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:border-zinc-800 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-white flex items-center justify-center">
                  PAGE {matchesPage} / {maxMatchesPage}
                </span>
                <button
                  disabled={matchesPage === maxMatchesPage}
                  onClick={() => setMatchesPage(p => Math.min(maxMatchesPage, p + 1))}
                  className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:border-zinc-800 transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
