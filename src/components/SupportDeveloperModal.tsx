"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, X, Loader2, Crown } from "lucide-react";

interface SupportDeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportDeveloperModal({ isOpen, onClose }: SupportDeveloperModalProps) {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [amount, setAmount] = useState<number>(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    loadSession();
  }, [supabase]);

  const handleDonate = async () => {
    if (!session?.user?.id) return;
    if (amount < 1) {
      setError("Minimum donation is $1 to cover network fees.");
      return;
    }
    setError(null);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/donations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user.id, amount }),
      });

      const data = await response.json();

      if (data.invoice_url) {
        window.location.href = data.invoice_url;
      } else {
        setError(data.error || "Failed to create invoice. Please try again.");
      }
    } catch (err) {
      console.error("Donation checkout error:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (!isOpen) return null;

  const presetAmounts = [1, 2, 5, 10];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        backdropFilter: "blur(8px)",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#0a0a0c",
          border: "1px solid rgba(234, 179, 8, 0.2)",
          borderRadius: "24px",
          padding: "35px 25px",
          position: "relative",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "none",
            border: "none",
            color: "#71717a",
            cursor: "pointer",
          }}
        >
          <X size={24} />
        </button>

        {/* Floating Animated Golden Crown Badge */}
        <div
          className="crown-badge-container"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            backgroundColor: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.2)",
            marginBottom: "16px",
            animation: "float 4s ease-in-out infinite, pulseGlow 3s ease-in-out infinite",
            position: "relative"
          }}
        >
          <Crown size={30} color="#eab308" fill="#eab308" style={{ filter: "drop-shadow(0 0 10px rgba(234, 179, 8, 0.6))" }} />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "950",
            color: "white",
            margin: "0 0 8px 0",
            letterSpacing: "1.5px",
            background: "linear-gradient(135deg, #fff 40%, #eab308 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          BECOME A FOUNDING OG
        </h2>
        
        <p
          style={{
            color: "#a1a1aa",
            fontSize: "13px",
            lineHeight: "1.6",
            marginBottom: "20px",
          }}
        >
          Support early development and unlock exclusive{" "}
          <span style={{ color: "#eab308", fontWeight: "bold" }}>Season 0 prestige</span> forever.
          <span style={{ color: "#fca5a5", fontSize: "11px", fontWeight: "bold", display: "block", marginTop: "6px", letterSpacing: "0.5px" }}>
            ⚠️ Only available during Season 0 • Never obtainable again
          </span>
        </p>

        {/* Supporter Perks Checklist */}
        <div style={{
          backgroundColor: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.03)",
          borderRadius: "16px",
          padding: "16px",
          textAlign: "left",
          marginBottom: "16px"
        }}>
          <div style={{ fontSize: "10px", fontWeight: "900", color: "#a855f7", letterSpacing: "1.5px", marginBottom: "12px" }}>EXCLUSIVE SEASON 0 REWARDS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#d4d4d8" }}>
              <span style={{ color: "#eab308", fontWeight: "bold" }}>✔</span>
              <span><strong>OG Profile Badge</strong> — Shiny badge on profile & chat</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#d4d4d8" }}>
              <span style={{ color: "#eab308", fontWeight: "bold" }}>✔</span>
              <span><strong>Exclusive Name Glow</strong> — Stand out in global chat</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#d4d4d8" }}>
              <span style={{ color: "#eab308", fontWeight: "bold" }}>✔</span>
              <span><strong>Early Supporter Status</strong> — Commemorates early adoption</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "#d4d4d8" }}>
              <span style={{ color: "#eab308", fontWeight: "bold" }}>✔</span>
              <span><strong>Future Drop Access</strong> — Free cosmetic priority drops</span>
            </div>
          </div>
        </div>

        {/* Server Funding Progress */}
        <div style={{ textAlign: "left", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "900", color: "#eab308", marginBottom: "6px", letterSpacing: "1.5px" }}>
            <span>SERVER FUNDING GOAL</span>
            <span>72% FUNDED</span>
          </div>
          <div style={{ height: "6px", backgroundColor: "#141416", borderRadius: "3px", border: "1px solid rgba(234, 179, 8, 0.15)", overflow: "hidden" }}>
            <div style={{ width: "72%", height: "100%", background: "linear-gradient(90deg, #7c3aed, #eab308)", borderRadius: "3px" }} />
          </div>
        </div>

        {/* Live Social Proof Roster Ticker */}
        <div style={{
          overflow: "hidden",
          width: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          padding: "8px 0",
          marginBottom: "20px",
          position: "relative"
        }}>
          <div className="ticker-wrapper" style={{
            display: "flex",
            gap: "35px",
            width: "max-content",
            animation: "ticker 25s linear infinite"
          }}>
            <span style={{ fontSize: "10px", fontWeight: "900", color: "#71717a", letterSpacing: "1.5px" }}>
              RECENT FOUNDERS: VOIDREAPER • MIDNIGHTKING • TERRACHAD • DHRUBO • GHOST • VOIDRUNNER • ZEPHYR • CRIMSON
            </span>
            <span style={{ fontSize: "10px", fontWeight: "900", color: "#71717a", letterSpacing: "1.5px" }}>
              RECENT FOUNDERS: VOIDREAPER • MIDNIGHTKING • TERRACHAD • DHRUBO • GHOST • VOIDRUNNER • ZEPHYR • CRIMSON
            </span>
          </div>
        </div>

        {!session ? (
          <div>
            <div style={{ color: "white", fontWeight: "bold", marginBottom: "15px", fontSize: "14px" }}>
              Sign in to claim Founder status.
            </div>
            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#eab308",
                color: "black",
                fontWeight: "950",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "14px",
                letterSpacing: "0.5px"
              }}
            >
              SIGN IN WITH GOOGLE
            </button>
          </div>
        ) : (
          <div>
            {/* Preset Amount Buttons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", justifyContent: "center" }}>
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setAmount(preset); setError(null); }}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: amount === preset ? "#eab308" : "#18181b",
                    color: amount === preset ? "black" : "#a1a1aa",
                    border: amount === preset ? "1px solid #eab308" : "1px solid #27272a",
                    borderRadius: "8px",
                    cursor: preset === amount ? "none" : "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                    transition: "all 0.15s",
                  }}
                >
                  ${preset}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <span
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#71717a",
                  fontSize: "18px",
                  fontWeight: "900",
                }}
              >
                $
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => {
                  setAmount(Math.max(0, Number(e.target.value)));
                  setError(null);
                }}
                style={{
                  width: "100%",
                  padding: "16px 16px 16px 36px",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "12px",
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "900",
                  textAlign: "center",
                  outline: "none",
                  appearance: "textfield",
                  MozAppearance: "textfield",
                  WebkitAppearance: "none",
                } as React.CSSProperties}
                onFocus={(e) => (e.target.style.borderColor = "#eab308")}
                onBlur={(e) => (e.target.style.borderColor = "#27272a")}
              />
            </div>

            <p style={{ color: "#52525b", fontSize: "11px", marginBottom: "16px" }}>
              Minimum $1 USD to cover crypto network fees
            </p>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "12px",
                  padding: "8px",
                  backgroundColor: "rgba(239, 68, 68, 0.08)",
                  borderRadius: "6px",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleDonate}
              disabled={isProcessing || amount < 1}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: isProcessing || amount < 1 ? "#27272a" : "#eab308",
                color: isProcessing || amount < 1 ? "#52525b" : "black",
                border: "none",
                borderRadius: "12px",
                cursor: isProcessing || amount < 1 ? "not-allowed" : "pointer",
                fontWeight: "955",
                fontSize: "15px",
                transition: "all 0.2s",
                boxShadow: isProcessing || amount < 1 ? "none" : "0 0 20px rgba(234, 179, 8, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                letterSpacing: "0.5px"
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                  PROCESSING...
                </>
              ) : (
                `UNLOCK FOUNDING OG STATUS ($${amount})`
              )}
            </button>

            <p style={{ color: "#3f3f46", fontSize: "10px", marginTop: "14px", lineHeight: "1.5" }}>
              Secure checkout via NOWPayments. You'll be redirected to complete payment.
            </p>
            <p style={{ color: "#71717a", fontSize: "11px", marginTop: "10px", lineHeight: "1.5", backgroundColor: "rgba(234, 179, 8, 0.03)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(234, 179, 8, 0.1)" }}>
              💡 <strong>Tip:</strong> To avoid high network gas fees on small donations, we highly recommend using the default LTC (Litecoin) or selecting SOL / USDT (TRC20) at checkout.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 15px rgba(234, 179, 8, 0.1); border-color: rgba(234, 179, 8, 0.2); }
          50% { box-shadow: 0 0 25px rgba(234, 179, 8, 0.4); border-color: rgba(234, 179, 8, 0.5); }
          100% { box-shadow: 0 0 15px rgba(234, 179, 8, 0.1); border-color: rgba(234, 179, 8, 0.2); }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

