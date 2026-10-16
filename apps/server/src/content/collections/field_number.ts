// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_number` — float and integer numbers with and without bounds, and
 * money (integer minor units).
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_number = collection('field_number', {
    label: 'Field · Number',
    description: 'Number and money: integer, decimal, bounds.',
    fields: {
        decimal: field.number({ admin: { row: 'numbers' } }),
        integer: field.number({ integer: true, admin: { row: 'numbers' } }),
        bounded: field.number({
            min: -10,
            max: 10,
            admin: { description: 'Between -10 and 10.' }
        }),
        rating: field.number({
            integer: true,
            min: 1,
            max: 5,
            required: true
        }),
        money: field.money({ admin: { width: 'half' } }),
        bounded_money: field.money({
            min: 0,
            max: 100_000,
            admin: { width: 'half', description: 'Up to 1000.00.' }
        })
    }
});
