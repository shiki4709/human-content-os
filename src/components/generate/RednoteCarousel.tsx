'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/components/Toast'

type Slide = {
  type: 'cover' | 'content' | 'cta'
  text: string
  sub?: string
  _idx?: number
}

type BgStyle = {
  id: string
  label: string
  textColor: string
  accentColor: string
  paint: (ctx: CanvasRenderingContext2D, W: number, H: number) => void
}

const BG_PRESETS: BgStyle[] = [
  {
    id: 'blossom', label: '🌸 樱花', textColor: '#fff', accentColor: '#fce7f3',
    paint(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#ff2d55'); g.addColorStop(0.55, '#ff6b9d'); g.addColorStop(1, '#ffb3c6')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const circles: [number, number, number][] = [[.15, .1, 120], [.85, .25, 80], [.5, .7, 140], [.9, .8, 60]]
      circles.forEach(([x, y, r]) => {
        ctx.globalAlpha = .13; ctx.beginPath(); ctx.arc(W * x, H * y, r, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
      })
      ctx.globalAlpha = 1
    },
  },
  {
    id: 'matcha', label: '🍵 抹茶', textColor: '#052e16', accentColor: '#166534',
    paint(ctx, W, H) {
      const g = ctx.createLinearGradient(0, H, W, 0)
      g.addColorStop(0, '#bbf7d0'); g.addColorStop(0.5, '#86efac'); g.addColorStop(1, '#4ade80')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = .1; ctx.fillStyle = '#14532d'
      ctx.beginPath(); ctx.arc(W * .8, H * .2, 200, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    },
  },
  {
    id: 'violet', label: '💜 紫调', textColor: '#fff', accentColor: '#e9d5ff',
    paint(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#581c87'); g.addColorStop(0.5, '#7e22ce'); g.addColorStop(1, '#a855f7')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#fff'
      for (let i = 0; i < 60; i++) {
        ctx.globalAlpha = Math.random() * .4 + .05
        ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2 + .5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    },
  },
  {
    id: 'cream', label: '🧈 奶油', textColor: '#3d1f0a', accentColor: '#92400e',
    paint(ctx, W, H) {
      ctx.fillStyle = '#fdf6e8'; ctx.fillRect(0, 0, W, H)
      const g = ctx.createRadialGradient(W * .3, H * .3, 0, W * .3, H * .3, W * .8)
      g.addColorStop(0, 'rgba(251,191,36,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = .025
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = '#78350f'
        ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5)
      }
      ctx.globalAlpha = 1
    },
  },
  {
    id: 'night', label: '🌙 深夜', textColor: '#fff', accentColor: '#fbbf24',
    paint(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#0f0c29'); g.addColorStop(0.5, '#302b63'); g.addColorStop(1, '#24243e')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#fff'
      for (let i = 0; i < 80; i++) {
        ctx.globalAlpha = Math.random() * .7 + .1
        ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H * 0.6, Math.random() * 1.5 + .3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      const mg = ctx.createRadialGradient(W * .75, H * .12, 0, W * .75, H * .12, 90)
      mg.addColorStop(0, 'rgba(251,191,36,.22)'); mg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H)
    },
  },
  {
    id: 'coral', label: '🪸 珊瑚', textColor: '#fff', accentColor: '#fecdd3',
    paint(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#f97316'); g.addColorStop(0.5, '#fb923c'); g.addColorStop(1, '#fdba74')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const circles: [number, number, number][] = [[.1, .85, 160], [.9, .1, 100]]
      circles.forEach(([x, y, r]) => {
        ctx.globalAlpha = .15; ctx.beginPath(); ctx.arc(W * x, H * y, r, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
      })
      ctx.globalAlpha = 1
    },
  },
]

function splitIntoSlides(text: string): Slide[] {
  const paras = text.split(/\n+/).filter(p => p.trim())
  if (paras.length >= 3) {
    const slides: Slide[] = []
    slides.push({ type: 'cover', text: paras[0].slice(0, 60) })
    const mid = paras.slice(1, paras.length - 1)
    const chunkSize = Math.ceil(mid.length / 2)
    for (let i = 0; i < mid.length; i += chunkSize) {
      slides.push({ type: 'content', text: mid.slice(i, i + chunkSize).join('\n') })
    }
    slides.push({ type: 'cta', text: paras[paras.length - 1].slice(0, 80) })
    return slides.slice(0, 4)
  }
  // Fallback: split by char count
  const result: Slide[] = []
  let cur = ''
  for (const ch of text) {
    cur += ch
    if (cur.length > 120 && (ch === '\n' || ch === '。' || ch === '！')) {
      result.push({ type: 'content', text: cur.trim() })
      cur = ''
    }
  }
  if (cur.trim()) result.push({ type: 'content', text: cur.trim() })
  const final = result.slice(0, 4)
  return final.length ? final : [{ type: 'content', text: text.slice(0, 200) }]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const chars = Array.from(text)
  let line = ''
  const lines: string[] = []
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch }
    else line = test
  }
  if (line) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return lines.length
}

function drawRednoteSlide(ctx: CanvasRenderingContext2D, slide: Slide, style: BgStyle, W: number, H: number) {
  const dark = style.textColor === '#fff'
  const tc = style.textColor
  const ac = style.accentColor
  const pad = 30
  const type = slide.type || 'content'

  // Ambient depth shapes
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.beginPath(); ctx.arc(W * 0.88, H * 0.1, W * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#fff' : ac; ctx.fill()
  ctx.globalAlpha = 0.07
  ctx.beginPath(); ctx.arc(W * 0.08, H * 0.9, W * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#fff' : ac; ctx.fill()
  ctx.restore()

  if (type === 'cover') {
    // Category pill
    ctx.save()
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.09)'
    roundRect(ctx, pad, pad, 90, 28, 14); ctx.fill()
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)'
    ctx.font = '600 11px DM Sans,sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('分享笔记 ✦', pad + 12, pad + 19)
    ctx.restore()

    // Ghost large numeral
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.fillStyle = tc
    ctx.font = `900 ${W * 1.2}px DM Sans,sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('1', W * 0.5, H * 0.75)
    ctx.restore()

    // Main headline
    ctx.fillStyle = tc
    const headline = (slide.text || '').slice(0, 60)
    const fontSize = headline.length > 20 ? 34 : 40
    ctx.font = `800 ${fontSize}px DM Sans,sans-serif`
    ctx.textAlign = 'left'
    const linesDrawn = wrapText(ctx, headline, pad, H * 0.38, W - pad * 2, fontSize * 1.3)

    // Accent underline
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.45)' : ac
    ctx.fillRect(pad, H * 0.38 + linesDrawn * (fontSize * 1.3) + 8, 48, 3)

    // Subline
    if (slide.sub) {
      ctx.save()
      ctx.globalAlpha = 0.65
      ctx.fillStyle = tc
      ctx.font = '400 16px DM Sans,sans-serif'
      wrapText(ctx, slide.sub.slice(0, 60), pad, H * 0.38 + linesDrawn * (fontSize * 1.3) + 28, W - pad * 2, 22)
      ctx.restore()
    }

    // Bottom swipe cue
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = tc
    ctx.font = '500 12px DM Sans,sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('向左滑动查看更多 →', W / 2, H - pad - 2)
    ctx.restore()

  } else if (type === 'cta') {
    ctx.font = '80px serif'
    ctx.textAlign = 'center'
    ctx.fillText('💕', W / 2, H * 0.35)

    ctx.fillStyle = tc
    ctx.font = '800 28px DM Sans,sans-serif'
    ctx.textAlign = 'center'
    wrapText(ctx, slide.text || '关注 · 收藏 · 点赞', W / 2, H * 0.48, W - pad * 2, 38)

    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = tc
    ctx.font = '400 15px DM Sans,sans-serif'
    ctx.fillText('感谢你的支持 🙏', W / 2, H * 0.48 + 82)
    ctx.restore()
    ctx.textAlign = 'left'

  } else {
    // CONTENT slide
    const nums = ['②', '③', '④', '⑤', '⑥']
    const numLabel = nums[Math.min((slide._idx || 1) - 1, 4)]
    ctx.fillStyle = tc
    ctx.font = '900 56px DM Sans,sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(numLabel, pad, pad + 56)

    // Rule after number
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : ac
    ctx.fillRect(pad, pad + 70, W - pad * 2, 2)

    // Content lines
    const rawLines = (slide.text || '').split('\n').filter(Boolean)
    const lines: string[] = []
    rawLines.forEach(l => {
      if (l.length <= 30) { lines.push(l); return }
      for (let i = 0; i < l.length; i += 28) lines.push(l.slice(i, i + 28))
    })

    let y = pad + 100
    const lineH = 38
    lines.slice(0, 7).forEach((line, i) => {
      // Accent tick
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : ac
      ctx.fillRect(pad, y - 14, 16, 2)

      ctx.fillStyle = tc
      const isFirst = i === 0
      ctx.font = `${isFirst ? '700' : '500'} ${isFirst ? 20 : 18}px DM Sans,sans-serif`
      ctx.globalAlpha = isFirst ? 1 : 0.82
      ctx.textAlign = 'left'
      ctx.fillText(line.slice(0, 30), pad + 24, y)
      ctx.globalAlpha = 1
      y += isFirst ? lineH + 4 : lineH
    })

    if (lines.length > 7) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = tc
      ctx.font = '400 13px DM Sans,sans-serif'
      ctx.fillText('…', pad + 24, y)
      ctx.restore()
    }
  }

  // Footer brand line
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = tc
  ctx.fillRect(pad, H - 24, W - pad * 2, 1)
  ctx.globalAlpha = 0.45
  ctx.fillStyle = tc
  ctx.font = '600 10px DM Sans,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HUMAN', pad, H - 10)
  ctx.textAlign = 'right'
  ctx.fillText('小红书', W - pad, H - 10)
  ctx.restore()
}

export default function RednoteCarousel({ content }: { content: string }) {
  const [styleIdx, setStyleIdx] = useState(0)
  const [curIdx, setCurIdx] = useState(0)
  const [slides, setSlides] = useState<Slide[]>([])
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const displayRef = useRef<HTMLCanvasElement | null>(null)

  const style = BG_PRESETS[styleIdx]

  // Split content into slides
  useEffect(() => {
    const s = splitIntoSlides(content)
    s.forEach((sl, i) => { sl._idx = i })
    setSlides(s)
    setCurIdx(0)
  }, [content])

  // Draw all slides when slides or style changes
  const drawAll = useCallback(() => {
    slides.forEach((slide, i) => {
      const canvas = canvasRefs.current[i]
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      style.paint(ctx, W, H)
      drawRednoteSlide(ctx, slide, style, W, H)
    })
    showSlide(curIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, style])

  useEffect(() => {
    // Small delay to ensure canvases are in DOM
    const t = setTimeout(drawAll, 50)
    return () => clearTimeout(t)
  }, [drawAll])

  function showSlide(idx: number) {
    const source = canvasRefs.current[idx]
    const display = displayRef.current
    if (!source || !display) return
    const ctx = display.getContext('2d')
    if (!ctx) return
    display.width = source.width
    display.height = source.height
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(source, 0, 0)
  }

  function goTo(idx: number) {
    if (idx < 0 || idx >= slides.length) return
    setCurIdx(idx)
    showSlide(idx)
  }

  function handleStyleChange(idx: number) {
    setStyleIdx(idx)
  }

  function handleDownload() {
    const source = canvasRefs.current[curIdx]
    if (!source) return
    const link = document.createElement('a')
    link.download = `rednote-slide-${curIdx + 1}.png`
    link.href = source.toDataURL('image/png')
    link.click()
    toast('Slide downloaded')
  }

  function handleCopyDraft() {
    navigator.clipboard.writeText(content).then(() => {
      toast('Copied — open Rednote and create a draft')
    })
  }

  return (
    <div className="p-5">
      {/* Carousel viewer */}
      <div className="relative flex items-center justify-center mb-4">
        <button
          onClick={() => goTo(curIdx - 1)}
          disabled={curIdx === 0}
          className="absolute left-0 z-10 w-8 h-8 rounded-full bg-bg border border-border2 flex items-center justify-center text-text2 hover:bg-bg2 disabled:opacity-30 disabled:cursor-default transition-all"
        >
          ‹
        </button>
        <canvas
          ref={displayRef}
          width={480}
          height={640}
          className="rounded-[10px] shadow-lg"
          style={{ width: 240, height: 320 }}
        />
        <button
          onClick={() => goTo(curIdx + 1)}
          disabled={curIdx === slides.length - 1}
          className="absolute right-0 z-10 w-8 h-8 rounded-full bg-bg border border-border2 flex items-center justify-center text-text2 hover:bg-bg2 disabled:opacity-30 disabled:cursor-default transition-all"
        >
          ›
        </button>
      </div>

      {/* Dot nav */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-[7px] h-[7px] rounded-full transition-all ${
                i === curIdx ? 'bg-accent scale-125' : 'bg-border2 hover:bg-text3'
              }`}
            />
          ))}
        </div>
      )}

      {/* Background selector */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[.07em] text-text3 mb-2">Background</div>
        <div className="flex flex-wrap gap-1.5">
          {BG_PRESETS.map((bg, i) => (
            <button
              key={bg.id}
              onClick={() => handleStyleChange(i)}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                i === styleIdx
                  ? 'border-accent bg-acl text-accent font-medium'
                  : 'border-border text-text2 hover:border-border2'
              }`}
            >
              {bg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { drawAll() }}
          className="px-3 py-1.5 rounded-lg border border-border2 text-[12px] text-text2 hover:bg-bg2 transition-all"
        >
          ↺ Regenerate
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg border border-border2 text-[12px] text-text2 hover:bg-bg2 transition-all"
          >
            ⬇ Download
          </button>
          <button
            onClick={handleCopyDraft}
            className="px-3 py-1.5 rounded-lg bg-[#ff2442] text-white text-[12px] font-medium hover:bg-[#e61e3a] transition-all"
          >
            🌸 Copy & draft
          </button>
        </div>
      </div>

      {/* Hidden canvases for drawing */}
      <div className="fixed -left-[9999px] top-0 invisible pointer-events-none">
        {slides.map((_, i) => (
          <canvas
            key={`${i}-${styleIdx}`}
            ref={el => { canvasRefs.current[i] = el }}
            width={480}
            height={640}
          />
        ))}
      </div>
    </div>
  )
}
