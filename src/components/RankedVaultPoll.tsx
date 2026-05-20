"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RankedVaultPoll() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState<boolean | null>(null);
  const [totalVotes, setTotalVotes] = useState({ yes: 0, no: 0 });
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      const { data: votes } = await supabase.from('ranked_votes').select('vote_yes');
      if (votes) {
        const yesCount = votes.filter(v => v.vote_yes).length;
        const noCount = votes.filter(v => !v.vote_yes).length;
        setTotalVotes({ yes: yesCount, no: noCount });
      }

      if (session?.user?.id) {
        const { data: myVote } = await supabase
          .from('ranked_votes')
          .select('vote_yes')
          .eq('user_id', session.user.id)
          .single();
        if (myVote) setHasVoted(myVote.vote_yes);
      }
    };
    loadData();
  }, [supabase]);

  const handleVote = async (isYes: boolean) => {
    if (!session?.user?.id) return;
    if (hasVoted === isYes) return;
    setIsVoting(true);

    try {
      await supabase.from('ranked_votes').upsert({
        user_id: session.user.id,
        vote_yes: isYes
      }, { onConflict: 'user_id' });

      setTotalVotes(prev => {
        let yesDelta = 0;
        let noDelta = 0;

        if (hasVoted === null) {
          if (isYes) yesDelta = 1;
          else noDelta = 1;
        } else if (hasVoted === true && !isYes) {
          yesDelta = -1;
          noDelta = 1;
        } else if (hasVoted === false && isYes) {
          yesDelta = 1;
          noDelta = -1;
        }

        return {
          yes: prev.yes + yesDelta,
          no: prev.no + noDelta
        };
      });

      setHasVoted(isYes);
    } catch (error) {
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const total = totalVotes.yes + totalVotes.no;
  const yesPercentage = total > 0 ? Math.round((totalVotes.yes / total) * 100) : 0;

  return (
    <div style={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "12px", padding: "30px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "rgba(251, 191, 36, 0.1)", color: "#fbbf24", fontSize: "24px", marginBottom: "20px" }}>
        🔒
      </div>
      
      <h2 style={{ color: "white", fontSize: "24px", fontWeight: "900", letterSpacing: "2px", margin: "0 0 10px 0" }}>RANKED MODE VAULTED</h2>
      <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.6", marginBottom: "30px" }}>
        Omoggle blew up. To keep the servers alive and the matchmaking fast, we've funneled everyone into Casual Mode. <br/><br/>
        We are considering opening Ranked as a premium, high-stakes arena to fund the servers. Would you be interested?
      </p>

      <div style={{ backgroundColor: "#18181b", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
        {!session ? (
          <div>
            <div style={{ color: "white", fontWeight: "bold", marginBottom: "15px" }}>Login required to vote and secure your beta spot.</div>
            <button 
              onClick={() => window.location.href = "/auth"} 
              style={{ padding: "12px 24px", backgroundColor: "#fbbf24", color: "black", fontWeight: "900", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%" }}
            >
              SIGN UP TO VOTE
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
              <button 
                onClick={() => handleVote(true)}
                disabled={isVoting || hasVoted === true}
                style={{ flex: "1 1 200px", padding: "15px", backgroundColor: hasVoted === true ? "#fbbf24" : "#27272a", color: hasVoted === true ? "black" : "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: (isVoting || hasVoted === true) ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: hasVoted === false ? 0.6 : 1 }}
              >
                YES, I'D PAY FOR RANKED
              </button>
              <button 
                onClick={() => handleVote(false)}
                disabled={isVoting || hasVoted === false}
                style={{ flex: "1 1 200px", padding: "15px", backgroundColor: hasVoted === false ? "#ef4444" : "#27272a", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: (isVoting || hasVoted === false) ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: hasVoted === true ? 0.6 : 1 }}
              >
                NO, KEEP IT CASUAL
              </button>
            </div>
            
            {hasVoted !== null && (
              <div style={{ textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#a1a1aa", fontSize: "12px", marginBottom: "8px", fontWeight: "bold" }}>
                  <span>YES ({yesPercentage}%)</span>
                  <span>{total} Total Votes</span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#27272a", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ width: `${yesPercentage}%`, height: "100%", backgroundColor: "#fbbf24", transition: "width 0.5s ease" }}></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ color: "#71717a", fontSize: "12px" }}>For now, jump into Casual to mog some randoms.</div>
    </div>
  );
}
