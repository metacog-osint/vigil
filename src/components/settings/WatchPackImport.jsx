import { useMemo, useState } from 'react'
import { alertRules, watchlists, threatActors } from '../../lib/supabase'
import { importPack, planImport } from '../../lib/watchPacks'

/** The stock packs in catalog/packs/, bundled at build time, by name. */
const STOCK_PACKS = Object.values(
  import.meta.glob('/catalog/packs/*.json', { eager: true, import: 'default' })
).sort((a, b) => a.name.localeCompare(b.name))

/** A file's text; FileReader where Blob.text() is missing (older browsers, jsdom). */
function readText(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function SkippedList({ skipped, title }) {
  if (!skipped.length) return null
  return (
    <div data-testid="pack-skipped">
      <h4 className="text-sm font-medium text-yellow-400 mb-1">{title}</h4>
      <ul className="text-xs text-gray-400 space-y-0.5 list-disc pl-5">
        {skipped.map((s, i) => (
          <li key={`${s.item}-${i}`}>
            <span className="text-gray-300">{s.item}</span>: {s.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Import a watch pack: a stock pack or a pack file. Shows what will be created
 * and what will be left out before anything is written, then what was.
 */
export default function WatchPackImport({ userId, onClose, onImported, api }) {
  const [pack, setPack] = useState(null)
  const [label, setLabel] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const plan = useMemo(() => (pack ? planImport(pack) : null), [pack])

  function choose(next, name) {
    setPack(next)
    setLabel(name)
    setFileError(null)
    setResult(null)
  }

  async function readFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      choose(JSON.parse(await readText(file)), file.name)
    } catch {
      setPack(null)
      setFileError(`${file.name} is not valid JSON.`)
    }
  }

  async function runImport() {
    if (!plan) return
    setImporting(true)
    try {
      // The query objects are read here, not at load, so a page that never imports needs none.
      const queries = api || { alertRules, watchlists, threatActors }
      const outcome = await importPack(plan, {
        userId,
        api: queries,
        packLabel: plan.name || label,
      })
      setResult(outcome)
      onImported?.(outcome)
    } finally {
      setImporting(false)
    }
  }

  const nothingToImport = plan && plan.rules.length === 0 && plan.watch.length === 0

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-pack-title"
    >
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4">
        <h3 id="watch-pack-title" className="text-lg font-medium text-white">
          Import a watch pack
        </h3>
        <p className="text-xs text-gray-400">
          A pack adds alert rules and watchlists in one step. Nothing is written until you choose
          Import, and anything Vigil cannot use is listed and left out.
        </p>

        {!result && (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm text-gray-400 mb-1">Stock packs</legend>
              {STOCK_PACKS.map((stock) => (
                <label key={stock.id} className="flex gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="watch-pack"
                    checked={label === stock.name && pack === stock}
                    onChange={() => choose(stock, stock.name)}
                  />
                  <span>
                    <span className="text-white">{stock.name}</span>{' '}
                    <span className="text-gray-500">v{stock.pack_version}</span>
                    <span className="block text-xs text-gray-400">{stock.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div>
              <label className="block text-sm text-gray-400 mb-1" htmlFor="watch-pack-file">
                Or a pack file (.json)
              </label>
              <input
                id="watch-pack-file"
                type="file"
                accept="application/json,.json"
                onChange={readFile}
                className="text-sm text-gray-300"
              />
              {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
            </div>

            {plan && (
              <div className="space-y-3 border-t border-gray-800 pt-3" data-testid="pack-plan">
                <div>
                  <h4 className="text-sm font-medium text-white mb-1">Will be created</h4>
                  {nothingToImport ? (
                    <p className="text-xs text-gray-400">Nothing in this pack can be imported.</p>
                  ) : (
                    <ul className="text-xs text-gray-300 space-y-0.5 list-disc pl-5">
                      {plan.rules.map((rule) => (
                        <li key={rule.ruleName}>Alert rule: {rule.ruleName}</li>
                      ))}
                      {plan.watch.map((list) => (
                        <li key={list.name}>
                          Watchlist: {list.name} ({list.entities.length}{' '}
                          {list.entities.length === 1 ? 'entry' : 'entries'})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <SkippedList skipped={plan.skipped} title="Will be left out" />
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-3" data-testid="pack-result">
            <p className="text-sm text-gray-300">
              Created {result.created.rules.length} alert{' '}
              {result.created.rules.length === 1 ? 'rule' : 'rules'} and{' '}
              {result.created.watchlists.length}{' '}
              {result.created.watchlists.length === 1 ? 'watchlist' : 'watchlists'}.
            </p>
            <SkippedList skipped={result.skipped} title="Left out" />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={runImport}
              disabled={!plan || nothingToImport || importing}
              className="cyber-button text-sm disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
