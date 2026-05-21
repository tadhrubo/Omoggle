"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, X, Loader2 } from "lucide-react";

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
          border: "1px solid rgba(168, 85, 247, 0.2)",
          borderRadius: "24px",
          padding: "40px 30px",
          position: "relative",
          textAlign: "center",
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

        {/* Header Icon */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: "rgba(168, 85, 247, 0.1)",
            marginBottom: "20px",
          }}
        >
          <Heart size={28} color="#a855f7" fill="#a855f7" style={{ filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))" }} />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "900",
            color: "white",
            margin: "0 0 8px 0",
            letterSpacing: "2px",
          }}
        >
          SUPPORT THE DEV
        </h2>
        <p
          style={{
            color: "#a1a1aa",
            fontSize: "13px",
            lineHeight: "1.6",
            marginBottom: "28px",
          }}
        >
          Omoggle is 100% free to play. Donations keep the servers running and earn you an exclusive{" "}
          <span style={{ color: "#a855f7", fontWeight: "bold" }}>OG Supporter</span> badge on your profile.
        </p>

        {!session ? (
          <div>
            <div style={{ color: "white", fontWeight: "bold", marginBottom: "15px", fontSize: "14px" }}>
              Sign in to support the project.
            </div>
            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#a855f7",
                color: "white",
                fontWeight: "900",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontSize: "14px",
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
                    backgroundColor: amount === preset ? "#a855f7" : "#18181b",
                    color: amount === preset ? "white" : "#a1a1aa",
                    border: amount === preset ? "1px solid #a855f7" : "1px solid #27272a",
                    borderRadius: "8px",
                    cursor: "pointer",
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
                onFocus={(e) => (e.target.style.borderColor = "#a855f7")}
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
                backgroundColor: isProcessing || amount < 1 ? "#27272a" : "#a855f7",
                color: isProcessing || amount < 1 ? "#52525b" : "white",
                border: "none",
                borderRadius: "12px",
                cursor: isProcessing || amount < 1 ? "not-allowed" : "pointer",
                fontWeight: "900",
                fontSize: "15px",
                transition: "all 0.2s",
                boxShadow: isProcessing || amount < 1 ? "none" : "0 0 20px rgba(168, 85, 247, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                  PROCESSING...
                </>
              ) : (
                `DONATE $${amount} WITH CRYPTO`
              )}
            </button>

            <p style={{ color: "#3f3f46", fontSize: "10px", marginTop: "14px" }}>
              Secure checkout via NOWPayments. You'll be redirected to complete payment.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
