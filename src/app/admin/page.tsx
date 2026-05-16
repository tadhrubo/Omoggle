import { createClient } from "@supabase/supabase-js";

// Force dynamic rendering so it's always up to date
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // Use the service role key if possible, or anon key to fetch public stats
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all events from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: events, error } = await supabase
    .from('analytics_events')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) {
    return <div className="text-red-500 p-10">Error loading analytics: {error.message}</div>;
  }

  const safeEvents = events || [];

  // Calculate Metrics
  const totalSessions = safeEvents.filter(e => e.event_type === 'session_start').length;
  const totalBattles = safeEvents.filter(e => e.event_type === 'battle_complete').length;
  
  const uniqueUsers = new Set(safeEvents.map(e => e.user_id)).size;
  
  // Calculate DAU (Active in the last 24 hours)
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);
  const recentEvents = safeEvents.filter(e => new Date(e.created_at) >= twentyFourHoursAgo);
  const dau = new Set(recentEvents.map(e => e.user_id)).size;

  // Render the minimal brutalist UI
  return (
    <div className="min-h-screen bg-black text-white p-10 font-mono">
      <h1 className="text-4xl font-bold mb-10 tracking-tighter">OMOGGLE // COMMAND CENTER</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* DAU */}
        <div className="border border-zinc-800 p-6 rounded-lg bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">DAILY ACTIVE USERS (24H)</p>
          <p className="text-5xl font-black text-green-500">{dau}</p>
        </div>

        {/* MAU */}
        <div className="border border-zinc-800 p-6 rounded-lg bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">MONTHLY ACTIVE USERS (30D)</p>
          <p className="text-5xl font-black text-white">{uniqueUsers}</p>
        </div>

        {/* Sessions */}
        <div className="border border-zinc-800 p-6 rounded-lg bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">TOTAL SESSIONS (30D)</p>
          <p className="text-5xl font-black text-white">{totalSessions}</p>
        </div>

        {/* Battles */}
        <div className="border border-zinc-800 p-6 rounded-lg bg-zinc-950">
          <p className="text-zinc-400 text-sm mb-2">BATTLES COMPLETED (30D)</p>
          <p className="text-5xl font-black text-yellow-500">{totalBattles}</p>
        </div>
      </div>
    </div>
  );
}
