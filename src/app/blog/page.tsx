import Link from 'next/link';
import { getAllBlogs } from '@/lib/mdx';

export const metadata = { title: 'Omoggle Blog | Looksmaxxing & Strategy' };

export default function BlogIndex() {
  const posts = getAllBlogs();
  return (
    <div className="min-h-screen bg-black text-white p-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-black italic tracking-tighter mb-10 uppercase">The Arena Logs</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <Link
              href={`/blog/${post.slug}`}
              key={post.slug}
              className="block border border-zinc-800 p-6 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition-colors"
            >
              <p className="text-red-500 text-xs font-bold tracking-widest mb-2 uppercase">{post.meta.category}</p>
              <h2 className="text-2xl font-bold text-white mb-2">{post.meta.title}</h2>
              <p className="text-zinc-400 text-sm line-clamp-3">{post.meta.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
