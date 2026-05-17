import { getPostBySlug } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Omoggle App | iOS & Android' };

export default function AppLandingPage() {
  try {
    const { content } = getPostBySlug('page-app');
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
