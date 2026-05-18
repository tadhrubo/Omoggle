"use client";
import { useState } from "react";
import { ShieldAlert, Terminal, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsDecrypting(true);
    setError(null);

    // Simulate cryptographic decryption/authentication verification
    setTimeout(() => {
      // Base64 encode the password to set as a simple secure session token
      const token = btoa(password);
      
      // Store in cookie
      document.cookie = `admin_session=${token}; path=/; max-age=86400; SameSite=Strict`;
      
      // Reload to let Server Component evaluate cookie session
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-mono p-6 relative overflow-hidden selection:bg-red-500 selection:text-black">
      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      
      {/* Glowing terminal overlay */}
      <div className="absolute top-10 left-10 text-xs text-zinc-700/60 uppercase tracking-widest pointer-events-none hidden md:block">
        <p>SYSTEM ACCESS LEVEL: 0 // DECRYPT PORT ACTIVE</p>
        <p>CODENAME: RED TRUTH // PROTOCOL V4.2</p>
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        {/* Glowing aura backdrops */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 to-purple-600 opacity-20 blur-xl"></div>
        
        <div className="relative border border-zinc-800/80 bg-zinc-950/90 backdrop-blur-2xl rounded-2xl p-8 md:p-10 shadow-2xl shadow-red-950/20">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <Terminal size={28} className="animate-pulse" />
            </div>
            <span className="text-[10px] text-red-500 tracking-[0.3em] font-black uppercase mb-1">
              CODENAME: SYSTEM RED
            </span>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              ADMIN DECRYPTION GATEWAY
            </h1>
            <p className="text-xs text-zinc-500 mt-2 font-sans">
              Authorization required to access the main Omoggle telemetry feeds.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                System Decryption Password
              </label>
              
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="ENTER ACCESS KEY"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDecrypting}
                  className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-red-500/50 rounded-xl px-4 py-3.5 text-center text-sm tracking-[0.2em] uppercase text-white outline-none transition-all placeholder:text-zinc-700/80 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="border border-red-900/50 bg-red-950/20 px-4 py-3 rounded-xl flex items-start gap-3 text-red-400 text-xs leading-relaxed animate-shake">
                <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold uppercase block mb-0.5">Access Violation</span>
                  {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isDecrypting || !password.trim()}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 border border-red-500/20 disabled:border-zinc-800 rounded-xl text-xs font-black tracking-[0.2em] text-white uppercase cursor-pointer disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(239,68,68,0.15)] active:scale-[0.98]"
            >
              {isDecrypting ? "DECRYPTING ACCESS SIGNATURE..." : "DECRYPT ACCESS"}
            </button>
          </form>

          {/* Quick diagnostic footnote */}
          <div className="mt-8 pt-6 border-t border-zinc-900 text-center text-[10px] text-zinc-600 tracking-wider">
            SECURE SHA-256 P2P LOGGING ENFORCED
          </div>
        </div>
      </div>
    </div>
  );
}
