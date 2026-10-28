import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import {
    WorkspacePurgeRegistry,
    type WorkspacePurger,
    type WorkspacePurgeOutcome
} from '@orthacms/workspaces-server';
import { InboxItemRepository } from './inbox-item.repository';

/**
 * Removes a deleted workspace's inbox items. `inbox_items.workspace_id` has no
 * foreign key, so nothing else reaches these rows when the workspace goes —
 * and an item linking to a workspace that no longer exists is residue, not
 * history. Registered optionally, as every purger is.
 */
@Injectable()
export class InboxWorkspacePurger implements WorkspacePurger, OnModuleInit {
    readonly purgeName = 'inbox:items';

    constructor(
        private readonly items: InboxItemRepository,
        @Optional() private readonly registry?: WorkspacePurgeRegistry
    ) {}

    onModuleInit(): void {
        this.registry?.register(this);
    }

    async purge(workspaceId: string): Promise<WorkspacePurgeOutcome> {
        return { rows: await this.items.purgeWorkspace(workspaceId) };
    }
}
