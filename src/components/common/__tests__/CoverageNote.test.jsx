import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CoverageNote from '../CoverageNote'

describe('CoverageNote', () => {
  it('states how much of the data is shown', () => {
    render(<CoverageNote covered={11317} total={39494} />)

    expect(screen.getByText(/11,317 of 39,494 incidents \(29%\)/)).toBeInTheDocument()
    expect(screen.getByText(/remaining 71% are not shown/)).toBeInTheDocument()
  })

  // The case that matters most: a map with nothing on it should say why, not
  // leave the reader assuming there were no attacks.
  it('explains an empty view and when the data stopped', () => {
    render(<CoverageNote covered={0} total={974} lastCovered="2026-05-29" />)

    expect(screen.getByText(/No country recorded for any of the 974 incidents/)).toBeInTheDocument()
    expect(screen.getByText(/2026-05-29/)).toBeInTheDocument()
  })

  it('distinguishes an empty period from missing attribution', () => {
    render(<CoverageNote covered={0} total={0} />)

    expect(screen.getByText('No incidents in this period.')).toBeInTheDocument()
  })

  it('renders nothing without a total to report against', () => {
    const { container } = render(<CoverageNote covered={5} total={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
