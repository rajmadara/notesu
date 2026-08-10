import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { normalizeNoteContent } from '../../lib/richText'

export type NoteAction = 'formal' | 'informal' | 'summarize'

const AI_ACTIONS: { value: NoteAction; label: string }[] = [
  { value: 'formal', label: 'Make it formal' },
  { value: 'informal', label: 'Make it casual' },
  { value: 'summarize', label: 'Summarize' },
]

interface Props {
  value: string
  onChange: (html: string) => void
  onBlur: () => void
  aiBusy: NoteAction | null
  canUndo: boolean
  onAiAction: (action: NoteAction) => void
  onUndoAiAction: () => void
}

export function NotesEditor({
  value,
  onChange,
  onBlur,
  aiBusy,
  canUndo,
  onAiAction,
  onUndoAiAction,
}: Props) {
  const [aiOpen, setAiOpen] = useState(false)
  const aiRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    // Link ships in StarterKit but there's no link button in this toolbar —
    // leaving it off keeps javascript: URLs out of stored note content.
    extensions: [
      StarterKit.configure({ link: false }),
      Placeholder.configure({ placeholder: 'Notes for this task...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: normalizeNoteContent(value),
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    onBlur: () => onBlur(),
  })

  // Pull in content the parent replaced wholesale (AI transform, undo, or a
  // different task selected) without clobbering in-progress typing.
  useEffect(() => {
    if (!editor) return
    const incoming = normalizeNoteContent(value)
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!aiOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) setAiOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [aiOpen])

  if (!editor) return null

  function handleAiSelect(action: NoteAction) {
    setAiOpen(false)
    onAiAction(action)
  }

  return (
    <div className="notes-editor">
      <div className="notes-editor__toolbar">
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('bold') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          aria-label="Bold"
        >
          <span className="notes-editor__tool-bold">B</span>
        </button>
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('italic') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          aria-label="Italic"
        >
          <span className="notes-editor__tool-italic">I</span>
        </button>
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('underline') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          aria-label="Underline"
        >
          <span className="notes-editor__tool-underline">U</span>
        </button>
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('strike') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <span className="notes-editor__tool-strike">S</span>
        </button>

        <span className="notes-editor__divider" />

        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('bulletList') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
          aria-label="Bullet list"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('orderedList') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
          aria-label="Numbered list"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="10" y1="6" x2="20" y2="6" />
            <line x1="10" y1="12" x2="20" y2="12" />
            <line x1="10" y1="18" x2="20" y2="18" />
            <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
            <text x="2" y="14.5" fontSize="7" fill="currentColor" stroke="none">2</text>
            <text x="2" y="21" fontSize="7" fill="currentColor" stroke="none">3</text>
          </svg>
        </button>
        <button
          type="button"
          className={`notes-editor__tool${editor.isActive('taskList') ? ' is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Checklist"
          aria-label="Checklist"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 12l3 3 5-6" />
          </svg>
        </button>

        <span className="notes-editor__divider" />

        <button
          type="button"
          className="notes-editor__tool"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear formatting"
          aria-label="Clear formatting"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>

        <div className="notes-editor__ai" ref={aiRef}>
          <button
            type="button"
            className={`notes-editor__tool notes-editor__tool--ai${aiOpen ? ' is-active' : ''}`}
            onClick={() => setAiOpen((v) => !v)}
            disabled={aiBusy !== null}
            aria-expanded={aiOpen}
            title="Rewrite with AI"
          >
            {aiBusy ? 'Working…' : 'AI'}
          </button>

          {aiOpen && (
            <div className="notes-editor__ai-menu">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  className="notes-editor__ai-item"
                  onClick={() => handleAiSelect(action.value)}
                >
                  {action.label}
                </button>
              ))}
              {canUndo && (
                <button
                  type="button"
                  className="notes-editor__ai-item notes-editor__ai-item--undo"
                  onClick={() => {
                    setAiOpen(false)
                    onUndoAiAction()
                  }}
                >
                  Undo last rewrite
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <EditorContent className="notes-editor__content" editor={editor} />
    </div>
  )
}
