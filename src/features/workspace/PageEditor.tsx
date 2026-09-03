import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { normalizeNoteContent } from '../../lib/richText'

interface Props {
  value: string
  readOnly: boolean
  placeholder?: string
  onChange: (html: string) => void
  onBlur: () => void
}

/**
 * The rich-text editor behind a Notes page. Separate from the task panel's
 * NotesEditor, which is built around the AI rewrite toolbar.
 */
export function PageEditor({ value, readOnly, placeholder, onChange, onBlur }: Props) {
  const editor = useEditor({
    // Link ships in StarterKit but there's no link button here — leaving it
    // off keeps javascript: URLs out of stored content.
    extensions: [
      StarterKit.configure({ link: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: normalizeNoteContent(value),
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    onBlur: () => onBlur(),
  })

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  // Pull in content the parent replaced wholesale (a different page opened)
  // without clobbering in-progress typing.
  useEffect(() => {
    if (!editor) return
    const incoming = normalizeNoteContent(value)
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [value, editor])

  return <EditorContent className="page-editor" editor={editor} />
}

export default PageEditor
