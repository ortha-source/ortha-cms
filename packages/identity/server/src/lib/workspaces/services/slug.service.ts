import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { workspaces } from '../../schema';

/** Workspace slug availability — the single owner of the uniqueness check. */
@Injectable()
export class SlugService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Whether `slug` is free (not yet used by any workspace). */
    async available(slug: string): Promise<boolean> {
        const [existing] = await this.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.slug, slug))
            .limit(1);
        return !existing;
    }
}
