import { INBOX_CATEGORIES, INBOX_KINDS, categoryOf } from './inbox-items';

describe('categoryOf', () => {
    it('files every kind under a tab the page shows', () => {
        for (const kind of Object.values(INBOX_KINDS)) {
            expect(INBOX_CATEGORIES).toContain(categoryOf(kind));
        }
    });

    it('files work asked of you under reviews, news under updates', () => {
        expect(categoryOf(INBOX_KINDS.REVIEW_REQUESTED)).toBe('reviews');
        expect(categoryOf(INBOX_KINDS.REVIEW_APPROVAL_STALE)).toBe('reviews');
        expect(categoryOf(INBOX_KINDS.REVIEW_READY)).toBe('updates');
        expect(categoryOf(INBOX_KINDS.ALARM_FLAGGED)).toBe('alarms');
    });
});
