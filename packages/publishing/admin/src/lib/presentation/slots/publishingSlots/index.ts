/**
 * The Publish Manager's **extension slots** — how another plugin adds what it
 * knows about a set of records without the manager knowing what that is.
 *
 * Both are **hook-style** items, called once per item per render in a loop
 * over `getItems()`. That is rules-of-hooks-safe only because slot
 * registration is boot-frozen (`createAdmin` registers every contribution once,
 * before the first render), so the call order never changes. An item must gate
 * its own fetching (TanStack Query `enabled`) rather than expect to be
 * skipped, and return `null` when it has nothing to say about this set.
 *
 * Neither slot can publish anything. What goes out is decided by the reader's
 * picks and by content's own dry run and commit; an expansion can only add
 * cells to choose from, and an annotation can only say something about one.
 */

import type { MessageDescriptor } from 'react-intl';
import { createSlot } from '@orthacms/utils-admin';
import type {
    PublishAxis,
    PublishCell,
    PublishEntry,
    PublishRecord
} from '../../../domain/types';

/** What every slot hook is handed besides its subject. */
export type PublishSlotContext = {
    workspaceId: string;
    /**
     * Bumped after every commit. Put it in your query key: what you answered
     * before the publish (a status, an approval count) is stale after it, and
     * this is the one moment the manager knows that.
     */
    version: number;
};

/** A read's state, as the page needs it to tell loading from failed from done. */
export type PublishReadState = {
    isPending: boolean;
    /** The read failed — the page says so rather than showing fewer cells. */
    isError: boolean;
    refetch: () => void;
};

/** What an expansion found for the records it was shown. */
export type PublishExpansion = PublishReadState & {
    /** Extra cells per record key. A cell the record already has is ignored. */
    cells: ReadonlyMap<string, readonly PublishCell[]>;
    /**
     * The columns this expansion knows, in display order — the configured
     * locales, for the i18n plugin. A section shows these for its axes before
     * any it found no definition for.
     */
    axes: readonly PublishAxis[];
};

/** One contributed expansion (e.g. a record's other translations). */
export type PublishExpansionItem = {
    /** Stable id (also the React key). */
    id: string;
    /** What it adds, for the failure line ("Translations couldn't load"). */
    label: MessageDescriptor;
    /** Resolves the extra cells — **a hook**; `null` when it has nothing here. */
    useExpansion: (
        records: readonly PublishRecord[],
        context: PublishSlotContext
    ) => PublishExpansion | null;
};

/**
 * Cells another plugin adds to the set's records. `@orthacms/i18n-admin` fills
 * it with each record's **other translations**, which is what turns a
 * selection of English rows into a choice of which languages go out.
 */
export const PUBLISH_EXPANSION_SLOT = createSlot<PublishExpansionItem>(
    'publishing.expansions'
);

/** The tone of an annotation — drives its badge colour. */
export type PublishAnnotationTone =
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger';

/** One thing a plugin has to say about one entry. */
export type PublishAnnotation = {
    /** Short badge text ("Approvals 1/2"). */
    label: string;
    tone: PublishAnnotationTone;
    /** A sentence for the badge's accessible description / tooltip. */
    description?: string;
    /**
     * The commit will refuse this entry as things stand (a publish guard
     * holds it). Shown, never enforced here — the server decides, and the
     * reader may know the approval is about to land.
     */
    blocking?: boolean;
};

/** What an annotation item answered. */
export type PublishAnnotations = PublishReadState & {
    /** Per entry id. An entry with nothing to say is absent. */
    byEntry: ReadonlyMap<string, PublishAnnotation>;
};

/** One contributed annotation source (e.g. approval status). */
export type PublishAnnotationItem = {
    /** Stable id (also the React key). */
    id: string;
    /** What it reports on, for the failure line and the legend. */
    label: MessageDescriptor;
    /** Resolves the annotations — **a hook**; `null` when it has nothing here. */
    useAnnotations: (
        entries: readonly PublishEntry[],
        context: PublishSlotContext
    ) => PublishAnnotations | null;
};

/**
 * Per-entry notes another plugin shows in the cells. `@orthacms/protection-admin`
 * fills it with **approval status**, so an entry a rule will hold is visible
 * before the commit says so.
 */
export const PUBLISH_ANNOTATION_SLOT = createSlot<PublishAnnotationItem>(
    'publishing.annotations'
);
