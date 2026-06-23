/**
 * ColorPicker Component
 * Simple color picker with hex input and visual preview
 */
import { useEffect, useState } from 'react'
import { colors as brandColors } from '@fundrbolt/shared/assets'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || '')

  useEffect(() => {
    setHexInput(value || '')
  }, [value])

  const normalizeHexInput = (rawValue: string): string => {
    const trimmed = rawValue.trim()
    if (!trimmed) return ''

    const withoutHashes = trimmed.replace(/^#+/, '')
    return `#${withoutHashes}`
  }

  const handleHexChange = (newHex: string) => {
    const normalizedHex = normalizeHexInput(newHex)
    setHexInput(normalizedHex)

    // Validate hex color format
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(normalizedHex)) {
      onChange(normalizedHex)
    } else if (normalizedHex === '') {
      onChange('')
    }
  }

  const handleColorChange = (newColor: string) => {
    setHexInput(newColor)
    onChange(newColor)
  }

  return (
    <div className='flex items-center gap-2'>
      {/* Color preview with native color picker */}
      <div className='flex items-center gap-2'>
        <Label htmlFor={`color-${label}`} className='sr-only'>
          Pick {label} Color
        </Label>
        <input
          id={`color-${label}`}
          type='color'
          value={hexInput || brandColors.background.dark}
          onChange={(e) => handleColorChange(e.target.value)}
          className='border-input h-10 w-10 cursor-pointer rounded border'
          title={`Pick ${label} Color`}
        />
      </div>

      {/* Hex code input */}
      <Input
        type='text'
        placeholder={brandColors.background.dark.toUpperCase()}
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        className='flex-1 font-mono'
        maxLength={7}
      />

      {/* Color preview swatch */}
      {hexInput && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexInput) && (
        <div
          className='border-input h-10 w-20 rounded border'
          style={{ backgroundColor: hexInput }}
          title={hexInput}
        />
      )}
    </div>
  )
}
