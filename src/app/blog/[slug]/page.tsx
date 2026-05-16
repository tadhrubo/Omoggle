import { getPostBySlug, getAllBlogs } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateStaticParams() {
  return getAllBlogs().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { meta } = getPostBySlug(slug);
    return {
      title: `${meta.title} | Omoggle`,
      description: meta.description,
      alternates: { canonical: meta.canonical },
      openGraph: {
        title: meta.title,
        description: meta.description,
        images: meta.ogImage ? [{ url: meta.ogImage }] : [],
      },
    };
  } catch {
    return { title: 'Not Found' };
  }
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let post;
  
  try {
    post = getPostBySlug(slug);
  } catch (err) {
    console.error(`Error fetching blog post with slug "${slug}":`, err);
    notFound();
  }

  const { content, meta } = post;
  const publishedDate = meta.publishedAt
    ? new Date(meta.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: 'white' }}>
      {/* ... rest of the component ... */}

        {/* ── Topbar ── */}
        <nav style={{ borderBottom: '1px solid #18181b', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(8px)' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#ef4444', fontWeight: '900', fontSize: '16px', letterSpacing: '2px' }}>OMOGGLE</Link>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <Link href="/blog" style={{ textDecoration: 'none', color: '#71717a', fontSize: '13px', fontWeight: '600', letterSpacing: '1px' }}>ALL POSTS</Link>
            <Link href="/" style={{ textDecoration: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '12px', fontWeight: '700', padding: '8px 18px', borderRadius: '99px', letterSpacing: '1px' }}>ENTER ARENA</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <header style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px 40px' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <Link href="/blog" style={{ textDecoration: 'none', color: '#71717a', fontSize: '12px', fontWeight: '600', letterSpacing: '1.5px' }}>BLOG</Link>
            <span style={{ color: '#3f3f46', fontSize: '12px' }}>›</span>
            {meta.category && (
              <div style={{ display: 'inline-block', backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '99px', padding: '2px 10px' }}>
                <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: '700', letterSpacing: '2px' }}>{meta.category}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '900', color: 'white', lineHeight: '1.2', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>{meta.title}</h1>

          {/* Description */}
          {meta.description && (
            <p style={{ fontSize: '17px', color: '#a1a1aa', lineHeight: '1.65', margin: '0 0 28px 0' }}>{meta.description}</p>
          )}

          {/* Meta Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '32px', borderBottom: '1px solid #18181b' }}>
            {publishedDate && <span style={{ color: '#52525b', fontSize: '13px', fontFamily: 'monospace' }}>{publishedDate}</span>}
            <span style={{ color: '#3f3f46', fontSize: '13px' }}>·</span>
            <span style={{ color: '#52525b', fontSize: '13px', fontFamily: 'monospace' }}>OMOGGLE EDITORIAL</span>
          </div>
        </header>

        {/* ── Body ── */}
        <main style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 100px' }}>
          <div className="blog-prose">
            <MDXRemote source={content} />
          </div>
        </main>

        {/* ── CTA Footer ── */}
        <div style={{ borderTop: '1px solid #18181b', backgroundColor: '#0c0c0e' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ color: '#71717a', fontSize: '11px', letterSpacing: '3px', marginBottom: '16px', fontFamily: 'monospace' }}>READY TO COMPETE?</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '900', color: 'white', margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>Find out where you rank.</h2>
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', backgroundColor: '#ef4444', color: 'white', fontWeight: '900', fontSize: '15px', padding: '14px 40px', borderRadius: '99px', letterSpacing: '1px' }}>ENTER THE ARENA →</Link>
            <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #18181b' }}>
              <Link href="/blog" style={{ textDecoration: 'none', color: '#71717a', fontSize: '13px', fontWeight: '600', letterSpacing: '1.5px' }}>← BACK TO ALL POSTS</Link>
            </div>
          </div>
        </div>

        {/* ── Global prose styles ── */}
        <style>{`
          .blog-prose { color: #d4d4d8; font-size: 16px; line-height: 1.75; }
          .blog-prose h1 { font-size: 2rem; font-weight: 900; color: white; margin: 2.5rem 0 1rem; letter-spacing: -0.5px; line-height: 1.2; }
          .blog-prose h2 { font-size: 1.45rem; font-weight: 800; color: white; margin: 2.5rem 0 0.8rem; letter-spacing: -0.3px; border-bottom: 1px solid #27272a; padding-bottom: 10px; }
          .blog-prose h3 { font-size: 1.15rem; font-weight: 700; color: #e4e4e7; margin: 2rem 0 0.6rem; }
          .blog-prose p { margin: 0 0 1.3rem; }
          .blog-prose strong { color: white; font-weight: 700; }
          .blog-prose em { color: #d4d4d8; font-style: italic; }
          .blog-prose a { color: #ef4444; text-decoration: underline; text-underline-offset: 3px; }
          .blog-prose a:hover { color: #f87171; }
          .blog-prose ul, .blog-prose ol { margin: 0 0 1.3rem 1.5rem; }
          .blog-prose li { margin-bottom: 0.5rem; }
          .blog-prose li::marker { color: #ef4444; }
          .blog-prose blockquote { border-left: 3px solid #ef4444; padding: 0 0 0 20px; margin: 1.5rem 0; color: #a1a1aa; font-style: italic; }
          .blog-prose code { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; padding: 2px 7px; border-radius: 4px; font-size: 0.88em; }
          .blog-prose pre { background: #111113; border: 1px solid #27272a; border-radius: 10px; padding: 20px; overflow-x: auto; margin: 1.5rem 0; }
          .blog-prose pre code { background: none; border: none; color: #e4e4e7; padding: 0; }
          .blog-prose hr { border: none; border-top: 1px solid #27272a; margin: 2.5rem 0; }
          .blog-prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 14px; }
          .blog-prose th { text-align: left; color: white; font-weight: 700; padding: 10px 14px; border-bottom: 2px solid #27272a; background: rgba(255,255,255,0.03); }
          .blog-prose td { padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; }
          .blog-prose tr:hover td { background: rgba(255,255,255,0.02); }
        `}</style>
      </div>
    );
}
