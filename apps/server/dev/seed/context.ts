import type { INestApplicationContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AnyContentType } from '@orthacms/content-server/define';
import {
    CONTENT_REGISTRY,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { getDatabase } from '@orthacms/database';
import type { EventActor } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';

/** One password for every seeded account that has one. */
export const DEV_PASSWORD = 'ortha-dev-password';

/** Where the links the seed prints point: the admin's dev server. */
export const ADMIN_URL = (
    process.env['PUBLIC_URL'] ??
    process.env['APP_URL'] ??
    'http://localhost:4200'
).replace(/\/$/, '');

export interface SeededUser extends PublicUser {
    /** The key the seed knows this user by (`admin`, `editor`, …). */
    key: string;
}

export interface SeededWorkspace {
    id: string;
    slug: string;
    name: string;
}

export interface SeededEntry {
    type: string;
    id: string;
    workspaceId: string;
    localeGroupId?: string;
}

/**
 * Everything one phase hands the next: the app (for DI), what has been created
 * so far by key, and the lines that end up in `.output.md`.
 *
 * Keys, not ids, are how phases refer to each other's records — ids are
 * generated, so a phase that needs "the editor" or "the library workspace"
 * asks for it by the name the earlier phase gave it.
 */
export class SeedContext {
    readonly users = new Map<string, SeededUser>();
    readonly workspaces = new Map<string, SeededWorkspace>();
    readonly media = new Map<string, string>();
    readonly entries = new Map<string, SeededEntry>();
    /** Markdown sections written to `.output.md` once the seed finishes. */
    readonly output: { title: string; lines: string[] }[] = [];

    constructor(readonly app: INestApplicationContext) {}

    get db() {
        return getDatabase();
    }

    get<T>(token: abstract new (...args: never[]) => T): T {
        return this.app.get(token as never, { strict: false }) as T;
    }

    type(name: string): AnyContentType {
        const type = this.app
            .get<ContentTypeRegistry>(CONTENT_REGISTRY, { strict: false })
            .get(name);
        if (!type) throw new Error(`[seed] unknown content type "${name}"`);
        return type;
    }

    user(key: string): SeededUser {
        const user = this.users.get(key);
        if (!user) throw new Error(`[seed] no user "${key}" seeded yet`);
        return user;
    }

    /** The actor a write is attributed to — revisions, activity, four-eyes. */
    actor(key: string): EventActor {
        const { id, email } = this.user(key);
        return { id, email };
    }

    workspace(key: string): SeededWorkspace {
        const workspace = this.workspaces.get(key);
        if (!workspace)
            throw new Error(`[seed] no workspace "${key}" seeded yet`);
        return workspace;
    }

    entry(key: string): SeededEntry {
        const entry = this.entries.get(key);
        if (!entry) throw new Error(`[seed] no entry "${key}" seeded yet`);
        return entry;
    }

    asset(key: string): string {
        const id = this.media.get(key);
        if (!id) throw new Error(`[seed] no media asset "${key}" seeded yet`);
        return id;
    }

    section(title: string, lines: string[]): void {
        this.output.push({ title, lines });
    }
}

/**
 * A stable, well-formed secret derived from a label — so an invite link printed
 * by one `dev:reset` still works after the next. Dev only: anyone who reads
 * this file can derive it.
 */
export function devSecret(label: string): string {
    return createHash('sha256').update(`ortha-dev-seed:${label}`).digest('hex');
}

export const sha256Hex = (raw: string): string =>
    createHash('sha256').update(raw).digest('hex');

export const daysFromNow = (days: number): Date =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000);
