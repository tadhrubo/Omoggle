import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import AdminDashboardClient from "./AdminDashboardClient";
import AdminLogin from "./AdminLogin";
import { getPrestigeRank } from "@/utils/eloMath";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // ─── ADMIN SESSION AUTHENTICATION ───
  const cookieStore = await cookies();
  const adminSession = cookieStore.get("admin_session")?.value;

  const adminPassword = process.env.ADMIN_PASSWORD || "omoggleadmin2026";
  const expectedToken = Buffer.from(adminPassword).toString("base64");

  if (adminSession !== expectedToken) {
    return <AdminLogin />;
  }

  // ─── TELEMETRY DATA FETCHING ───
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch last 90 days of analytics events
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [eventsResult, profilesResult, matchesResult] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("*")
      .gte("created_at", ninetyDaysAgo.toISOString()),
    
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  if (eventsResult.error || profilesResult.error || matchesResult.error) {
    const errorDetails = eventsResult.error?.message || profilesResult.error?.message || matchesResult.error?.message;
    return (
      <div className="min-h-screen bg-black text-red-500 flex flex-col justify-center items-center font-mono p-10 gap-4">
        <h1 className="text-2xl font-black tracking-widest uppercase">DATALINK CRITICAL FAILURE</h1>
        <p className="text-sm text-zinc-500">Failed to establish connection to analytics dataset.</p>
        <code className="text-xs bg-red-950/40 border border-red-900 px-4 py-2 rounded text-red-400 max-w-lg overflow-x-auto">
          {errorDetails}
        </code>
      </div>
    );
  }

  // Prepare safe data transfers
  const safeEvents = (eventsResult.data || []).map((e: any) => ({
    id: e.id,
    event_type: e.event_type,
    user_id: e.user_id,
    created_at: e.created_at,
  }));


  const safeProfiles = (profilesResult.data || []).map((p: any) => ({
    id: p.id,
    username: p.username || "Anonymous Player",
    elo: p.elo || 1200,
    tier: getPrestigeRank(p.elo || 1200),
    wins: p.wins || 0,
    matches_played: p.matches_played || 0,
    current_streak: p.current_streak || 0,
    highest_streak: p.highest_streak || 0,
    peak_elo: p.peak_elo || 1200,
    total_mogs: p.total_mogs || 0,
    total_mogged: p.total_mogged || 0,
    profile_views: p.profile_views || 0,
    is_banned: p.is_banned || false,
    report_count: p.report_count || 0,
    avatar_url: p.avatar_url || "",
    created_at: p.created_at,
  }));

  const safeMatches = (matchesResult.data || []).map((m: any) => ({
    id: m.id,
    winner_id: m.winner_id,
    loser_id: m.loser_id,
    winner_score: m.winner_score,
    loser_score: m.loser_score,
    elo_change: m.elo_change,
    mode: m.mode || "casual",
    created_at: m.created_at,
  }));

  return (
    <AdminDashboardClient 
      initialEvents={safeEvents} 
      initialProfiles={safeProfiles} 
      initialMatches={safeMatches}
    />
  );
}

