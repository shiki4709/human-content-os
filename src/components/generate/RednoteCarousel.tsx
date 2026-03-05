'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/components/Toast'

type Slide = {
  type: 'cover' | 'content' | 'cta'
  text: string
  _idx?: number
}

type BgStyle = {
  id: string
  label: string
  textColor: string
  accentColor: string
  paint: (ctx: CanvasRenderingContext2D, W: number, H: number) => void
}

// Canvas constants — strict bounds
const CW = 480
const CH = 640
const PAD = 32
const MAX_X = CW - PAD   // 448
const MAX_Y = CH - PAD   // 608
const TEXT_W = CW - PAD * 2 // 416

// Cream (奶油) is first = default
const BG_PRESETS: BgStyle[] = [
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

/**
 * Word-wrap text using ctx.measureText() — never exceeds maxW pixels.
 * Returns array of lines (does NOT draw). Caller controls drawing position.
 */
function breakLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const chars = Array.from(text)
  let line = ''
  const lines: string[] = []
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = ch
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  // If we hit maxLines and there's leftover text, add ellipsis to last line
  if (lines.length === maxLines && line && !lines[lines.length - 1].endsWith(line)) {
    const last = lines[lines.length - 1]
    // Trim last line to fit "…"
    let trimmed = last
    while (trimmed.length > 0 && ctx.measureText(trimmed + '…').width > maxW) {
      trimmed = trimmed.slice(0, -1)
    }
    lines[lines.length - 1] = trimmed + '…'
  }
  return lines
}

function drawRednoteSlide(ctx: CanvasRenderingContext2D, slide: Slide, style: BgStyle) {
  const dark = style.textColor === '#fff'
  const tc = style.textColor
  const ac = style.accentColor
  const type = slide.type || 'content'

  // Ambient depth shapes (decorative, can overflow — they're just circles)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.beginPath(); ctx.arc(CW * 0.88, CH * 0.1, CW * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#fff' : ac; ctx.fill()
  ctx.globalAlpha = 0.06
  ctx.beginPath(); ctx.arc(CW * 0.08, CH * 0.9, CW * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = dark ? '#fff' : ac; ctx.fill()
  ctx.restore()

  // Clip all text drawing to the safe zone
  ctx.save()
  ctx.beginPath()
  ctx.rect(PAD, PAD, TEXT_W, MAX_Y - PAD)
  ctx.clip()

  if (type === 'cover') {
    drawCover(ctx, slide, tc, ac, dark)
  } else if (type === 'cta') {
    drawCta(ctx, slide, tc)
  } else {
    drawContent(ctx, slide, tc, ac, dark)
  }

  ctx.restore() // un-clip

  // Footer brand line — fixed at bottom, always inside bounds
  drawFooter(ctx, tc)
}

function drawCover(ctx: CanvasRenderingContext2D, slide: Slide, tc: string, ac: string, dark: boolean) {
  // Category pill
  ctx.save()
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.09)'
  roundRect(ctx, PAD, PAD, 90, 26, 13); ctx.fill()
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)'
  ctx.font = '600 11px DM Sans,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('分享笔记 ✦', PAD + 12, PAD + 18)
  ctx.restore()

  // Ghost large numeral (decorative)
  ctx.save()
  ctx.globalAlpha = 0.04
  ctx.fillStyle = tc
  ctx.font = `900 ${CW}px DM Sans,sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('1', CW * 0.5, CH * 0.72)
  ctx.restore()

  // Main headline — max 32px, measureText line-breaking
  const headline = (slide.text || '').slice(0, 56)
  const fontSize = headline.length > 20 ? 28 : 32
  const lineH = fontSize * 1.5
  ctx.fillStyle = tc
  ctx.font = `800 ${fontSize}px DM Sans,sans-serif`
  ctx.textAlign = 'left'

  const lines = breakLines(ctx, headline, TEXT_W, 3)
  const startY = CH * 0.36
  lines.forEach((line, i) => {
    ctx.fillText(line, PAD, startY + i * lineH)
  })

  // Accent underline
  const underlineY = startY + lines.length * lineH + 6
  if (underlineY < MAX_Y - 40) {
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.45)' : ac
    ctx.fillRect(PAD, underlineY, 48, 3)
  }

  // Bottom swipe cue
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.fillStyle = tc
  ctx.font = '500 12px DM Sans,sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('向左滑动查看更多 →', CW / 2, MAX_Y - 16)
  ctx.restore()
}

function drawCta(ctx: CanvasRenderingContext2D, slide: Slide, tc: string) {
  // Big emoji
  ctx.font = '56px serif'
  ctx.textAlign = 'center'
  ctx.fillText('💕', CW / 2, CH * 0.32)

  // CTA text — max 24px
  ctx.fillStyle = tc
  ctx.font = '800 24px DM Sans,sans-serif'
  ctx.textAlign = 'center'
  const ctaText = (slide.text || '关注 · 收藏 · 点赞').slice(0, 50)
  const lines = breakLines(ctx, ctaText, TEXT_W, 3)
  const startY = CH * 0.44
  lines.forEach((line, i) => {
    // For center-aligned, we need to draw at center X
    const lw = ctx.measureText(line).width
    ctx.fillText(line, CW / 2 - lw / 2 + lw / 2, startY + i * 34)
  })

  // Sub text
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = tc
  ctx.font = '400 14px DM Sans,sans-serif'
  const subY = startY + lines.length * 34 + 16
  if (subY < MAX_Y - 16) {
    ctx.fillText('感谢你的支持 🙏', CW / 2, subY)
  }
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawContent(ctx: CanvasRenderingContext2D, slide: Slide, tc: string, ac: string, dark: boolean) {
  // Slide number — circled numeral
  const nums = ['②', '③', '④', '⑤', '⑥']
  const numLabel = nums[Math.min((slide._idx || 1) - 1, 4)]
  ctx.fillStyle = tc
  ctx.font = '900 36px DM Sans,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(numLabel, PAD, PAD + 40)

  // Rule after number
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.28)' : ac
  ctx.fillRect(PAD, PAD + 52, TEXT_W, 2)

  // Content text — max 16px font, line height 1.5x = 24px, max 5 lines
  const fontSize = 16
  const lineH = fontSize * 1.5 // 24px
  const maxLines = 5
  const textStartY = PAD + 78

  // Break the full slide text into lines using measureText
  const tickIndent = 20 // space for accent tick
  const textMaxW = TEXT_W - tickIndent
  ctx.font = `500 ${fontSize}px DM Sans,sans-serif`

  // Split by newlines first, then wrap each paragraph
  const paragraphs = (slide.text || '').split('\n').filter(Boolean)
  const allLines: string[] = []
  for (const para of paragraphs) {
    if (allLines.length >= maxLines) break
    const remaining = maxLines - allLines.length
    const wrapped = breakLines(ctx, para, textMaxW, remaining)
    allLines.push(...wrapped)
  }

  const footerY = MAX_Y - 12 // footer starts here
  let y = textStartY

  allLines.slice(0, maxLines).forEach((line, i) => {
    // Stop if we'd overlap the footer
    if (y + fontSize > footerY) return

    // Accent tick
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : ac
    ctx.fillRect(PAD, y - 5, 12, 2)

    // Text
    ctx.fillStyle = tc
    const isFirst = i === 0
    ctx.font = `${isFirst ? '600' : '400'} ${fontSize}px DM Sans,sans-serif`
    ctx.globalAlpha = isFirst ? 1 : 0.82
    ctx.textAlign = 'left'
    ctx.fillText(line, PAD + tickIndent, y)
    ctx.globalAlpha = 1
    y += lineH
  })

  // Ellipsis if truncated
  if (allLines.length > maxLines || paragraphs.join('').length > allLines.join('').length) {
    if (y + fontSize <= footerY) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = tc
      ctx.font = `400 ${fontSize}px DM Sans,sans-serif`
      ctx.fillText('…', PAD + tickIndent, y)
      ctx.restore()
    }
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, tc: string) {
  // Footer: thin rule at y=MAX_Y-12, brand text at y=MAX_Y-2
  // All within the PAD..MAX_X horizontal range
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = tc
  ctx.fillRect(PAD, MAX_Y - 12, TEXT_W, 1)

  ctx.globalAlpha = 0.45
  ctx.fillStyle = tc
  ctx.font = '600 10px DM Sans,sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HUMAN', PAD, MAX_Y - 2)
  ctx.textAlign = 'right'
  ctx.fillText('小红书', MAX_X, MAX_Y - 2)
  ctx.restore()
}

export default function RednoteCarousel({ content }: { content: string }) {
  const [styleIdx, setStyleIdx] = useState(0) // 0 = cream (奶油)
  const [curIdx, setCurIdx] = useState(0)
  const [slides, setSlides] = useState<Slide[]>([])
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const displayRef = useRef<HTMLCanvasElement | null>(null)

  const style = BG_PRESETS[styleIdx]

  useEffect(() => {
    const s = splitIntoSlides(content)
    s.forEach((sl, i) => { sl._idx = i })
    setSlides(s)
    setCurIdx(0)
  }, [content])

  const drawAll = useCallback(() => {
    slides.forEach((slide, i) => {
      const canvas = canvasRefs.current[i]
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, CW, CH)
      style.paint(ctx, CW, CH)
      drawRednoteSlide(ctx, slide, style)
    })
    showSlide(curIdx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, style])

  useEffect(() => {
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
          width={CW}
          height={CH}
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

      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[.07em] text-text3 mb-2">Background</div>
        <div className="flex flex-wrap gap-1.5">
          {BG_PRESETS.map((bg, i) => (
            <button
              key={bg.id}
              onClick={() => setStyleIdx(i)}
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

      <div className="fixed -left-[9999px] top-0 invisible pointer-events-none">
        {slides.map((_, i) => (
          <canvas
            key={`${i}-${styleIdx}`}
            ref={el => { canvasRefs.current[i] = el }}
            width={CW}
            height={CH}
          />
        ))}
      </div>
    </div>
  )
}
