import { DynamicModule, Module } from '@nestjs/common';
import { INBOX_WRITER } from '@orthacms/inbox-domain';
import { InboxController } from './http/inbox.controller';
import { InboxService } from './application/inbox.service';
import { InboxItemRepository } from './infrastructure/inbox-item.repository';
import { InboxWorkspacePurger } from './infrastructure/inbox-workspace.purger';
import { InboxWriterService } from './infrastructure/inbox-writer.service';

/**
 * The inbox plugin's module: the `/api/inbox` routes and the `INBOX_WRITER`
 * port producers inject.
 *
 * **Global**, so protection and alarms can inject the writer `@Optional()`
 * without importing this module — and without it registered, they bind
 * nothing and behave exactly as before.
 */
@Module({})
export class InboxModule {
    static forRoot(): DynamicModule {
        return {
            module: InboxModule,
            global: true,
            controllers: [InboxController],
            providers: [
                InboxItemRepository,
                InboxService,
                InboxWriterService,
                { provide: INBOX_WRITER, useExisting: InboxWriterService },
                // A deleted workspace's items go with it.
                InboxWorkspacePurger
            ],
            exports: [INBOX_WRITER, InboxService]
        };
    }
}
