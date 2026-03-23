import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  const { text, subtitle, style = 'dark' } = await request.json()

  if (!text) {
    return new Response(JSON.stringify({ error: 'text is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const isDark = style !== 'light'

  const bg = isDark
    ? 'linear-gradient(135deg, #1c1b18 0%, #2d2b26 50%, #1c1b18 100%)'
    : 'linear-gradient(135deg, #f8f7f5 0%, #ffffff 50%, #f0ede8 100%)'

  const textColor = isDark ? '#ffffff' : '#1c1b18'
  const subtitleColor = isDark ? '#a8a49c' : '#6b6860'
  const accentColor = '#1a56db'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            height: '6px',
            background: accentColor,
          }}
        />

        {/* Main text */}
        <div
          style={{
            fontSize: text.length > 60 ? '64px' : text.length > 30 ? '80px' : '100px',
            fontWeight: '700',
            color: textColor,
            textAlign: 'center',
            lineHeight: '1.1',
            letterSpacing: '-0.02em',
            maxWidth: '1000px',
            fontFamily: 'sans-serif',
          }}
        >
          {text}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: '32px',
              fontWeight: '500',
              color: subtitleColor,
              textAlign: 'center',
              marginTop: '32px',
              maxWidth: '800px',
              lineHeight: '1.4',
              fontFamily: 'sans-serif',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Bottom label */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: '60px',
            fontSize: '18px',
            fontWeight: '600',
            color: accentColor,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            fontFamily: 'sans-serif',
          }}
        >
          Human
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
