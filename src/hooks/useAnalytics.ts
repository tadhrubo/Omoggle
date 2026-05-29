"use client";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAnalytics() {
  const supabase = createClient();

  // Get or create a persistent anonymous device ID for retention track
  const getUserId = () => {
    if (typeof window === "undefined") return "server";
    let uid = localStorage.getItem("omoggle_anon_id");
    if (!uid) {
      uid = "anon_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem("omoggle_anon_id", uid);
    }
    return uid;
  };

  const trackEvent = useCallback(
    (eventType: 
      | "session_start" 
      | "battle_join" 
      | "battle_complete" 
      | "share_click"
      | "casual_battle_join"
      | "casual_battle_complete"
      | "casual_share_download"
      | "casual_share_social"
    ) => {
      const userId = getUserId();
      
      // Fire and forget. No await.
      supabase
        .from("analytics_events")
        .insert([{ event_type: eventType, user_id: userId }])
        .then(({ error }) => {
          if (error) console.error("Analytics Error:", error.message);
        });
    },
    [supabase]
  );

  return { trackEvent };
}
