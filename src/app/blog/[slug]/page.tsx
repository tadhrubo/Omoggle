import { getPostBySlug, getAllBlogs } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return getAllBlogs().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const { meta } = getPostBySlug(params.slug);
    return { title: `${meta.title} | Omoggle`, description: meta.description };
  } catch (e) {
    return { title: 'Not Found' };
  }
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  try {
    const { content, meta } = getPostBySlug(params.slug);
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <article className="max-w-3xl mx-auto prose prose-invert prose-green lg:prose-xl">
          <h1 className="text-white">{meta.title}</h1>
          <MDXRemote source={content} />
        </article>
      </div>
    );
  } catch (e) {
    notFound();
  }
}
