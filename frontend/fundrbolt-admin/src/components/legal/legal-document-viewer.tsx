/**
 * LegalDocumentViewer component
 * Displays legal document content with version and publication date
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LegalDocumentPublic } from '@/types/legal'

interface LegalDocumentViewerProps {
  document: LegalDocumentPublic
  className?: string
}

export function LegalDocumentViewer({ document, className }: LegalDocumentViewerProps) {
  const documentTitle =
    document.document_type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy'

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{documentTitle}</CardTitle>
        <CardDescription>
          Version {document.version} • Published {formatDate(document.published_at)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: document.content }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
