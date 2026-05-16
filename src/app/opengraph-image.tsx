import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div style={{
        background: '#080A0F',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px',
      }}>
        <div style={{
          color: '#ef4444',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 6,
          marginBottom: 40,
          display: 'flex',
        }}>
          OMOGGLE
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: 80,
          fontWeight: 900,
          lineHeight: 1,
          textAlign: 'center',
          marginBottom: 30,
          display: 'flex',
        }}>
          MOG<br/>OR<br/>BE MOGGED
        </div>
        <div style={{
          color: '#52525b',
          fontSize: 20,
          marginTop: 20,
          display: 'flex',
        }}>
          1v1 Mog Battle Arena
        </div>
      </div>
    ),
    { ...size }
  )
}