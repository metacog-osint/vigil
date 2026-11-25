/**
 * Not found (ideas#300)
 *
 * Shown for an address that matches no route, in place of the silent jump
 * to the home page, so a broken or old link reads as broken. Vigil routes in
 * the browser, so Vercel still answers 200; the page and its title say 404.
 * `signedIn` false adds the sign-in link, since signed-in pages are not
 * routed for a visitor who has not signed in.
 */

import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function NotFound({ signedIn = false }) {
  useEffect(() => {
    const before = document.title
    document.title = 'Not found | Vigil'
    return () => {
      document.title = before
    }
  }, [])

  const body = (
    <>
      <h1 className="text-3xl font-bold text-white mb-4">Not found</h1>
      <p className="text-gray-300 mb-6">
        {signedIn
          ? "That page doesn't exist. It may have moved when the site grew."
          : "That page doesn't exist, or it opens only after you sign in."}
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-2">
        <Link to="/" className="text-cyber-accent underline underline-offset-2">
          Vigil home
        </Link>
        {!signedIn && (
          <Link to="/auth" className="text-cyber-accent underline underline-offset-2">
            Sign in
          </Link>
        )}
        <a
          href="https://theintelligence.company/"
          className="text-cyber-accent underline underline-offset-2"
        >
          The Intelligence Company
        </a>
      </p>
    </>
  )

  // Signed in, the page renders inside the app's own <main>.
  if (signedIn) return <section className="max-w-2xl py-8">{body}</section>

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link to="/" className="text-2xl font-bold text-cyber-accent">
            VIGIL
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-6 py-12">
        {body}
      </main>
    </div>
  )
}
