"use client";
import React from "react";
import QRCode from "react-qr-code";
import type { MogScoreResult } from "@/utils/faceMath";

interface LabShareCardProps {
  result: MogScoreResult;
  rankName: string;
  rankColor: string;
  rankTier: string;
  capturedImage: string | null;
}

/** Card dimensions — 1080 × 1080 is the universal square post format */
export default function LabShareCard({ result, rankName, rankColor, rankTier, capturedImage }: LabShareCardProps) {
  const { score, metrics } = result;

  const barColor: Record<string, string> = {
    canthalTilt: "#39FF14",
    symmetry: "#38bdf8",
    jawline: "#a855f7",
  };

  /* ─── helpers ────────────────────────────────────────────── */
  const canthalPct = Math.min(100, Math.max(8, 50 + parseFloat(metrics.canthalTilt) * 4));
  const symmetryPct = Math.min(100, Math.max(8, parseFloat(metrics.symmetry)));
  const jawPct = Math.min(100, Math.max(8, parseFloat(metrics.jawline) * 100));

  const scoreColor = score >= 8 ? "#fbbf24" : score >= 6.5 ? "#39FF14" : score >= 5 ? "#38bdf8" : "#a1a1aa";

  return (
    <div
      style={{
        width: "1080px",
        height: "1080px",
        backgroundColor: "#09090b",
        fontFamily: "'Bebas Neue', 'Arial Black', sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── gradient background ── */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 20% 0%, rgba(168,85,247,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(56,189,248,0.12) 0%, transparent 55%)",
        zIndex: 0,
      }} />

      {/* ── top accent line ── */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "6px",
        background: `linear-gradient(90deg, ${rankColor}, #a855f7, #38bdf8)`,
        zIndex: 2,
      }} />

      {/* ── content wrapper ── */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "56px 60px 48px" }}>

        {/* ── header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "48px" }}>
          <div>
            <div style={{ fontSize: "13px", letterSpacing: "4px", color: "#71717a", fontFamily: "monospace", marginBottom: "6px" }}>
              BIOMETRIC ANALYSIS REPORT
            </div>
            <div style={{ fontSize: "52px", color: "white", letterSpacing: "2px", lineHeight: 1 }}>
              OMOGGLE AI LAB
            </div>
          </div>
          {/* Logo badge */}
          <div style={{
            width: "84px",
            height: "84px",
            borderRadius: "16px",
            backgroundColor: "#18181b",
            border: "2px solid rgba(168,85,247,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontFamily: "monospace",
            color: "#a855f7",
            fontWeight: "900",
            letterSpacing: "-1px",
          }}>
            mog
          </div>
        </div>

        {/* ── main two-column body ── */}
        <div style={{ display: "flex", gap: "48px", flex: 1, minHeight: 0 }}>

          {/* ── LEFT column: face image + score badge ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "390px", flexShrink: 0 }}>
            {/* Face snapshot */}
            <div style={{
              position: "relative",
              width: "100%",
              height: "340px",
              borderRadius: "20px",
              overflow: "hidden",
              border: `2px solid ${rankColor}40`,
              boxShadow: `0 0 40px ${rankColor}20`,
              backgroundColor: "#18181b",
            }}>
              {capturedImage ? (
                <img src={capturedImage} alt="Biometric scan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#52525b", fontSize: "18px", fontFamily: "monospace" }}>
                  NO IMAGE
                </div>
              )}
              {/* scan overlay label */}
              <div style={{
                position: "absolute",
                bottom: "14px",
                left: "14px",
                backgroundColor: "rgba(9,9,11,0.85)",
                border: "1px solid rgba(57,255,20,0.4)",
                color: "#39FF14",
                fontSize: "11px",
                fontFamily: "monospace",
                padding: "4px 10px",
                borderRadius: "5px",
                letterSpacing: "1px",
                fontWeight: "bold",
              }}>
                BIOMETRIC_SCAN_SECURED
              </div>
            </div>

            {/* Score badge */}
            <div style={{
              borderRadius: "20px",
              padding: "28px 32px",
              backgroundColor: "#18181b",
              border: `1px solid ${rankColor}30`,
              boxShadow: `0 0 30px ${rankColor}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#71717a", letterSpacing: "2px", marginBottom: "4px" }}>
                  MOG SCORE
                </div>
                <div style={{ fontSize: "86px", color: scoreColor, lineHeight: 1, letterSpacing: "-2px" }}>
                  {score.toFixed(1)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                <div style={{
                  backgroundColor: rankColor,
                  color: "#09090b",
                  fontFamily: "monospace",
                  fontSize: "16px",
                  fontWeight: "900",
                  letterSpacing: "2px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                }}>
                  {rankName.toUpperCase()}
                </div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: rankColor, opacity: 0.8, letterSpacing: "1px" }}>
                  {rankTier}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT column: metrics + QR ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {/* Canthal Tilt */}
              <MetricBar
                label="CANTHAL TILT"
                sub="Eye Alignment Angle"
                value={metrics.canthalTilt}
                pct={canthalPct}
                color={barColor.canthalTilt}
              />

              {/* Facial Symmetry */}
              <MetricBar
                label="FACIAL SYMMETRY"
                sub="Structural Balance"
                value={metrics.symmetry}
                pct={symmetryPct}
                color={barColor.symmetry}
              />

              {/* Jaw Ratio */}
              <MetricBar
                label="JAW / CHIN RATIO"
                sub="Cheek-to-Jaw Proportion"
                value={metrics.jawline}
                pct={jawPct}
                color={barColor.jawline}
              />

              {/* Mini stat boxes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
                <MiniBox label="EYE SHAPE" value={metrics.eyeShape} color="#fbbf24" />
                <MiniBox label="MAX POTENTIAL" value={`${metrics.potential} / 10`} color="#10b981" />
              </div>
            </div>

            {/* ── Bottom: QR code + CTA ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "32px" }}>
              <div style={{
                backgroundColor: "white",
                padding: "14px",
                borderRadius: "12px",
                flexShrink: 0,
              }}>
                <QRCode value="https://omoggle.games/lab" size={120} level="H" />
              </div>
              <div>
                <div style={{ fontSize: "28px", color: "white", letterSpacing: "1px", marginBottom: "8px" }}>
                  SCAN TO GET YOUR RATING
                </div>
                <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#71717a", letterSpacing: "2px" }}>
                  omoggle.games/lab
                </div>
                <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#52525b", marginTop: "6px" }}>
                  Free AI face calibration — No filter, no bias
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── bottom accent bar ── */}
        <div style={{
          marginTop: "40px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#52525b", letterSpacing: "2px" }}>
            REAL GENETICS. REAL SCORES. NO EGOBUFF.
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#52525b", letterSpacing: "1px" }}>
            omoggle.games
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function MetricBar({ label, sub, value, pct, color }: {
  label: string; sub: string; value: string; pct: number; color: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <span style={{ fontSize: "16px", color: "#e4e4e7", letterSpacing: "1px" }}>{label}</span>
        <span style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: "bold", color }}>{value}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a", fontFamily: "monospace", marginBottom: "10px" }}>
        <span>{sub}</span>
      </div>
      <div style={{ width: "100%", height: "8px", backgroundColor: "#27272a", borderRadius: "99px", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: "99px",
          boxShadow: `0 0 10px ${color}80`,
        }} />
      </div>
    </div>
  );
}

function MiniBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      backgroundColor: "#18181b",
      border: "1px solid #27272a",
      borderRadius: "12px",
      padding: "16px 20px",
    }}>
      <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#71717a", letterSpacing: "1px", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: "bold", color }}>{value}</div>
    </div>
  );
}
