// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_text` — every option of a text field: required, length bounds,
 * a pattern, and the four widgets (slug, textarea, email, color). No flags,
 * so `required` is enforced on every save rather than only at publish.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_text = collection('field_text', {
    label: 'Field · Text',
    description: 'Text: required, bounds, pattern and every widget.',
    fields: {
        plain: field.text({
            admin: { placeholder: 'Anything goes', description: 'No rules.' }
        }),
        required: field.text({ required: true }),
        bounded: field.text({
            minLength: 3,
            maxLength: 20,
            admin: { description: '3 to 20 characters.' }
        }),
        slug: field.text({
            pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
            admin: { widget: 'slug' }
        }),
        textarea: field.text({
            maxLength: 500,
            admin: { widget: 'textarea', rows: 4 }
        }),
        email: field.text({
            pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
            admin: { widget: 'email', width: 'half' }
        }),
        color: field.text({ admin: { widget: 'color', width: 'half' } })
    }
});
