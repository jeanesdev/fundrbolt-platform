/**
 * RichTextEditor Component
 * Markdown-based rich text editor with sanitization for XSS prevention
 */
import { useState } from 'react'
import { renderMarkdownToSafeHtml } from '@fundrbolt/shared/utils'
import { Bold, Italic, Link, List, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Helper to insert markdown syntax
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    const newText =
      value.substring(0, start) +
      before +
      (selectedText || 'text') +
      after +
      value.substring(end)

    onChange(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newCursorPos =
        start + before.length + (selectedText ? selectedText.length : 4)
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const previewHtml = renderMarkdownToSafeHtml(value)
  const hasPreviewContent = previewHtml.trim().length > 0

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}
      className='w-full'
    >
      <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <TabsList>
          <TabsTrigger value='edit'>Edit</TabsTrigger>
          <TabsTrigger value='preview'>Preview</TabsTrigger>
        </TabsList>

        {/* Markdown toolbar (only show in edit mode) */}
        {activeTab === 'edit' && (
          <div className='flex flex-wrap gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => insertMarkdown('**', '**')}
              title='Bold'
            >
              <Bold className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => insertMarkdown('*', '*')}
              title='Italic'
            >
              <Italic className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => insertMarkdown('[', '](url)')}
              title='Link'
            >
              <Link className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => insertMarkdown('* ', '')}
              title='Bullet List'
            >
              <List className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => insertMarkdown('1. ', '')}
              title='Numbered List'
            >
              <ListOrdered className='h-4 w-4' />
            </Button>
          </div>
        )}
      </div>

      <TabsContent value='edit' className='mt-0'>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className='min-h-[200px] w-full resize-y font-mono text-sm'
          rows={10}
        />
        <p className='text-muted-foreground mt-2 text-xs'>
          Supports Markdown formatting: **bold**, *italic*, [link](url), #
          headings, * lists
        </p>
      </TabsContent>

      <TabsContent value='preview' className='mt-0'>
        <div
          className='bg-muted/50 min-h-[200px] w-full overflow-auto rounded-md border p-4'
          dangerouslySetInnerHTML={{
            __html: hasPreviewContent
              ? previewHtml
              : '<p class="text-muted-foreground">No content to preview</p>',
          }}
        />
      </TabsContent>
    </Tabs>
  )
}
