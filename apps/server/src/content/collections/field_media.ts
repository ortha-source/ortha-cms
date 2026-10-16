// @orthacms-generated — managed by the Schema Builder.

/**
 * `field_media` — single and multiple media, restricted by kind and by exact
 * MIME type, and unrestricted.
 */

import { collection, field } from '@orthacms/content-server/define';

export const field_media = collection('field_media', {
    label: 'Field · Media',
    description: 'Media: single, multiple, by kind, by MIME type.',
    fields: {
        title: field.text({ required: true }),
        image: field.media({ accept: { kinds: ['image'] } }),
        gallery: field.media({ multiple: true, accept: { kinds: ['image'] } }),
        any_file: field.media(),
        attachments: field.media({ multiple: true }),
        pdf_only: field.media({ accept: { mimeTypes: ['application/pdf'] } }),
        video: field.media({ accept: { kinds: ['video'] } }),
        audio: field.media({ accept: { kinds: ['audio'] } })
    }
});
