import { useDemo } from '../../contexts/DemoContext'

const TILE = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">' +
    '<text x="160" y="100" text-anchor="middle" transform="rotate(-24 160 100)" ' +
    'font-family="sans-serif" font-size="20" font-weight="700" fill="#ffffff">SAMPLE DATA</text></svg>'
)

// Marks every panel while the demo is open. It takes no clicks and is hidden
// from screen readers, which hear the demo banner instead.
export default function DemoWatermark() {
  const { isDemoMode } = useDemo()
  if (!isDemoMode) return null
  return (
    <div
      aria-hidden="true"
      data-testid="demo-watermark"
      className="pointer-events-none fixed inset-0 z-30"
      style={{ backgroundImage: `url("data:image/svg+xml,${TILE}")`, opacity: 0.07 }}
    />
  )
}
