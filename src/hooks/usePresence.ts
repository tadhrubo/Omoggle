"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * usePresence
 *
 * Joins the "global_lobby" Supabase Realtime Presence channel and returns
 * the number of unique presences (browser tabs / sessions) currently online.
 *
 * Each tab tracks:
 *   { user_id: string }   — anonymous if not signed in
 *
 * The channel is unsubscribed on component unmount so the count drops
 * immediately when a user leaves.
 */
export function usePresence() {
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Resolve the current session asynchronously, then subscribe
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? "anonymous";

      const channel = supabase.channel("global_lobby", {
        config: {
          presence: { key: userId },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted) return;
          const state = channel.presenceState();
          // Each key in presenceState() is a unique presence key
          // (user_id or "anonymous"). Object.keys gives unique users;
          // summing the arrays inside gives total tabs.
          const totalTabs = Object.values(state).reduce(
            (acc, arr) => acc + arr.length,
            0
          );
          setOnlineCount(totalTabs);
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          // Handled by sync, but kept for clarity
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          // Handled by sync
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ user_id: userId, joined_at: Date.now() });
          }
        });

      return channel;
    };

    const channelPromise = run();

    return () => {
      mounted = false;
      channelPromise.then((channel) => {
        if (channel) {
          channel.untrack().then(() => supabase.removeChannel(channel));
        }
      });
    };
    // supabase client is stable — no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { onlineCount };
}
