/**
 * RichTextEditor
 * A Tiptap-based WYSIWYG editor with a toolbar for bold, italic, underline,
 * strikethrough, bullet lists, ordered lists, text alignment, font family,
 * and text colour.
 */
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const FONT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'ui-monospace, monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
]

const COLOR_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Gray', value: '#6b7280' },
]

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'hover:bg-muted flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
        active && 'bg-muted text-foreground',
        !active && 'text-muted-foreground',
        disabled && 'pointer-events-none opacity-40'
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate({ editor }) {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  if (!editor) return null

  const currentFont = editor.getAttributes('textStyle').fontFamily as
    | string
    | undefined

  const currentColor = editor.getAttributes('textStyle').color as
    | string
    | undefined

  return (
    <div
      className={cn(
        'border-input rounded-md border bg-transparent shadow-xs',
        disabled && 'pointer-events-none opacity-60',
        className
      )}
    >
      {/* Toolbar */}
      <div className='border-border flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5'>
        {/* Bold / Italic / Underline / Strike */}
        <ToolbarButton
          title='Bold'
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Italic'
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Underline'
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Strikethrough'
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className='h-3.5 w-3.5' />
        </ToolbarButton>

        <div className='bg-border mx-1 h-4 w-px' />

        {/* Lists */}
        <ToolbarButton
          title='Bullet list'
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Ordered list'
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className='h-3.5 w-3.5' />
        </ToolbarButton>

        <div className='bg-border mx-1 h-4 w-px' />

        {/* Alignment */}
        <ToolbarButton
          title='Align left'
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Align center'
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className='h-3.5 w-3.5' />
        </ToolbarButton>
        <ToolbarButton
          title='Align right'
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className='h-3.5 w-3.5' />
        </ToolbarButton>

        <div className='bg-border mx-1 h-4 w-px' />

        {/* Font family */}
        <select
          title='Font family'
          value={currentFont ?? ''}
          onChange={(e) => {
            const font = e.target.value
            if (font) {
              editor.chain().focus().setFontFamily(font).run()
            } else {
              editor.chain().focus().unsetFontFamily().run()
            }
          }}
          className='text-muted-foreground hover:bg-muted h-7 rounded border-none bg-transparent px-1 text-xs outline-none'
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Text colour */}
        <div className='relative flex items-center'>
          <select
            title='Text colour'
            value={currentColor ?? ''}
            onChange={(e) => {
              const color = e.target.value
              if (color) {
                editor.chain().focus().setColor(color).run()
              } else {
                editor.chain().focus().unsetColor().run()
              }
            }}
            className='text-muted-foreground hover:bg-muted h-7 rounded border-none bg-transparent px-1 text-xs outline-none'
          >
            {COLOR_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {currentColor && (
            <span
              className='pointer-events-none absolute right-5 h-2.5 w-2.5 rounded-full border border-black/10'
              style={{ backgroundColor: currentColor }}
            />
          )}
        </div>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground max-w-none px-3 py-2 text-sm focus-within:outline-none [&_.tiptap]:min-h-[80px] [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]'
        )}
      />
    </div>
  )
}
