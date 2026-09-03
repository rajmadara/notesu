import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { Page } from '../../../lib/types'
import { setPageContent } from '../../../lib/workspace'

// TipTap is ~390kB — kept out of the main bundle so the app stays fast to
// load; it only arrives once someone opens a Notes page.
const PageEditor = lazy(() => import('../PageEditor'))

interface Props {
  page: Page
  readOnly: boolean
  onSaved: (content: string) => void
}

export function NotesPage({ page, readOnly, onSaved }: Props) {
  const [content, setContent] = useState(page.content)
  const dirty = useRef(false)

  // Deliberately keyed on page.id only — reset the draft when a different
  // page opens, not every time this page's own content is echoed back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setContent(page.content)
    dirty.current = false
  }, [page.id])

  async function save() {
    if (!dirty.current || readOnly) return
    dirty.current = false
    await setPageContent(page.id, content).catch(() => null)
    onSaved(content)
  }

  return (
    <div className="page-notes">
      <Suspense fallback={<p className="empty-state">Loading editor...</p>}>
        <PageEditor
          value={content}
          readOnly={readOnly}
          placeholder={`Notes for ${page.name}...`}
          onChange={(html) => {
            dirty.current = true
            setContent(html)
          }}
          onBlur={save}
        />
      </Suspense>
    </div>
  )
}
