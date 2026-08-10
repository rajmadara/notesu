// Notes were plain text before rich-text editing landed, so stored content can
// be either. These helpers let old notes open cleanly in the editor and let the
// AI actions (which are plain-text in / plain-text out) round-trip safely.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`)
    .join('')
}

/**
 * Extracts readable text from stored note content. Uses DOMParser rather than
 * innerHTML — parsing this way never executes scripts or loads resources.
 */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.children)
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Content saved before rich text existed has no tags — upgrade it to paragraphs. */
export function normalizeNoteContent(content: string): string {
  if (!content.trim()) return ''
  return /<[a-z][\s\S]*>/i.test(content) ? content : plainTextToHtml(content)
}
