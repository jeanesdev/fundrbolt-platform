/**
 * RichTextEditor Component
 * Markdown-based rich text editor with sanitization for XSS prevention
 */

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { renderMarkdownToSafeHtml } from '@fundrbolt/shared/utils'
import { Bold, Italic, Link, List, ListOrdered } from 'lucide-react'
import { useState } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
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
      const newCursorPos = start + before.length + (selectedText ? selectedText.length : 4)
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const previewHtml = renderMarkdownToSafeHtml(value)
  const hasPreviewContent = previewHtml.trim().length > 0

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Markdown toolbar (only show in edit mode) */}
        {activeTab === 'edit' && (
          <div className="flex gap-1 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('**', '**')}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('*', '*')}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('[', '](url)')}
              title="Link"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('* ', '')}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertMarkdown('1. ', '')}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <TabsContent value="edit" className="mt-0">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[200px] w-full font-mono text-sm resize-y"
          rows={10}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Supports Markdown formatting: **bold**, *italic*, [link](url), # headings, * lists
        </p>
      </TabsContent>

      <TabsContent value="preview" className="mt-0">
        <div
          className="min-h-[200px] w-full p-4 rounded-md border bg-muted/50 overflow-auto"
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
