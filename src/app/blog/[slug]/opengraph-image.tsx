import { ImageResponse } from 'next/og'
import { getPostBySlug, getAllBlogs } from '@/lib/mdx'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function generateStaticParams() {
  return getAllBlogs().map((post) => ({ slug: post.slug }))
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let meta

  try {
    const { meta: postMeta } = getPostBySlug(slug)
    meta = postMeta
  } catch {
    meta = { title: 'Omoggle', category: 'MOG BATTLE' }
  }

  return new ImageResponse(
    (
      <div style={{
        background: '#080A0F',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
      }}>
        <div style={{
          color: '#ef4444',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 4,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: '#71717a' }}>●</span> OMOGGLE
          <span style={{ color: '#71717a' }}>●</span> {meta.category || 'MOG BATTLE'}
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1.15,
          display: 'flex',
          flexWrap: 'wrap',
        }}>
          {meta.title?.slice(0, 60) || slug.replace(/-/g, ' ').toUpperCase()}
        </div>
        <div style={{
          color: '#52525b',
          fontSize: 18,
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          omoggle.games
          <span style={{ color: '#ef4444', marginLeft: 16 }}>♦</span>
          Enter the Arena
        </div>
      </div>
    ),
    { ...size }
  )
}