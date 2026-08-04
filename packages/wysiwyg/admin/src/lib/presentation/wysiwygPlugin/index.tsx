import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { Skeleton } from '@ortha-cms/design-system';
import {
    CONTENT_FIELD_TYPE,
    ENTRY_FIELD_CONTROL_SLOT,
    type ContentField,
    type EntryFieldControlContext
} from '@ortha-cms/content-admin';
import { WYSIWYG_WIDGET } from '../../domain/constants';

/**
 * The control, split out of the initial bundle.
 *
 * A plugin factory runs at boot — it has to, or its slot contribution isn't
 * registered before the first render — so anything it imports statically lands
 * in the entry chunk. TipTap and ProseMirror are ~450 kB of that, for a control
 * that only ever renders inside an entry editor, itself already behind a lazy
 * route. Loading them with the field instead of with the app keeps the sign-in
 * page as light as it was before this plugin existed.
 */
const WysiwygFieldControl = lazy(() =>
    import('../components/WysiwygFieldControl').then((module) => ({
        default: module.WysiwygFieldControl
    }))
);

/**
 * Stands in for the control while its chunk loads. Sized like the collapsed
 * preview on purpose: a shorter placeholder would let the rest of the form jump
 * upward and then back down as the editor arrives.
 */
function WysiwygFieldFallback() {
    return <Skeleton className="h-24 w-full rounded-lg" />;
}

/** The slot's component: the real control, behind its own loading boundary. */
function LazyWysiwygFieldControl(context: EntryFieldControlContext) {
    return (
        <Suspense fallback={<WysiwygFieldFallback />}>
            <WysiwygFieldControl {...context} />
        </Suspense>
    );
}

/**
 * Whether this plugin owns a field's control.
 *
 * Every `richtext` field, by default — a rich-text field that renders as a raw
 * HTML textarea is exactly what this plugin exists to replace, and requiring an
 * opt-in would leave the old control on every schema written before it existed.
 *
 * `admin: { widget: 'textarea' }` opts back out, for the field whose body isn't
 * authored prose: a hand-maintained snippet, an email template, anything the
 * author edits as markup on purpose. A WYSIWYG would reformat it on open.
 */
function isWysiwygField(field: ContentField): boolean {
    if (field.type !== CONTENT_FIELD_TYPE.RichText) return false;
    return field.admin['widget'] !== WYSIWYG_WIDGET.Textarea;
}

/**
 * Admin-side WYSIWYG plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config (a trimmed toolbar, a custom palette) has a home.
 */
export type WysiwygAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side WYSIWYG plugin.
 *
 * It contributes **no routes and no navigation** — it is not a place in the
 * app, it is how one kind of field behaves. Its whole surface is a single
 * `ENTRY_FIELD_CONTROL_SLOT` contribution, which content-admin renders wherever
 * an entry form renders: a collection's records editor and a single (page)
 * alike, on the General tab and inside a localized type's Translated/Shared
 * groups.
 *
 * Register it **after** `ContentPlugin()`, whose slot it fills.
 */
export function WysiwygPlugin(): WysiwygAdminPlugin {
    return {
        name: 'wysiwyg',
        slots: [
            {
                slot: ENTRY_FIELD_CONTROL_SLOT,
                items: [
                    {
                        id: 'wysiwyg.entry.richtext',
                        appliesTo: isWysiwygField,
                        Component: LazyWysiwygFieldControl
                    }
                ]
            }
        ]
    };
}
