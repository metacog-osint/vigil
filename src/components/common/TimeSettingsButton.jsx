import { useEffect, useRef } from 'react'

// The shared Time button (public/tic-time.js). Mounted once; a change reloads the page (see main.jsx).
export default function TimeSettingsButton() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !window.TicTime || el.childElementCount) return
    window.TicTime.mountSettings(el)
  }, [])
  return <span ref={ref} className="tic-time-holder" />
}
