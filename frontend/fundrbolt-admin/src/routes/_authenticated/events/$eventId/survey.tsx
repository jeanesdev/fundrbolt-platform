import { createFileRoute } from '@tanstack/react-router'
import { EventSurveyPage } from '@/features/events/sections/EventSurveyPage'

export const Route = createFileRoute('/_authenticated/events/$eventId/survey')({
  component: EventSurveyPage,
})
