import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { UnitOfWork } from '@orthacms/database';
import {
    EntryWriterService,
    InjectContentRegistry,
    entryTitle,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { users } from '@orthacms/identity-server';
import { workspaces } from '@orthacms/workspaces-server';

/** A person a notice names or is sent to. */
export interface NoticePerson {
    email: string;
    /** Display name, or `null` until they set one. */
    name: string | null;
}

/** What a review notice says about the thing it is about. */
export interface ReviewNoticeSubject {
    workspaceName: string;
    contentTypeLabel: string;
    entryTitle: string | null;
}

/**
 * The words a review notice needs that the request itself does not carry —
 * the workspace's name, the record's title, the people's names.
 *
 * Read through the schema objects and services their plugins export, the same
 * way `ReviewerCandidatesQuery` reads the roster. It runs once per request,
 * inside the request's own transaction, never on a page of rows.
 */
@Injectable()
export class ReviewNoticeQuery {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly entries: EntryWriterService,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /** Each id's address and name; a deleted account is simply absent. */
    async people(
        userIds: readonly string[]
    ): Promise<Map<string, NoticePerson>> {
        if (!userIds.length) return new Map();
        const rows = await this.uow
            .current()
            .select({ id: users.id, email: users.email, name: users.name })
            .from(users)
            .where(inArray(users.id, [...new Set(userIds)]));
        return new Map(
            rows.map((row) => [row.id, { email: row.email, name: row.name }])
        );
    }

    /**
     * The workspace's name and the record as a list would name it. The title
     * reading is the queue's (`entryTitle`, falling back to nothing rather
     * than to the id), so the mail and the Reviews page name a record alike.
     */
    async subject(
        workspaceId: string,
        contentType: string,
        entryId: string
    ): Promise<ReviewNoticeSubject> {
        const [workspace] = await this.uow
            .current()
            .select({ name: workspaces.name })
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId))
            .limit(1);
        const type = this.registry.get(contentType);
        let title: string | null = null;
        if (type) {
            try {
                const record = await this.entries.getOne(
                    type,
                    entryId,
                    workspaceId
                );
                const read = entryTitle(type, {
                    ...record.values,
                    id: entryId
                });
                title = read === entryId ? null : read;
            } catch {
                title = null;
            }
        }
        return {
            workspaceName: workspace?.name ?? workspaceId,
            contentTypeLabel: type?.label ?? contentType,
            entryTitle: title
        };
    }
}
