"use client";

import Link from "next/link";
import {
  Swords,
  Target,
  Crown,
  Users,
  ChevronRight,
  Flame,
} from "lucide-react";

const modeCards = [
  {
    href: "/arena",
    icon: Swords,
    title: "1V1 MOG BATTLE",
    description: "Face off in real-time. First to max their looks wins the round.",
    borderColor: "border-red-500/50",
    iconColor: "text-red-500",
    glowClass: "card-glow-red",
  },
  {
    href: "/lab",
    icon: Target,
    title: "SOLO CALIBRATION",
    description: "Get your baseline mog score. Climb the ranks solo.",
    borderColor: "border-purple-500/50",
    iconColor: "text-purple-500",
    glowClass: "card-glow-purple",
  },
  {
    href: "/ranked",
    icon: Crown,
    title: "RANKED MATCH",
    description: "Compete for ELO. Climb from Normie to God tier.",
    borderColor: "border-yellow-500/50",
    iconColor: "text-yellow-500",
    glowClass: "card-glow-yellow",
  },
  {
    href: "/private",
    icon: Users,
    title: "PRIVATE ROOM",
    description: "Host a private mog session. Share code with friends.",
    borderColor: "border-teal-500/50",
    iconColor: "text-teal-500",
    glowClass: "card-glow-teal",
  },
];

export default function Lobby() {
  return (
    <div className="min-h-screen flex flex-col items-center">
      <main className="flex flex-col items-center w-full max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="w-full mb-12">
          <div className="flex items-center gap-2 mb-3 text-xs font-mono tracking-widest text-red-500 uppercase">
            <span className="text-red-500">◆</span>
            <span>SELECT MODE</span>
          </div>
          <h1
            className="text-6xl md:text-7xl uppercase tracking-tight"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            BATTLE LOBBY
          </h1>
        </div>

        {/* Mode Cards */}
        <div className="w-full space-y-3 mb-8">
          {modeCards.map((mode) => (
            <Link
              key={mode.title}
              href={mode.href || "#"}
              className={`block w-full bg-zinc-900/50 border ${mode.borderColor} ${mode.glowClass} rounded-none p-6 flex items-center gap-5 hover:bg-zinc-800/50 transition-all text-left group`}
            >
              <div
                className={`w-14 h-14 flex items-center justify-center border ${mode.borderColor} bg-zinc-900`}
              >
                <mode.icon className={`w-7 h-7 ${mode.iconColor}`} />
              </div>
              <div className="flex-1">
                <h2
                  className="text-xl uppercase mb-1 tracking-tight text-zinc-200"
                  style={{ fontFamily: "var(--font-bebas)" }}
                >
                  {mode.title}
                </h2>
                <p className="text-sm text-zinc-500 font-mono">
                  {mode.description}
                </p>
              </div>
              <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>

        {/* Daily Challenge Banner */}
        <button className="w-full bg-zinc-900/50 border border-yellow-500/50 card-glow-yellow rounded-none p-6 flex items-center gap-5 hover:bg-zinc-800/50 transition-all text-left group">
          <div className="w-14 h-14 flex items-center justify-center border border-yellow-500/50 bg-zinc-900">
            <Flame className="w-7 h-7 text-yellow-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-yellow-500 uppercase tracking-wider">
                Daily Challenge
              </span>
            </div>
            <h2
              className="text-xl uppercase tracking-tight text-zinc-200"
              style={{ fontFamily: "var(--font-bebas)" }}
            >
              LOOKSMAX TOURNAMENT
            </h2>
            <p className="text-sm text-zinc-500 font-mono">
              Top 10 scores win exclusive badges
            </p>
          </div>
          <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
        </button>
      </main>
    </div>
  );
}