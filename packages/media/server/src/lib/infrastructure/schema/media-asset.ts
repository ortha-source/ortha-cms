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
        alt: text('alt'),
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
