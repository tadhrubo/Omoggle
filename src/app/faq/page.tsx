import { getPostBySlug } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';

export const metadata = { title: 'Frequently Asked Questions | Omoggle' };

export default function FAQPage() {
  const { content } = getPostBySlug('faq-page');
  return (
    <div className="min-h-screen bg-black text-white p-10">
      <article className="max-w-3xl mx-auto prose prose-invert prose-green lg:prose-xl">
        <MDXRemote source={content} />
      </article>
    </div>
  );
}
