/**
 * Outbound URL guard
 *
 * The server only sends to public https endpoints a user names. This refuses
 * other schemes, credentials in the URL, odd ports, and hosts that are
 * loopback, private, link-local, CGNAT, multicast or reserved, by name or by
 * IP literal. The WHATWG URL parser already turns decimal, octal and hex IPv4
 * forms (http://2130706433/) into dotted quads, so checking the parsed
 * hostname covers them.
 *
 * Limit: the Edge runtime cannot resolve DNS, so a public name that resolves
 * to a private address (DNS rebinding) is not caught here. Callers also send
 * with redirect: 'manual' so a public host cannot bounce the request inward.
 */

const BLOCKED_NAMES = ['localhost', 'localhost.localdomain', 'metadata.google.internal']
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp']
const ALLOWED_PORTS = new Set(['', '443', '8443'])

function parseIPv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null
}

export function isBlockedIPv4([a, b]) {
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0) || // IETF assignments, TEST-NET-1 (192.0.0/24, 192.0.2/24)
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) || // TEST-NET-2
    (a === 203 && b === 0) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  )
}

function isBlockedIPv6(host) {
  const h = host.toLowerCase()
  if (h === '::' || h === '::1') return true
  // IPv4-mapped / -compatible: ::ffff:a.b.c.d or ::ffff:7f00:1 (the parser emits hex)
  const mapped = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h)
  if (mapped) {
    const hi = parseInt(mapped[1], 16)
    const lo = parseInt(mapped[2], 16)
    return isBlockedIPv4([hi >> 8, hi & 255, lo >> 8, lo & 255])
  }
  const dotted = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(h)
  if (dotted) {
    const v4 = parseIPv4(dotted[1])
    return !v4 || isBlockedIPv4(v4)
  }
  const first = parseInt(h.split(':')[0] || '0', 16)
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // multicast
    h.startsWith('64:ff9b:') || // NAT64, maps onto IPv4
    h.startsWith('2001:db8:') // documentation
  )
}

/**
 * @param {string} raw
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function checkOutboundUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) {
    return { ok: false, reason: 'Webhook URL is required' }
  }
  let url
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid webhook URL' }
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Webhook URL must use https' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Webhook URL must not carry a user name or password' }
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: 'Webhook URL must use port 443 or 8443' }
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return { ok: false, reason: 'Invalid webhook URL' }

  if (host.startsWith('[') && host.endsWith(']')) {
    return isBlockedIPv6(host.slice(1, -1))
      ? { ok: false, reason: 'Webhook URL points at a private or reserved address' }
      : { ok: true, url }
  }
  const v4 = parseIPv4(host)
  if (v4) {
    return isBlockedIPv4(v4)
      ? { ok: false, reason: 'Webhook URL points at a private or reserved address' }
      : { ok: true, url }
  }
  if (!host.includes('.') || BLOCKED_NAMES.includes(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'Webhook URL points at a private or internal host' }
  }
  return { ok: true, url }
}
