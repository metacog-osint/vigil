/**
 * AlertRuleBuilder Component
 * Visual builder for complex alert rules with AND/OR conditions
 */

import { useState, useCallback } from 'react'
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// Available fields for conditions
const FIELD_OPTIONS = {
  actors: [
    { value: 'name', label: 'Actor Name', type: 'text' },
    { value: 'trend_status', label: 'Trend Status', type: 'select', options: ['ESCALATING', 'STABLE', 'DECLINING'] },
    { value: 'incidents_7d', label: 'Incidents (7d)', type: 'number' },
    { value: 'incident_velocity', label: 'Incident Velocity', type: 'number' },
    { value: 'target_sectors', label: 'Target Sector', type: 'text' },
    { value: 'target_countries', label: 'Target Country', type: 'text' },
  ],
  vulnerabilities: [
    { value: 'cve_id', label: 'CVE ID', type: 'text' },
    { value: 'cvss_score', label: 'CVSS Score', type: 'number' },
    { value: 'epss_score', label: 'EPSS Score', type: 'number' },
    { value: 'kev_date', label: 'In KEV', type: 'boolean' },
    { value: 'exploit_maturity', label: 'Exploit Maturity', type: 'select', options: ['not_defined', 'unproven', 'poc', 'functional', 'high', 'weaponized'] },
    { value: 'vendor', label: 'Vendor', type: 'text' },
  ],
  incidents: [
    { value: 'victim_name', label: 'Victim Name', type: 'text' },
    { value: 'victim_sector', label: 'Victim Sector', type: 'text' },
    { value: 'victim_country', label: 'Victim Country', type: 'text' },
    { value: 'threat_actor.name', label: 'Actor Name', type: 'text' },
    { value: 'threat_actor.trend_status', label: 'Actor Trend', type: 'select', options: ['ESCALATING', 'STABLE', 'DECLINING'] },
  ],
  iocs: [
    { value: 'type', label: 'IOC Type', type: 'select', options: ['ip', 'domain', 'url', 'hash', 'email'] },
    { value: 'value', label: 'IOC Value', type: 'text' },
    { value: 'source', label: 'Source', type: 'text' },
    { value: 'confidence', label: 'Confidence', type: 'number' },
    { value: 'malware_family', label: 'Malware Family', type: 'text' },
  ],
}

// Operators for different field types
const OPERATORS = {
  text: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_null', label: 'is empty' },
    { value: 'is_not_null', label: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less or equal' },
  ],
  select: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
  ],
  boolean: [
    { value: 'eq', label: 'is' },
  ],
}

// Default empty condition
const createCondition = () => ({
  id: crypto.randomUUID(),
  type: 'field',
  field: '',
  operator: 'eq',
  value: '',
  values: [],
})

// Default empty group
const createGroup = (operator = 'AND') => ({
  id: crypto.randomUUID(),
  type: 'group',
  operator,
  conditions: [createCondition()],
})

// Condition Row Component
function ConditionRow({
  condition,
  entityType,
  onUpdate,
  onRemove,
  canRemove,
  depth: _depth = 0
}) {
  const fields = FIELD_OPTIONS[entityType] || []
  const selectedField = fields.find(f => f.value === condition.field)
  const operators = selectedField ? OPERATORS[selectedField.type] : OPERATORS.text
  const needsValue = !['is_null', 'is_not_null'].includes(condition.operator)
  const needsMultiValue = ['in', 'not_in'].includes(condition.operator)

  const handleFieldChange = (field) => {
    // Field lookup for future validation
    const _newField = fields.find(f => f.value === field)
    onUpdate({
      ...condition,
      field,
      operator: 'eq',
      value: '',
      values: [],
    })
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-700">
      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="cyber-input text-sm flex-1 min-w-[140px]"
      >
        <option value="">Select field...</option>
        {fields.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ ...condition, operator: e.target.value })}
        className="cyber-input text-sm w-32"
        disabled={!condition.field}
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input */}
      {needsValue && selectedField && (
        <>
          {selectedField.type === 'select' && !needsMultiValue ? (
            <select
              value={condition.value}
              onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
              className="cyber-input text-sm flex-1"
            >
              <option value="">Select...</option>
              {selectedField.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : selectedField.type === 'boolean' ? (
            <select
              value={condition.value}
              onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
              className="cyber-input text-sm w-24"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : needsMultiValue ? (
            <input
              type="text"
              value={condition.values?.join(', ') || ''}
              onChange={(e) => onUpdate({
                ...condition,
                values: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
              })}
              placeholder="value1, value2, ..."
              className="cyber-input text-sm flex-1"
            />
          ) : (
            <input
              type={selectedField.type === 'number' ? 'number' : 'text'}
              value={condition.value}
              onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
              placeholder="Enter value..."
              className="cyber-input text-sm flex-1"
              step={selectedField.type === 'number' ? '0.01' : undefined}
            />
          )}
        </>
      )}

      {/* Remove button */}
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          title="Remove condition"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Condition Group Component
function ConditionGroup({
  group,
  entityType,
  onUpdate,
  onRemove,
  canRemove,
  depth = 0,
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleOperatorChange = (operator) => {
    onUpdate({ ...group, operator })
  }

  const handleConditionUpdate = (index, updated) => {
    const newConditions = [...group.conditions]
    newConditions[index] = updated
    onUpdate({ ...group, conditions: newConditions })
  }

  const handleConditionRemove = (index) => {
    const newConditions = group.conditions.filter((_, i) => i !== index)
    onUpdate({ ...group, conditions: newConditions })
  }

  const addCondition = () => {
    onUpdate({
      ...group,
      conditions: [...group.conditions, createCondition()],
    })
  }

  const addGroup = () => {
    onUpdate({
      ...group,
      conditions: [...group.conditions, createGroup(group.operator === 'AND' ? 'OR' : 'AND')],
    })
  }

  const operatorColor = group.operator === 'AND'
    ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
    : group.operator === 'OR'
    ? 'text-purple-400 border-purple-500/50 bg-purple-500/10'
    : 'text-red-400 border-red-500/50 bg-red-500/10'

  return (
    <div className={`border border-gray-700 rounded-lg ${depth > 0 ? 'ml-4' : ''}`}>
      {/* Group header */}
      <div className="flex items-center gap-2 p-2 bg-gray-800/30 border-b border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </button>

        <span className="text-sm text-gray-400">Match</span>

        <select
          value={group.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className={`px-2 py-1 text-sm font-medium rounded border ${operatorColor}`}
        >
          <option value="AND">ALL (AND)</option>
          <option value="OR">ANY (OR)</option>
          <option value="NOT">NONE (NOT)</option>
        </select>

        <span className="text-sm text-gray-400">of the following:</span>

        <div className="flex-1" />

        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Remove group"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Conditions */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {group.conditions.map((condition, index) => (
            <div key={condition.id}>
              {condition.type === 'group' ? (
                <ConditionGroup
                  group={condition}
                  entityType={entityType}
                  onUpdate={(updated) => handleConditionUpdate(index, updated)}
                  onRemove={() => handleConditionRemove(index)}
                  canRemove={group.conditions.length > 1}
                  depth={depth + 1}
                />
              ) : (
                <ConditionRow
                  condition={condition}
                  entityType={entityType}
                  onUpdate={(updated) => handleConditionUpdate(index, updated)}
                  onRemove={() => handleConditionRemove(index)}
                  canRemove={group.conditions.length > 1}
                  depth={depth}
                />
              )}
            </div>
          ))}

          {/* Add buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={addCondition}
              className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              Add Condition
            </button>
            {depth < 2 && (
              <button
                onClick={addGroup}
                className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Add Group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Test Result Component
function TestResult({ result }) {
  if (!result) return null

  return (
    <div className={`p-3 rounded border ${
      result.matches
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {result.matches ? (
          <>
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Conditions Match</span>
          </>
        ) : (
          <>
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Conditions Do Not Match</span>
          </>
        )}
      </div>
      {result.details && (
        <pre className="text-xs text-gray-400 overflow-x-auto">
          {JSON.stringify(result.details, null, 2)}
        </pre>
      )}
    </div>
  )
}

// Main AlertRuleBuilder Component
export default function AlertRuleBuilder({
  entityType = 'actors',
  initialConditions = null,
  onChange,
  onTest,
  showTestPanel = true,
}) {
  const [conditions, setConditions] = useState(
    initialConditions || createGroup('AND')
  )
  const [testData, setTestData] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)

  const handleConditionsChange = useCallback((updated) => {
    setConditions(updated)
    onChange?.(updated)
  }, [onChange])

  const handleTest = async () => {
    if (!testData.trim()) return

    setTestLoading(true)
    setTestResult(null)

    try {
      const entity = JSON.parse(testData)
      const result = onTest
        ? await onTest(conditions, entity)
        : evaluateConditions(conditions, entity)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        matches: false,
        error: error.message,
        details: { parseError: 'Invalid JSON' },
      })
    } finally {
      setTestLoading(false)
    }
  }

  // Simple client-side condition evaluator
  const evaluateConditions = (group, entity) => {
    const results = group.conditions.map(cond => {
      if (cond.type === 'group') {
        return evaluateConditions(cond, entity)
      }

      const value = getNestedValue(entity, cond.field)
      return evaluateCondition(cond, value)
    })

    let matches
    switch (group.operator) {
      case 'AND':
        matches = results.every(r => r.matches)
        break
      case 'OR':
        matches = results.some(r => r.matches)
        break
      case 'NOT':
        matches = !results.some(r => r.matches)
        break
      default:
        matches = false
    }

    return { matches, operator: group.operator, results }
  }

  const getNestedValue = (obj, path) => {
    if (!path) return undefined
    return path.split('.').reduce((curr, key) => curr?.[key], obj)
  }

  const evaluateCondition = (cond, actualValue) => {
    const { operator, value, values } = cond
    let matches = false

    switch (operator) {
      case 'eq':
        matches = String(actualValue) === String(value)
        break
      case 'neq':
        matches = String(actualValue) !== String(value)
        break
      case 'gt':
        matches = Number(actualValue) > Number(value)
        break
      case 'gte':
        matches = Number(actualValue) >= Number(value)
        break
      case 'lt':
        matches = Number(actualValue) < Number(value)
        break
      case 'lte':
        matches = Number(actualValue) <= Number(value)
        break
      case 'contains':
        matches = String(actualValue).toLowerCase().includes(String(value).toLowerCase())
        break
      case 'starts_with':
        matches = String(actualValue).toLowerCase().startsWith(String(value).toLowerCase())
        break
      case 'ends_with':
        matches = String(actualValue).toLowerCase().endsWith(String(value).toLowerCase())
        break
      case 'in':
        matches = values?.includes(String(actualValue))
        break
      case 'not_in':
        matches = !values?.includes(String(actualValue))
        break
      case 'is_null':
        matches = actualValue == null || actualValue === ''
        break
      case 'is_not_null':
        matches = actualValue != null && actualValue !== ''
        break
    }

    return { matches, field: cond.field, operator, expected: value || values, actual: actualValue }
  }

  return (
    <div className="space-y-4">
      {/* Entity type selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400">Entity Type:</label>
        <span className="px-2 py-1 bg-gray-800 rounded text-cyan-400 text-sm font-medium">
          {entityType}
        </span>
      </div>

      {/* Condition builder */}
      <ConditionGroup
        group={conditions}
        entityType={entityType}
        onUpdate={handleConditionsChange}
        onRemove={() => {}}
        canRemove={false}
        depth={0}
      />

      {/* Test panel */}
      {showTestPanel && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <BeakerIcon className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-white">Test Conditions</span>
          </div>

          <div className="space-y-2">
            <textarea
              value={testData}
              onChange={(e) => setTestData(e.target.value)}
              placeholder={`Paste sample ${entityType.slice(0, -1)} JSON to test conditions...`}
              className="cyber-input w-full h-24 text-xs font-mono"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testLoading || !testData.trim()}
                className="cyber-button text-sm"
              >
                {testLoading ? 'Testing...' : 'Run Test'}
              </button>
            </div>

            <TestResult result={testResult} />
          </div>
        </div>
      )}

      {/* JSON preview */}
      <details className="text-xs">
        <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
          View JSON
        </summary>
        <pre className="mt-2 p-2 bg-gray-900 rounded text-gray-400 overflow-x-auto">
          {JSON.stringify(conditions, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export { createCondition, createGroup, FIELD_OPTIONS, OPERATORS }
