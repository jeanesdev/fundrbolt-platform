import { expect, test } from '../../fixtures/base-fixtures'

test('mobile subset placeholder keeps configuration valid', async ({ seedRefs }) => {
  expect(seedRefs.liveEventSlug).toBe('seed-live-event')
})
