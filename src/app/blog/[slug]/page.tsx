import { notFound } from "next/navigation";
import Link from "next/link";
import { blogs } from "@/data/blogs";
import { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

// Dynamically generate SEO metadata for each article
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const post = blogs.find((b) => b.slug === resolvedParams.slug);
  if (!post) return { title: 'Post Not Found' };
  
  return {
    title: `${post.title} | Omoggle Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPost({ params }: Props) {
  const resolvedParams = await params;
  const post = blogs.find((b) => b.slug === resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#e4e4e7", padding: "60px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        
        <Link href="/" style={{ color: "#ef4444", textDecoration: "none", fontSize: "14px", fontWeight: "bold", display: "inline-block", marginBottom: "40px" }}>
          ← BACK TO ARENA
        </Link>

        <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: "bold", letterSpacing: "2px", marginBottom: "15px" }}>
          {post.category} • {post.date}
        </div>
        
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: "900", color: "white", marginBottom: "30px", letterSpacing: "-1px", lineHeight: "1.1" }}>
          {post.title}
        </h1>

        <div 
          style={{ fontSize: "16px", lineHeight: "1.8", color: "#d4d4d8", display: "flex", flexDirection: "column", gap: "20px" }}
          dangerouslySetInnerHTML={{ 
            // Very basic markdown parsing for h2, h3, and bold text to keep it lightweight
            __html: post.content
              .replace(/### (.*)/g, '<h3 style="color: white; font-size: 1.3rem; font-weight: bold; margin-top: 20px;">$1</h3>')
              .replace(/## (.*)/g, '<h2 style="color: white; font-size: 1.6rem; font-weight: bold; margin-top: 30px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">$1</h2>')
              .replace(/\*\*(.*?)\*\*/g, '<strong style="color: white;">$1</strong>') 
          }} 
        />
      </div>
    </div>
  );
}
