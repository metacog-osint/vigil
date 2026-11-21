import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import FoldWindow from '../FoldWindow'

describe('FoldWindow', () => {
  it('keeps the marked element alone in its own div, inside an outer div for the button', () => {
    const { container } = render(
      <FoldWindow className="overflow-x-auto" outerClassName="flex-1">
        <table data-tic-fold="">
          <tbody>
            <tr>
              <td>row</td>
            </tr>
          </tbody>
        </table>
      </FoldWindow>
    )
    const table = container.querySelector('[data-tic-fold]')
    const box = table.parentElement
    const outer = box.parentElement
    expect(box.tagName).toBe('DIV')
    expect(box.children).toHaveLength(1)
    expect(box.className).toBe('overflow-x-auto')
    expect(outer.className).toBe('flex-1')
    expect(outer.children).toHaveLength(1)
  })
})
