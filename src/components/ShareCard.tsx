"use client";
import React from 'react';
import QRCode from 'react-qr-code';

interface ShareCardProps {
  playerName: string;
  opponentName?: string;
  winRate: number;
  score: number;
  elo: number;
  challengeLink: string;
}

export default function ShareCard({
  playerName,
  opponentName,
  winRate,
  score,
  elo,
  challengeLink
}: ShareCardProps) {
  return (
    <div id="share-card-container" className="w-[1080px] h-[1920px] relative overflow-hidden bg-black font-sans select-none">
      {/* Background Geometric Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80"></div>
      
      {/* Custom Geometric Slash Lines (Overlay) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-[-20%] w-[140%] h-[200px] bg-white/10 -rotate-12 transform origin-top-left"></div>
        <div className="absolute bottom-[-10%] right-[-20%] w-[140%] h-[400px] bg-white/5 -rotate-12 transform origin-bottom-right"></div>
      </div>

      {/* Top Header */}
      <div className="absolute top-24 left-16 z-10">
        <h1 className="text-white text-7xl font-black italic tracking-tighter leading-none uppercase">
          MOG BATTLE<br/>VICTORY
        </h1>
        <p className="text-zinc-300 text-2xl tracking-[0.2em] mt-6 font-medium uppercase">
          ALPHA DOMINANCE ACHIEVED.
        </p>
      </div>

      {/* Logo */}
      <div className="absolute top-24 right-16 z-10">
        <img src="/logo_nobg.png" alt="Mog Logo" className="h-24 object-contain brightness-0 invert" />
      </div>

      {/* Main Statement */}
      <div className="absolute top-[450px] left-16 z-10 max-w-[900px]">
        <h2 className="text-white text-8xl font-extrabold uppercase tracking-tight leading-tight">
          {playerName} MOGGED {opponentName || 'THE ARENA'}
        </h2>
        <p className="text-zinc-400 text-4xl mt-6 tracking-wide font-light">
          LIVE ON STREAM
        </p>
      </div>

      {/* Stats Grid */}
      <div className="absolute top-[800px] left-0 w-full flex justify-center gap-10 px-16 z-10">
        {/* Box 1: Win Rate */}
        <div className="flex flex-col items-center justify-center w-[400px] h-[280px] rounded-3xl border-2 border-zinc-700/50 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-xl">
          <span className="text-zinc-400 text-2xl tracking-[0.3em] mb-6 font-bold uppercase">WIN RATE</span>
          <span className="text-white text-9xl font-black tracking-tighter">{winRate}%</span>
        </div>

        {/* Box 2: Score */}
        <div className="flex flex-col items-center justify-center w-[400px] h-[280px] rounded-3xl border-2 border-zinc-700/50 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-xl">
          <span className="text-zinc-400 text-2xl tracking-[0.3em] mb-6 font-bold uppercase">SCORE</span>
          <span className="text-white text-9xl font-black tracking-tighter">{score.toFixed(1)}</span>
        </div>
      </div>

      {/* ELO Badge */}
      <div className="absolute top-[1180px] w-full flex justify-center z-10">
        <div className="border-2 border-white/30 rounded-full px-24 py-8 bg-white/5 shadow-[0_0_60px_rgba(255,255,255,0.15)] backdrop-blur-2xl">
          <span className="text-white text-7xl font-black tracking-widest uppercase">{elo} ELO</span>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-24 left-16 flex flex-col z-10">
        <span className="text-zinc-500 text-3xl tracking-[0.2em] mb-6 font-bold uppercase">ENTER THE ARENA</span>
        <span className="text-white text-6xl font-black tracking-tight">omoggle.games</span>
      </div>

      <div className="absolute bottom-24 right-16 bg-white p-8 rounded-3xl z-10 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
        <QRCode value={challengeLink} size={256} level="H" />
      </div>

      {/* Bottom Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"></div>
    </div>
  );
}
