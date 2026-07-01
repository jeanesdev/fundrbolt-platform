import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MediaUploadZone } from '@/features/events/components/MediaUploadZone'

describe('MediaUploadZone', () => {
  it('auto-queues on select and hides manual upload button in auto mode', async () => {
    const onUpload = vi.fn(async () => undefined)
    const user = userEvent.setup()

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })

    const { container, queryByRole } = render(
      <MediaUploadZone onUpload={onUpload} autoUploadOnSelect />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test-image'], 'test-image.jpg', {
      type: 'image/jpeg',
    })

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1)
      expect(onUpload).toHaveBeenCalledWith(file, 'image')
    })

    expect(queryByRole('button', { name: /upload/i })).not.toBeInTheDocument()
  })
})
