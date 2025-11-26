/**
 * MealSelectionForm Component
 *
 * Form for selecting meal options for event attendees.
 */

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { FoodOption } from '@/lib/api/events'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

const mealSelectionSchema = z.object({
  food_option_id: z.string().min(1, 'Please select a meal option'),
})

export type MealSelectionFormData = z.infer<typeof mealSelectionSchema>

interface MealSelectionFormProps {
  attendeeName: string
  foodOptions: FoodOption[]
  initialData?: Partial<MealSelectionFormData>
  onSubmit: (data: MealSelectionFormData) => void
  isLoading?: boolean
  submitButtonText?: string
}

export function MealSelectionForm({
  attendeeName,
  foodOptions,
  initialData,
  onSubmit,
  isLoading = false,
  submitButtonText = 'Continue',
}: MealSelectionFormProps) {
  const form = useForm<MealSelectionFormData>({
    resolver: zodResolver(mealSelectionSchema),
    defaultValues: {
      food_option_id: initialData?.food_option_id || '',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Meal Selection for {attendeeName}</h3>
          <p className="text-sm text-muted-foreground">
            Please select a meal option for this attendee.
          </p>

          <FormField
            control={form.control}
            name="food_option_id"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Meal Options *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-3"
                  >
                    {foodOptions.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer"
                      >
                        <RadioGroupItem value={option.id} id={option.id} />
                        <Label
                          htmlFor={option.id}
                          className="flex-1 cursor-pointer space-y-1"
                        >
                          <div className="font-medium">{option.name}</div>
                          {option.description && (
                            <div className="text-sm text-muted-foreground">
                              {option.description}
                            </div>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  Select the meal you'd prefer for this event
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Saving...' : submitButtonText}
        </Button>
      </form>
    </Form>
  )
}
