# Contributing to Vigil

Thank you for your interest in contributing to Vigil! This document provides guidelines for contributing to the project.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Supabase account (for database)
- Firebase account (for auth)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/your-org/vigil.git
cd vigil

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Fill in your environment variables
# See .env.example for required keys

# Start development server
npm run dev
```

### Environment Variables

Required variables (see `.env.example`):

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

---

## Development Workflow

### Branch Strategy

```
main              # Production-ready code
├── develop       # Integration branch (optional)
└── feature/*     # Feature branches
└── fix/*         # Bug fix branches
└── refactor/*    # Refactoring branches
```

### Creating a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### Commit Messages

Follow conventional commits:

```
feat: add new threat actor correlation panel
fix: resolve search query parsing for IPv6
refactor: extract constants to shared module
docs: update API documentation
test: add unit tests for query parser
chore: update dependencies
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Run linting and tests locally
4. Push your branch and create a PR
5. Fill out the PR template
6. Request review from maintainers
7. Address review feedback
8. Squash and merge when approved

---

## Code Standards

### JavaScript/React

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components focused (single responsibility)
- Use named exports for components

```javascript
// Good
export function ThreatActorCard({ actor }) {
  const { name, type, trend } = actor
  return (...)
}

// Avoid
export default function({ data }) {
  return (...)
}
```

### File Organization

```
src/components/ComponentName.jsx    # Component file
src/components/ComponentName.test.jsx  # Co-located test
src/hooks/useHookName.js            # Custom hooks
src/lib/moduleName.js               # Business logic
```

### Styling

- Use Tailwind CSS utility classes
- Follow existing cyber-themed patterns
- Use CSS variables for colors when possible
- Prefer existing component classes (`.cyber-card`, `.cyber-button`)

```jsx
// Good - using existing patterns
<div className="cyber-card">
  <h3 className="text-white font-semibold">Title</h3>
</div>

// Avoid - custom inline styles
<div style={{ background: '#1a1a1a', border: '1px solid #333' }}>
```

### Constants

- Extract magic strings/numbers to constants
- Use the `src/lib/constants/` directory
- Export from barrel file

```javascript
// src/lib/constants/sectors.js
export const SECTORS = ['healthcare', 'finance', ...]

// Usage
import { SECTORS } from '../lib/constants'
```

---

## Testing

### Running Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Lint check
npm run lint
```

### Writing Tests

- Co-locate tests with source files
- Use descriptive test names
- Test behavior, not implementation

```javascript
// src/lib/__tests__/queryParser.test.js
import { parseQuery } from '../queryParser'

describe('parseQuery', () => {
  it('should detect IP addresses', () => {
    const result = parseQuery('8.8.8.8')
    expect(result.type).toBe('ip')
  })

  it('should handle CVE format', () => {
    const result = parseQuery('CVE-2024-1234')
    expect(result.type).toBe('cve')
  })
})
```

---

## Adding Data Sources

### Creating an Ingestion Script

1. Create script in `scripts/ingest-{source}.mjs`
2. Use shared utilities from `scripts/lib/`
3. Log to `sync_log` table
4. Handle errors gracefully
5. Add to GitHub Actions workflow

```javascript
// scripts/ingest-newsource.mjs
import { createClient } from '@supabase/supabase-js'
import { fetchJSON } from './lib/http.mjs'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function ingest() {
  console.log('Starting ingestion...')

  try {
    const data = await fetchJSON('https://api.source.com/feed')

    // Transform and upsert
    const { error } = await supabase
      .from('table_name')
      .upsert(transformedData)

    if (error) throw error

    // Log success
    await supabase.from('sync_log').insert({
      source: 'newsource',
      status: 'success',
      records_processed: data.length
    })

    console.log(`Processed ${data.length} records`)
  } catch (error) {
    console.error('Ingestion failed:', error)

    await supabase.from('sync_log').insert({
      source: 'newsource',
      status: 'error',
      error_message: error.message
    })

    process.exit(1)
  }
}

ingest()
```

### Adding to Package.json

```json
{
  "scripts": {
    "ingest:newsource": "node scripts/ingest-newsource.mjs"
  }
}
```

---

## Documentation

### When to Document

- New features or components
- API changes
- Database schema changes
- Configuration changes

### Where to Document

| Change | Document |
|--------|----------|
| New feature | FEATURES.md, CHANGELOG.md |
| Data source | DATA_SOURCES.md |
| Schema change | DATABASE.md |
| Architecture decision | docs/ARCHITECTURE.md |
| API change | src/pages/ApiDocs.jsx |

---

## Getting Help

- **Questions:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue
- **Security:** Email security@theintelligence.company

---

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions professional

---

*Thank you for contributing to Vigil!*
