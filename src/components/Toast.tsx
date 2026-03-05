'use client'

import { useEffect, useState, useCallback } from 'react'

let showToastGlobal: (msg: string) => void = () => {}

export function toast(msg: string) {
  showToastGlobal(msg)
}

export default function ToastContainer() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  const show = useCallback((msg: string) => {
    setMessage(msg)
    setVisible(true)
    setTimeout(() => setVisible(false), 2500)
  }, [])

  useEffect(() => {
    showToastGlobal = show
  }, [show])

  return (
    <div
      className={`fixed bottom-[22px] left-1/2 bg-text text-bg py-[9px] px-5 rounded-full text-[13px] font-medium shadow-[0_4px_18px_rgba(0,0,0,.14)] whitespace-nowrap z-[999] transition-all duration-300 ${
        visible
          ? 'opacity-100 -translate-x-1/2 translate-y-0'
          : 'opacity-0 -translate-x-1/2 translate-y-[60px]'
      }`}
    >
      {message}
    </div>
  )
}
