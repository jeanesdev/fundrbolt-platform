import { donateNowApi, type DonationCreateRequest } from '@/lib/api/donateNow'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export function useDonateNow(npoSlug: string) {
  const [selectedAmount, setSelectedAmount] = useState<number>(2500) // $25 default
  const [customAmount, setCustomAmount] = useState<string>('')
  const [isMonthly, setIsMonthly] = useState(false)
  const [coversProcessingFee, setCoversProcessingFee] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showAmount, setShowAmount] = useState(true)
  const [wallMessage, setWallMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [donationSuccess, setDonationSuccess] = useState(false)
  const [lastDonation, setLastDonation] = useState<Awaited<ReturnType<typeof donateNowApi.createDonation>>['data'] | null>(null)

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['donate-now-page', npoSlug],
    queryFn: () => donateNowApi.getPage(npoSlug).then((r) => r.data),
  })

  const donateMutation = useMutation({
    mutationFn: (req: DonationCreateRequest) => donateNowApi.createDonation(npoSlug, req),
    onSuccess: (res) => {
      setLastDonation(res.data)
      setDonationSuccess(true)
      setShowConfirm(false)
    },
  })

  const effectiveAmountCents = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : selectedAmount

  const feePercent = parseFloat(pageData?.processing_fee_pct ?? '0')
  const processingFeeCents = coversProcessingFee
    ? Math.round(effectiveAmountCents * feePercent)
    : 0
  const totalCents = effectiveAmountCents + processingFeeCents

  const handleDonate = () => {
    if (!effectiveAmountCents || effectiveAmountCents <= 0) return
    const idempotencyKey = `donor-${Date.now()}-${Math.random().toString(36).slice(2)}`
    donateMutation.mutate({
      amount_cents: effectiveAmountCents,
      covers_processing_fee: coversProcessingFee,
      is_monthly: isMonthly,
      support_wall_message: wallMessage || undefined,
      is_anonymous: isAnonymous,
      show_amount: showAmount,
      idempotency_key: idempotencyKey,
    })
  }

  return {
    pageData,
    isLoading,
    error,
    selectedAmount,
    setSelectedAmount,
    customAmount,
    setCustomAmount,
    isMonthly,
    setIsMonthly,
    coversProcessingFee,
    setCoversProcessingFee,
    isAnonymous,
    setIsAnonymous,
    showAmount,
    setShowAmount,
    wallMessage,
    setWallMessage,
    showConfirm,
    setShowConfirm,
    effectiveAmountCents,
    processingFeeCents,
    totalCents,
    feePercent,
    handleDonate,
    isPending: donateMutation.isPending,
    donateError: donateMutation.error,
    donationSuccess,
    lastDonation,
    setDonationSuccess,
  }
}
