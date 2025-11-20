import { faker } from '@faker-js/faker'

// Set a fixed seed for consistent data generation
faker.seed(67890)

export const users = Array.from({ length: 500 }, () => {
  const first_name = faker.person.firstName()
  const last_name = faker.person.lastName()
  return {
    id: faker.string.uuid(),
    email: faker.internet.email({ firstName: first_name }).toLocaleLowerCase(),
    first_name,
    last_name,
    phone: faker.phone.number({ style: 'international' }),
    organization_name: faker.helpers.arrayElement([
      null,
      faker.company.name(),
    ]),
    address_line1: faker.helpers.arrayElement([null, faker.location.streetAddress()]),
    address_line2: faker.helpers.arrayElement([
      null,
      faker.location.secondaryAddress(),
    ]),
    city: faker.helpers.arrayElement([null, faker.location.city()]),
    state: faker.helpers.arrayElement([null, faker.location.state()]),
    postal_code: faker.helpers.arrayElement([null, faker.location.zipCode()]),
    country: faker.helpers.arrayElement([null, faker.location.country()]),
    role: faker.helpers.arrayElement([
      'super_admin',
      'npo_admin',
      'event_coordinator',
      'staff',
      'donor',
    ]),
    npo_id: faker.helpers.arrayElement([null, faker.string.uuid()]),
    npo_memberships: [],
    email_verified: faker.datatype.boolean(),
    is_active: faker.datatype.boolean({ probability: 0.9 }),
    last_login_at: faker.helpers.arrayElement([
      null,
      faker.date.recent().toISOString(),
    ]),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
  }
})
