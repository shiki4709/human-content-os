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
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch OG images
  useEffect(() => {
    if (!sourceUrl) { setLoading(false); return }
    setLoading(true)
    fetch('/api/extract-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.images?.length > 0) {
          setImages(data.images)
          // Auto-select the first image (OG image is usually best)
          if (!selectedMedia) onSelect(data.images[0].url)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) onSelect(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // No images found and not loading — don't show anything
  if (!loading && images.length === 0 && !statText) return null

  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="w-14 h-9 rounded-md bg-bg3 animate-pulse flex-shrink-0" />
      ) : selectedMedia && !showAll ? (
        /* Compact: show selected image + change button */
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedMedia}
            alt="Selected media"
            className="w-14 h-9 rounded-md border border-accent object-cover flex-shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <button
            onClick={() => setShowAll(true)}
            className="text-[11px] text-text3 hover:text-text transition-colors"
          >
            Change
          </button>
          <button
            onClick={() => { onSelect(null); setShowAll(false) }}
            className="text-[11px] text-text3 hover:text-red transition-colors"
          >
            Remove
          </button>
        </>
      ) : (
        /* Expanded: show all options */
        <>
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.url}
              src={img.url}
              alt={img.alt ?? img.source}
              className={[
                'w-14 h-9 rounded-md border object-cover cursor-pointer flex-shrink-0 transition-all duration-150',
                selectedMedia === img.url
                  ? 'ring-2 ring-accent border-accent'
                  : 'border-border hover:border-border2',
              ].join(' ')}
              onClick={() => { onSelect(img.url); setShowAll(false) }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-9 rounded-md border border-dashed border-border2 bg-bg hover:bg-bg3 flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text3">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="text-[11px] text-text3 hover:text-text"
            >
              Done
            </button>
          )}
        </>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
