"use client";

import { useState } from "react";
import { Swords, ArrowRight, Crown, Medal, Trophy } from "lucide-react";

const leaderboardData = [
  { rank: 1, username: "Chad_Supreme", score: 2847, tier: "GOD", tierColor: "text-yellow-400" },
  { rank: 2, username: "AlphaWolf", score: 2734, tier: "ELITE", tierColor: "text-purple-400" },
  { rank: 3, username: "BoneStructure", score: 2612, tier: "ELITE", tierColor: "text-purple-400" },
  { rank: 4, username: "Looksmax_King", score: 2543, tier: "PRO", tierColor: "text-red-400" },
  { rank: 5, username: "Maxxinator", score: 2489, tier: "PRO", tierColor: "text-red-400" },
];

export default function Home() {
  const [handle, setHandle] = useState("");

  return (
    <div className="min-h-screen flex flex-col items-center">
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-6 py-24">
        {/* Diamond Accent */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono tracking-widest text-red-500 uppercase">
          <span className="text-red-500">◆</span>
          <span>FACE THE COMPETITION</span>
          <span className="text-red-500">◆</span>
        </div>

        {/* Main Heading */}
        <h1
          className="text-center leading-none tracking-tight mb-8"
          style={{ fontFamily: "var(--font-bebas)" }}
        >
          <span className="block text-8xl sm:text-9xl md:text-[140px] text-zinc-200">
            MOG
          </span>
          <span className="block text-8xl sm:text-9xl md:text-[140px] text-red-500 text-glow-red">
            OR
          </span>
          <span className="block text-8xl sm:text-9xl md:text-[140px] text-zinc-200">
            BE MOGGED
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-xs font-mono text-zinc-500 tracking-widest mb-12 text-center">
          anonymous · real-time · unfiltered
        </p>

        {/* Live Counter */}
        <div className="flex items-center gap-3 mb-12">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-mono text-green-400">
            2,847 IN ARENA
          </span>
        </div>

        {/* Input & CTA */}
        <div className="flex flex-col items-center gap-4 w-full max-w-md mb-16">
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="YOUR HANDLE"
            className="w-full h-14 px-6 bg-zinc-900/50 border border-zinc-800 rounded-none text-center text-zinc-200 font-mono text-sm uppercase placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
          />
          <button className="w-full h-14 bg-red-600 hover:bg-red-500 text-zinc-200 flex items-center justify-center gap-3 text-sm uppercase tracking-wider transition-colors rounded-none font-semibold">
            <Swords className="w-5 h-5" />
            ENTER THE ARENA
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-8 w-full max-w-lg mb-20">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500 mb-1" style={{ fontFamily: "var(--font-bebas)" }}>
              12.4M
            </div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Battles
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500 mb-1" style={{ fontFamily: "var(--font-bebas)" }}>
              98K
            </div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Active
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500 mb-1" style={{ fontFamily: "var(--font-bebas)" }}>
              4.2S
            </div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Avg Wait
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="w-full max-w-lg">
          <h2
            className="text-2xl uppercase mb-6 tracking-tight text-center"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            Top Mogs
          </h2>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-none overflow-hidden">
            {leaderboardData.map((player, index) => (
              <div
                key={player.rank}
                className={`flex items-center justify-between px-6 py-4 ${
                  index !== leaderboardData.length - 1
                    ? "border-b border-zinc-800"
                    : ""
                } hover:bg-zinc-800/50 transition-colors`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 text-center font-mono text-zinc-500">
                    {player.rank}
                  </span>
                  {player.rank === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                  {player.rank === 2 && <Medal className="w-4 h-4 text-zinc-300" />}
                  {player.rank === 3 && <Trophy className="w-4 h-4 text-amber-600" />}
                  {player.rank > 3 && <div className="w-4" />}
                  <span className="font-mono text-sm text-zinc-200">
                    {player.username}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-zinc-400">
                    {player.score.toLocaleString()}
                  </span>
                  <span className={`text-xs font-mono uppercase ${player.tierColor}`}>
                    {player.tier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}