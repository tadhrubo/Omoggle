"use client";
import { useEffect, useState } from "react";

export default function AgeGate() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem("omoggle_18_verified");
    if (!verified) {
      setIsVisible(true);
    }
  }, []);

  const handleVerify = () => {
    localStorage.setItem("omoggle_18_verified", "true");
    setIsVisible(false);
  };

  const handleReject = () => {
    window.location.href = "https://www.google.com"; 
  };

  if (!isVisible) return null;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(10px)", padding: "20px" }}>
      <div style={{ maxWidth: "400px", width: "100%", backgroundColor: "#0f0514", border: "1px solid #27272a", borderRadius: "24px", padding: "40px 30px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", marginBottom: "15px", border: "1px solid rgba(239, 68, 68, 0.3)", display: "inline-block", padding: "4px 10px", borderRadius: "99px" }}>RESTRICTED • 18+</div>
        <h2 style={{ fontSize: "2rem", fontWeight: "900", color: "white", margin: "0 0 15px 0" }}>Adults Only</h2>
        <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", margin: "0 0 30px 0" }}>
          This is a live, unfiltered video arena. By entering, you affirm you are at least 18 years old.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={handleVerify} style={{ width: "100%", padding: "16px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "900", cursor: "pointer", transition: "transform 0.1s" }} onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"} onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}>
            I AM 18+ — ENTER
          </button>
          <button onClick={handleReject} style={{ width: "100%", padding: "16px", backgroundColor: "transparent", color: "#71717a", border: "1px solid #27272a", borderRadius: "12px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }} onMouseOver={(e) => e.currentTarget.style.color = "white"} onMouseOut={(e) => e.currentTarget.style.color = "#71717a"}>
            I AM UNDER 18
          </button>
        </div>
        <p style={{ color: "#52525b", fontSize: "11px", marginTop: "20px" }}>By entering, you agree to our Terms and Privacy Policy.</p>
      </div>
    </div>
  );
}
