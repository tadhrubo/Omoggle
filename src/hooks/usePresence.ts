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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    // Resolve the current session asynchronously, then subscribe
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id ?? "anonymous";

      setOnlineCount(0);

      channel = supabase.channel("global_lobby", {
        config: {
          presence: { key: userId, enabled: true },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted) return;
          const state = channel?.presenceState() ?? {};
          const uniqueKeys = Object.keys(state).length;
          const totalTabs = Object.values(state).reduce(
            (acc, arr) => acc + arr.length,
            0
          );
          console.log(
            `[Presence sync] keys=${uniqueKeys}, totalTabs=${totalTabs}`
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
          if (!mounted || !channel) return;
          if (status === "SUBSCRIBED") {
            await channel.track({ user_id: userId, joined_at: Date.now() });
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(() => {
              if (!channel) return;
              channel.track({ user_id: userId, joined_at: Date.now() }).catch(
                (error) => {
                  console.warn("Presence heartbeat failed", error);
                }
              );
            }, 10000);
          }
        });

      return channel;
    };

    const channelPromise = run();

    return () => {
      mounted = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      channelPromise.then(async (channel) => {
        if (channel) {
          try {
            await channel.untrack();
            await channel.unsubscribe(10000);
          } catch (err) {
            console.warn("Presence cleanup failed", err);
          } finally {
            supabase.removeChannel(channel);
          }
        }
      });
    };
    // supabase client is stable — no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { onlineCount };
}
