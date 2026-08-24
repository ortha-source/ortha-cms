import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Upload } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import type { RecordsToolbarContext } from '@orthacms/content-admin';
import { CONTENT_IMPORT } from '../../constants';
import { ImportDialog } from '../ImportDialog';

const messages = defineMessages({
    import: { id: 'transfer.toolbar.import', defaultMessage: 'Import' }
});

/**
 * The collection toolbar's **Import** button.
 *
 * In the toolbar rather than the selection bar because importing is not an
 * action on a selection — there is nothing selected yet, and what arrives is
 * whatever the file holds. It belongs to the collection, next to the controls
 * that also do.
 */
export function ImportToolbarButton({ schema }: RecordsToolbarContext) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const canImport = useHasPermission(CONTENT_IMPORT);

    if (!canImport) return null;

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="shadow-none"
                onClick={() => setOpen(true)}
            >
                <Upload aria-hidden />
                {intl.formatMessage(messages.import)}
            </Button>
            <ImportDialog
                open={open}
                onOpenChange={setOpen}
                typeName={schema.name}
            />
        </>
    );
}
