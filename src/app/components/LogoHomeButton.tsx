"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function LogoHomeButton() {
  const pathname = usePathname();

  if (pathname === "/lobby" || pathname === "/") {
    return null;
  }

  return (
    <Link
      href="/"
      style={{
        position: "fixed",
        top: "24px",
        left: "24px",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        transition: "transform 0.2s ease",
      }}
      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <Image
        src="/logo.png"
        alt="Omoggle Logo"
        width={48}
        height={48}
        priority
        style={{
          borderRadius: "12px",
          boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
    </Link>
  );
}

