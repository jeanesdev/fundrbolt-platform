/**
 * CheckoutPaymentMethods — T018
 *
 * Radio-style payment method selector with contextual helper content.
 */
import { Banknote, BookCheck, CreditCard, HandHeart } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector'
import { BoothInstructionsCard } from './BoothInstructionsCard'

type PaymentMethodValue = 'card' | 'cash' | 'check' | 'daf'

export interface CheckoutPaymentMethodsProps {
  value: PaymentMethodValue
  onChange: (method: PaymentMethodValue) => void
  cashInstructions?: string
  eventNpoName?: string
  npoId?: string
  selectedProfileId?: string | null
  onSelectProfile?: (id: string | null) => void
  totalAmount?: number
  returnUrl?: string
}

const METHOD_OPTIONS: {
  value: PaymentMethodValue
  label: string
  icon: React.ReactNode
}[] = [
  {
    value: 'card',
    label: 'Credit / Debit Card',
    icon: <CreditCard className='h-4 w-4' />,
  },
  {
    value: 'cash',
    label: 'Cash',
    icon: <Banknote className='h-4 w-4' />,
  },
  {
    value: 'check',
    label: 'Check',
    icon: <BookCheck className='h-4 w-4' />,
  },
  {
    value: 'daf',
    label: 'DAF (Donor-Advised Fund)',
    icon: <HandHeart className='h-4 w-4' />,
  },
]

export function CheckoutPaymentMethods({
  value,
  onChange,
  cashInstructions,
  eventNpoName,
  npoId,
  selectedProfileId,
  onSelectProfile,
  totalAmount,
  returnUrl,
}: CheckoutPaymentMethodsProps) {
  return (
    <div className='space-y-4'>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as PaymentMethodValue)}
        className='space-y-2'
      >
        {METHOD_OPTIONS.map((option) => (
          <div
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
              value === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <RadioGroupItem value={option.value} id={`pm-${option.value}`} />
            <Label
              htmlFor={`pm-${option.value}`}
              className='flex flex-1 cursor-pointer items-center gap-2'
            >
              <span className='text-muted-foreground'>{option.icon}</span>
              <span className='font-medium'>{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Card sub-selector */}
      {value === 'card' && npoId && onSelectProfile && (
        <div className='pl-2'>
          <PaymentMethodSelector
            npoId={npoId}
            selectedProfileId={selectedProfileId ?? null}
            onSelect={onSelectProfile}
            totalAmount={totalAmount}
            returnUrl={returnUrl}
          />
        </div>
      )}

      {/* Booth instructions for non-card methods */}
      {(value === 'cash' || value === 'check' || value === 'daf') && (
        <BoothInstructionsCard
          cashInstructions={cashInstructions}
          npoName={eventNpoName}
        />
      )}
    </div>
  )
}

export default CheckoutPaymentMethods
