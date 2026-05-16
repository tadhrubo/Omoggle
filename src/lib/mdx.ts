import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDirectory = path.join(process.cwd(), 'content');

export function getPostBySlug(slug: string) {
  const realSlug = slug.replace(/\.mdx$/, '');
  let fullPath = path.join(contentDirectory, `${realSlug}.mdx`);

  // Log for production debugging
  console.log(`Searching for post: ${realSlug} at ${fullPath}`);

  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found at ${fullPath}, trying to find match in directory...`);
    // Fallback: try to find a file that matches the slug even if it's missing/has extra prefix
    const files = fs.readdirSync(contentDirectory);
    const match = files.find(f => f.replace(/\.mdx$/, '') === realSlug || f.replace(/^blog-/, '').replace(/\.mdx$/, '') === realSlug);
    
    if (match) {
      fullPath = path.join(contentDirectory, match);
      console.log(`Found fallback match: ${match}`);
    } else {
      throw new Error(`Post not found: ${realSlug}`);
    }
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  return { slug: realSlug, meta: data, content };
}

export function getAllBlogs() {
  if (!fs.existsSync(contentDirectory)) {
    console.error(`Content directory not found at ${contentDirectory}`);
    return [];
  }

  const files = fs.readdirSync(contentDirectory);
  return files
    .filter((file) => file.startsWith('blog-') && file.endsWith('.mdx'))
    .map((file) => {
      try {
        return getPostBySlug(file);
      } catch (e) {
        console.error(`Error loading blog ${file}:`, e);
        return null;
      }
    })
    .filter((post): post is NonNullable<typeof post> => post !== null)
    .sort((a, b) => {
      const dateA = a.meta.publishedAt ? new Date(a.meta.publishedAt).getTime() : 0;
      const dateB = b.meta.publishedAt ? new Date(b.meta.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
}
