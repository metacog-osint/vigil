import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { titleForPath } from '../lib/routeTitles'

/**
 * Sets `document.title` from the current route.
 * A path with no entry keeps whatever title is there, so the Not found page's
 * own title stands.
 */
export function useRouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const title = titleForPath(pathname)
    if (title) document.title = title
  }, [pathname])
}

export default useRouteTitle
