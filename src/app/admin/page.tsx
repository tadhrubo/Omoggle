import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch last 30 days of events
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: events, error } = await supabase
    .from('analytics_events')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) return <div className="text-red-500 p-10">Error: {error.message}</div>;
  const safeEvents = events || [];

  // --- CORE MATH ---
  const now = new Date().getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  const totalSessions = safeEvents.filter(e => e.event_type === 'session_start').length;
  const battlesJoined = safeEvents.filter(e => e.event_type === 'battle_join').length;
  const battlesCompleted = safeEvents.filter(e => e.event_type === 'battle_complete').length;
  const completionRate = battlesJoined > 0 ? Math.round((battlesCompleted / battlesJoined) * 100) : 0;

  // Group user activity
  const userFirstSeen = new Map<string, number>();
  safeEvents.forEach(e => {
    const time = new Date(e.created_at).getTime();
    if (!userFirstSeen.has(e.user_id) || time < userFirstSeen.get(e.user_id)!) {
      userFirstSeen.set(e.user_id, time);
    }
  });

  const uniqueUsers = userFirstSeen.size;
  const sessionsPerUser = uniqueUsers > 0 ? (totalSessions / uniqueUsers).toFixed(1) : "0";

  // DAU & New vs Returning
  const dauUsers = new Set(safeEvents.filter(e => now - new Date(e.created_at).getTime() <= oneDay).map(e => e.user_id));
  const dau = dauUsers.size;
  
  let newDau = 0, returningDau = 0;
  dauUsers.forEach(uid => {
    (now - userFirstSeen.get(uid)! <= oneDay) ? newDau++ : returningDau++;
  });

  // D1 Retention (Yesterday's Cohort)
  let yesterdayCohort = 0, yesterdayRetained = 0;
  userFirstSeen.forEach((firstTime, uid) => {
    const age = now - firstTime;
    if (age > oneDay && age <= 2 * oneDay) {
      yesterdayCohort++;
      if (dauUsers.has(uid)) yesterdayRetained++;
    }
  });
  const d1Retention = yesterdayCohort > 0 ? Math.round((yesterdayRetained / yesterdayCohort) * 100) : 0;

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-black text-white p-10 font-mono">
      <h1 className="text-4xl font-bold mb-2 tracking-tighter">OMOGGLE // TRUTH PANEL</h1>
      <p className="text-zinc-500 mb-10">ACQUISITION METRICS & PMF INDICATORS</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">DAU (24H)</p>
          <p className="text-5xl font-black text-white">{dau}</p>
          <p className="text-xs text-zinc-500 mt-2">{newDau} NEW / {returningDau} RETURNING</p>
        </div>
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">D1 RETENTION</p>
          <p className="text-5xl font-black text-green-500">{d1Retention}%</p>
          <p className="text-xs text-zinc-500 mt-2">COHORT SIZE: {yesterdayCohort}</p>
        </div>
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">BATTLE COMPLETION</p>
          <p className="text-5xl font-black text-yellow-500">{completionRate}%</p>
          <p className="text-xs text-zinc-500 mt-2">{battlesCompleted} DONE / {battlesJoined} STARTED</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">TOTAL SESSIONS (30D)</p>
          <p className="text-4xl font-black text-white">{totalSessions}</p>
        </div>
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">MAU (30D)</p>
          <p className="text-4xl font-black text-white">{uniqueUsers}</p>
        </div>
        <div className="border border-zinc-800 p-6 bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">SESSIONS PER USER</p>
          <p className="text-4xl font-black text-white">{sessionsPerUser}</p>
        </div>
      </div>
    </div>
  );
}
