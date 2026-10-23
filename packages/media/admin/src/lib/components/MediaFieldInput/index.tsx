import type { EntryFieldControlContext } from '@orthacms/content-admin';
import { MEDIA_PRESAVE_ID } from '../../hooks/usePendingMediaUploads';
import type { MediaPendingUploads } from '../../types/pendingUpload';
import type { MediaAccept } from '../../utils/mediaAccept';
import { MediaFieldControl } from '../MediaFieldControl';

/**
 * A media field **in the entry form**, contributed through content-admin's
 * `ENTRY_FIELD_CONTROL_SLOT`. It used to be a titled card on a Media tab of
 * its own; a media field is a field with its own control, so it now sits in
 * the schema's order beside the rest (ADR-0022), and content draws its label
 * row (label, required mark, locale mark, "Changed"), description and error
 * like any other field's.
 *
 * The item is registered `composite`, so the field is named as a group by
 * that label — the control is several buttons, and a `<label for>` would
 * rename the one it pointed at.
 *
 * The staged uploads come from the plugin's own presave handle, held above the
 * form so they outlive any remount; the saved ids' display refs come from the
 * editor's one media read.
 */
export function MediaFieldInput({
    field,
    id,
    value,
    error,
    describedBy,
    readOnly,
    onChange,
    onBlur,
    mediaRefs,
    mediaRefsPending,
    presave
}: EntryFieldControlContext) {
    const uploads = presave?.[MEDIA_PRESAVE_ID] as
        | MediaPendingUploads
        | undefined;
    return (
        <MediaFieldControl
            id={id}
            multiple={!!field.multiple}
            accept={field.accept as MediaAccept | undefined}
            required={field.required}
            value={value}
            initialRefs={mediaRefs}
            refsPending={mediaRefsPending}
            uploads={uploads}
            readOnly={readOnly}
            invalid={!!error}
            describedBy={describedBy}
            onChange={onChange}
            onBlur={onBlur ?? (() => undefined)}
        />
    );
}
