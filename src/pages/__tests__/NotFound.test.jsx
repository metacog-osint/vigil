/**
 * The not-found page (ideas#300).
 *
 * An address that matches no route says so, sets its own title, and links
 * home and to the hub; a visitor who has not signed in also gets sign-in.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from '../NotFound'

function renderAt(ui) {
  return render(<MemoryRouter initialEntries={['/no-such-page']}>{ui}</MemoryRouter>)
}

describe('NotFound', () => {
  it('says the page is missing and links home, sign-in and the hub', () => {
    renderAt(<NotFound />)
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vigil home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth')
    expect(screen.getByRole('link', { name: 'The Intelligence Company' })).toHaveAttribute(
      'href',
      'https://theintelligence.company/'
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(document.title).toBe('Not found | Vigil')
  })

  it('signed in, renders no second <main> and no sign-in link', () => {
    renderAt(<NotFound signedIn />)
    expect(screen.queryByRole('main')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('puts the earlier title back when it leaves', () => {
    document.title = 'Before'
    const { unmount } = renderAt(<NotFound />)
    unmount()
    expect(document.title).toBe('Before')
  })
})
