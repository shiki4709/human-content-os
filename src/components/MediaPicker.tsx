'use client'

import { useEffect, useRef, useState } from 'react'

interface ExtractedImage {
  url: string
  source: 'og' | 'twitter' | 'article'
  alt?: string
}

interface MediaPickerProps {
  sourceUrl: string
  statText?: string
  selectedMedia: string | null
  onSelect: (url: string | null) => void
}

export default function MediaPicker({ sourceUrl, statText, selectedMedia, onSelect }: MediaPickerProps) {
  const [images, setImages] = useState<ExtractedImage[]>([])
  const [statCardUrl, setStatCardUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch OG images
  useEffect(() => {
    if (!sourceUrl) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetch('/api/extract-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.images) setImages(data.images)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sourceUrl])

  // Generate stat card preview
  useEffect(() => {
    if (!statText) return

    // Call POST endpoint to generate the stat card PNG and get a blob URL for preview
    fetch('/api/generate-stat-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: statText, style: 'dark' }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        setStatCardUrl(url)
      })
      .catch(() => {})

    return () => {
      if (statCardUrl) URL.revokeObjectURL(statCardUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statText])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) onSelect(dataUrl)
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleThumbClick(url: string) {
    onSelect(selectedMedia === url ? null : url)
  }

  const thumbClass = (url: string) =>
    [
      'w-20 h-12 rounded-lg border object-cover cursor-pointer flex-shrink-0 transition-all duration-150',
      selectedMedia === url
        ? 'ring-2 ring-accent border-accent'
        : 'border-border hover:border-border2',
    ].join(' ')

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Loading placeholder */}
      {loading && (
        <div className="w-20 h-12 rounded-lg border border-border bg-bg3 animate-pulse flex-shrink-0" />
      )}

      {/* OG / article images */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!loading &&
        images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.url}
            src={img.url}
            alt={img.alt ?? img.source}
            className={thumbClass(img.url)}
            onClick={() => handleThumbClick(img.url)}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ))}

      {/* Stat card thumbnail */}
      {statCardUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={statCardUrl}
          alt="Stat card"
          className={thumbClass(statCardUrl)}
          onClick={() => handleThumbClick(statCardUrl)}
        />
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-20 h-12 rounded-lg border border-dashed border-border2 bg-bg hover:bg-bg3 flex items-center justify-center flex-shrink-0 transition-colors duration-150 cursor-pointer"
        title="Upload image"
      >
        <span className="text-[10px] text-text3 font-medium leading-tight text-center">
          + Upload
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
