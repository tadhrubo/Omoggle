import { getPostBySlug } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Omoggle Ranks & Leaderboard Guide' };

export default function RanksPage() {
  try {
    const { content } = getPostBySlug('page-ranks');
    return (
      <div className="min-h-screen bg-black text-white p-10 font-sans">
        <article className="max-w-3xl mx-auto prose prose-invert prose-green lg:prose-xl">
          <MDXRemote source={content} />
        </article>
      </div>
    );
  } catch (e) {
    notFound();
  }
}
