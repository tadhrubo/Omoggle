import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Omoggle",
  description: "Privacy Policy and Data Handling practices for Omoggle.games",
};

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#e4e4e7", padding: "60px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "#18181b", padding: "40px", borderRadius: "16px", border: "1px solid #27272a" }}>
        
        {/* Global Logo Home Button handles navigation */}

        <h1 style={{ fontSize: "2.5rem", fontWeight: "900", color: "white", marginBottom: "10px", letterSpacing: "-1px" }}>PRIVACY POLICY</h1>
        <p style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "40px" }}>Last Updated: May 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "30px", lineHeight: "1.6", fontSize: "15px" }}>
          
          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>1. Introduction</h2>
            <p>Welcome to Omoggle ("we", "our", or "us"). We operate the website at omoggle.games. We respect your privacy and are committed to protecting it through our compliance with this policy. This policy describes the types of information we may collect from you or that you may provide when you visit the website, and our practices for collecting, using, maintaining, protecting, and disclosing that information.</p>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>2. Information We Collect</h2>
            <ul style={{ paddingLeft: "20px", color: "#d4d4d8", display: "flex", flexDirection: "column", gap: "10px" }}>
              <li><strong>Google Account Data:</strong> When you sign in using Google OAuth, we collect your email address, name, and profile picture. This is used strictly to create your account, display your identity on the leaderboard, and save your "Elo" rank.</li>
              <li><strong>Video and Audio Data:</strong> Omoggle uses Peer-to-Peer (WebRTC) technology for video and audio chat. <strong>We do not record, store, or monitor your video or audio streams on our servers.</strong> The connection is established directly between you and your match.</li>
              <li><strong>Usage Data:</strong> We collect anonymous analytics data (such as time spent on site, queue times, and browser type) via Google Analytics to improve our matchmaking and site performance.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>3. Google API Services User Data Policy</h2>
            <p>Omoggle's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={{ color: "#ef4444" }}>Google API Services User Data Policy</a>, including the Limited Use requirements. We do not sell your Google data to third-party advertising networks or data brokers.</p>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>4. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul style={{ paddingLeft: "20px", color: "#d4d4d8", marginTop: "10px" }}>
              <li>Authenticate your account and maintain your session.</li>
              <li>Track your competitive Elo rating and display your chosen username.</li>
              <li>Enforce our Terms of Service (e.g., banning users who violate community guidelines).</li>
            </ul>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>5. Data Deletion</h2>
            <p>You have the right to request the deletion of your account and associated data. If you wish to permanently delete your Omoggle profile, Elo history, and Google authorization from our database, please contact us at the email provided below. Your data will be wiped from our database within 7 days of the request.</p>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>6. Age Restriction</h2>
            <p>Omoggle involves connecting with random strangers via live video. Due to the nature of this service, you must be at least 18 years of age to use this platform. We do not knowingly collect personal information from children under 18.</p>
          </section>

          <section>
            <h2 style={{ color: "white", fontSize: "1.2rem", fontWeight: "bold", marginBottom: "10px", borderBottom: "1px solid #27272a", paddingBottom: "10px" }}>7. Contact Us</h2>
            <p>If you have any questions about this privacy policy or wish to submit a data deletion request, please contact us at:</p>
            {/* REPLACE THIS WITH YOUR ACTUAL SUPPORT EMAIL */}
            <p style={{ color: "#ef4444", fontWeight: "bold", marginTop: "10px" }}>curfewtrevor@gmail.com</p> 
          </section>

        </div>
      </div>
    </div>
  );
}