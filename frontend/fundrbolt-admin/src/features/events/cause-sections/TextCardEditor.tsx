import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface TextCardEditorProps {
  contentHtml: string
  onChange: (value: string) => void
}

export function TextCardEditor({ contentHtml, onChange }: TextCardEditorProps) {
  return (
    <div className='space-y-2'>
      <p className='text-sm font-medium'>Text Content</p>
      <RichTextEditor
        value={contentHtml}
        onChange={onChange}
        placeholder='Share your cause, mission, or impact story...'
      />
    </div>
  )
}
