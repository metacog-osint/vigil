/**
 * The house window for a long table or list (public/tic-fold.js): about ten rows that scroll, with "Show all N".
 *
 * Mark the one child with data-tic-fold. tic-fold makes the inner div the window and puts its button after it, in
 * the outer div. So it never moves a node React owns, and the button leaves the page when React removes the list.
 * Keep className constant: tic-fold adds its own classes to that div, and a changed prop would overwrite them.
 */
export default function FoldWindow({ className, outerClassName, children }) {
  return (
    <div className={outerClassName}>
      <div className={className}>{children}</div>
    </div>
  )
}
