"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RankedVaultPoll() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    loadData();
  }, [supabase]);

  const handleCheckout = async () => {
    if (!session?.user?.id) return;
    setIsProcessing(true);

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id }),
      });

      const data = await response.json();

      if (data.invoice_url) {
        // Redirect to the NOWPayments invoice URL
        window.location.href = data.invoice_url;
      } else {
        console.error("Failed to retrieve invoice:", data.error);
        alert("Failed to initialize checkout. Please try again.");
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Something went wrong. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "12px", padding: "30px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "rgba(251, 191, 36, 0.1)", color: "#fbbf24", fontSize: "24px", marginBottom: "20px" }}>
        🔒
      </div>
      
      <h2 style={{ color: "white", fontSize: "24px", fontWeight: "900", letterSpacing: "2px", margin: "0 0 10px 0" }}>RANKED MODE VAULTED</h2>
      <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", marginBottom: "30px" }}>
        Omoggle blew up. To keep the servers alive and the matchmaking fast, we've funneled everyone into Casual Mode. <br/><br/>
        Ranked access is now a premium feature. Upgrade to unlock high-stakes competitive play, global leaderboards, and exclusive prestige borders.
      </p>

      <div style={{ backgroundColor: "#18181b", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
        {!session ? (
          <div>
            <div style={{ color: "white", fontWeight: "bold", marginBottom: "15px" }}>Login required to unlock Ranked Mode.</div>
            <button 
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                  }
                });
              }} 
              style={{ padding: "12px 24px", backgroundColor: "#fbbf24", color: "black", fontWeight: "900", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%" }}
            >
              SIGN UP TO CONTINUE
            </button>
          </div>
        ) : (
          <div>
            <button 
              onClick={handleCheckout}
              disabled={isProcessing}
              style={{ width: "100%", padding: "15px", backgroundColor: "#fbbf24", color: "black", fontWeight: "900", border: "none", borderRadius: "8px", cursor: isProcessing ? "wait" : "pointer", transition: "all 0.2s", opacity: isProcessing ? 0.7 : 1, fontSize: "16px", letterSpacing: "1px" }}
            >
              {isProcessing ? "INITIALIZING CHECKOUT..." : "PAY $2 FOR RANKED ACCESS"}
            </button>
            <div style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "12px", fontWeight: "500" }}>
              Secure crypto checkout via NOWPayments. Instant unlock upon network confirmation.
            </div>
          </div>
        )}
      </div>
      <div style={{ color: "#71717a", fontSize: "12px" }}>For now, jump into Casual to mog some randoms.</div>
    </div>
  );
}
