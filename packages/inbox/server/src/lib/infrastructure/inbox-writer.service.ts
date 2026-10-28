import { Injectable } from '@nestjs/common';
import type { InboxDelivery, InboxWriter } from '@orthacms/inbox-domain';
import { InboxItemRepository } from './inbox-item.repository';

/**
 * The adapter behind `INBOX_WRITER` — what protection and alarms inject,
 * optionally, to put an item in somebody's inbox. It stores what it is given:
 * who hears about what is the producer's decision, and so are the words.
 */
@Injectable()
export class InboxWriterService implements InboxWriter {
    constructor(private readonly items: InboxItemRepository) {}

    deliver(items: readonly InboxDelivery[]): Promise<void> {
        return this.items.deliver(items);
    }
}
