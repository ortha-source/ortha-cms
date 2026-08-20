import {
    bigint,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

/** Coarse media category — mirrors the domain `MediaKind`. */
export const mediaKind = pgEnum('media_kind', [
    'image',
    'video',
    'audio',
    'document',
    'archive'
]);

/**
 * The kinds of timed text a track can carry, mirroring HTML's `<track kind>`.
 *
 * `captions` and `subtitles` are deliberately separate, as they are in HTML and
 * in WCAG: captions carry the non-speech audio a deaf viewer needs (1.2.2),
 * while subtitles are a translation for someone who can hear it fine. Storing
 * one as the other publishes a `<track>` that claims to be something it is not.
 */
export const MEDIA_TRACK_KIND = [
    'captions',
    'subtitles',
    'descriptions',
    'chapters'
] as const;

/** One of {@link MEDIA_TRACK_KIND}. */
export type MediaTrackKind = (typeof MEDIA_TRACK_KIND)[number];

/**
 * One timed-text track attached to a video or audio asset, stored in the
 * `tracks` column.
 */
export interface StoredMediaTrack {
    /** What the track carries — see {@link MEDIA_TRACK_KIND}. */
    kind: MediaTrackKind;
    /**
     * BCP-47 tag of the track's language, e.g. `en` or `pt-BR`. Required: a
     * `<track>` with no `srclang` cannot be selected by a player and is
     * announced with the page's phonemes.
     */
    srclang: string;
    /** The label a player shows in its track menu, e.g. "English (CC)". */
    label: string;
    /** The media asset holding the WebVTT file itself. */
    assetId: string;
    /** Marks the track a player should enable by default. */
    default?: boolean;
}

/**
 * One stored image derivative: its storage key (same provider as the original)
 * plus intrinsic dimensions and byte size, keyed by variant name in the
 * `variants` column.
 */
export interface StoredVariant {
    key: string;
    width: number;
    height: number;
    size: number;
}

/**
 * A stored media asset. Carries lightweight metadata plus a pointer to the
 * bytes: `storageKey` (opaque, provider-owned) and `storageProvider` (which
 * backend holds it). `folderId` null = the workspace root. Bytes never live in
 * the database — only this row does.
 */
export const mediaAsset = pgTable(
    'media_asset',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        workspaceId: uuid('workspace_id').notNull(),
        folderId: uuid('folder_id'),
        name: text('name').notNull(),
        kind: mediaKind('kind').notNull(),
        mimeType: text('mime_type').notNull(),
        size: bigint('size', { mode: 'number' }).notNull(),
        storageKey: text('storage_key').notNull(),
        storageProvider: text('storage_provider').notNull(),
        checksum: text('checksum'),
        width: integer('width'),
        height: integer('height'),
        duration: integer('duration'),
        tags: jsonb('tags').$type<string[]>().notNull().default([]),
        /** Generated display derivatives (`thumb`/`preview`), keyed by name. */
        variants: jsonb('variants')
            .$type<Record<string, StoredVariant>>()
            .notNull()
            .default({}),
        alt: text('alt'),
        /**
         * Timed text accompanying a video or audio asset — captions, subtitles,
         * descriptions, chapters.
         *
         * Without this the CMS could not represent a caption track **at any
         * layer**: `MediaKind` has no `caption` category, so a WebVTT file
         * uploaded as a second asset was `kind: 'document'` with no link back to
         * the video it belonged to, and nothing downstream could find it. Video
         * published through Ortha therefore had no captions available to it —
         * WCAG 1.2.2 / 1.2.3, 508 503.4 (`ORT-92`).
         *
         * A `jsonb` list of pointers rather than a self-referencing column,
         * because a video legitimately has several: one per language, plus a
         * descriptions track alongside the captions.
         */
        tracks: jsonb('tracks')
            .$type<StoredMediaTrack[]>()
            .notNull()
            .default([]),
        uploadedBy: uuid('uploaded_by').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (table) => [
        index('media_asset_ws_folder_idx').on(table.workspaceId, table.folderId)
    ]
);
