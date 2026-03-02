/**
 * Sales Export Button Component
 * Allows downloading sales data as CSV
 */

import { salesTrackingApi } from '@/api/salesTracking';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';

interface SalesExportButtonProps {
  eventId: string;
  eventName?: string;
}

export function SalesExportButton({ eventId, eventName }: SalesExportButtonProps) {
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async () => {
      const blobUrl = await salesTrackingApi.exportSalesCSV(eventId);

      // Trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ticket_sales_${eventName?.replace(/\s+/g, '_') || eventId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    },
    onSuccess: () => {
      toast({
        title: 'Export successful',
        description: 'Sales data has been downloaded as CSV.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export sales data',
        variant: 'destructive',
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportMutation.mutate()}
      disabled={exportMutation.isPending}
    >
      {exportMutation.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </>
      )}
    </Button>
  );
}
