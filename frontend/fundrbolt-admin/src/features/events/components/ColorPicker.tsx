/**
 * ColorPicker Component
 * Simple color picker with hex input and visual preview
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || '')

  const handleHexChange = (newHex: string) => {
    setHexInput(newHex)
    // Validate hex color format
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newHex)) {
      onChange(newHex)
    } else if (newHex === '') {
      onChange('')
    }
  }

  const handleColorChange = (newColor: string) => {
    setHexInput(newColor)
    onChange(newColor)
  }

  return (
    <div className="flex gap-2 items-center">
      {/* Color preview with native color picker */}
      <div className="flex items-center gap-2">
        <Label htmlFor={`color-${label}`} className="sr-only">
          Pick {label} Color
        </Label>
        <input
          id={`color-${label}`}
          type="color"
          value={hexInput || '#000000'}
          onChange={(e) => handleColorChange(e.target.value)}
          className="h-10 w-10 rounded border border-input cursor-pointer"
          title={`Pick ${label} Color`}
        />
      </div>

      {/* Hex code input */}
      <Input
        type="text"
        placeholder="#000000"
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        className="flex-1 font-mono"
        maxLength={7}
      />

      {/* Color preview swatch */}
      {hexInput && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexInput) && (
        <div
          className="h-10 w-20 rounded border border-input"
          style={{ backgroundColor: hexInput }}
          title={hexInput}
        />
      )}
    </div>
  )
}
