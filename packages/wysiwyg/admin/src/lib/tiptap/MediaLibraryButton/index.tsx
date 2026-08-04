import { defineMessages, useIntl } from 'react-intl';
import { Button } from '../../../tiptap-ui/components/tiptap-ui-primitive/button';
import { ImagePlusIcon } from '../../../tiptap-ui/components/tiptap-icons/image-plus-icon';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.image.browse',
        defaultMessage: 'Choose from library'
    }
});

/**
 * Insert an image from the host's media library.
 *
 * This is where the Simple Editor puts its `ImageUploadButton`, and it is the
 * one control that could not be taken as-is: the template uploads a file the
 * author drops on it, and in this app an image is an asset the host already
 * manages — the port it hands the editor offers exactly one method, `pick`.
 * Where the asset lives, who may upload, what counts as an image: none of it
 * belongs to the editor, which is why the seam is that narrow.
 *
 * With no port there is nothing to open, and the button is not drawn. A pasted
 * URL keeps working either way, because the value is HTML and an image is a URL.
 */
export function MediaLibraryButton() {
    const intl = useIntl();
    const { editor, media } = useWysiwyg();
    if (!editor || !media) return null;

    return (
        <Button
            type="button"
            data-style="ghost"
            aria-label={intl.formatMessage(messages.label)}
            tooltip={intl.formatMessage(messages.label)}
            onClick={async () => {
                const asset = await media.pick().catch(() => null);
                if (!asset) return;
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: 'image',
                        attrs: { src: asset.url, alt: asset.alt ?? '' }
                    })
                    .run();
            }}
        >
            <ImagePlusIcon className="tiptap-button-icon" />
        </Button>
    );
}
