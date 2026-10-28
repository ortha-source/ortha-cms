import { DEFAULT_NOTIFICATION_TEMPLATES } from './notification-templates';
import { NOTIFICATION_KINDS, type Notice } from './notifications';
import { MAIL_KINDS } from './mail-dispatcher';
import { appLink } from './links';

const context = {
    productName: 'Ortha CMS',
    url: (path: string) => appLink('https://cms.example.com', path)
};

const review: Notice = {
    kind: NOTIFICATION_KINDS.REVIEW_REQUESTED,
    to: 'amara@example.com',
    userId: 'u-1',
    recipientName: 'Amara Okafor',
    requesterName: 'Margaret Hamilton',
    entryTitle: 'Team page',
    contentTypeLabel: 'Pages',
    workspaceName: 'Marketing site',
    requiredApprovals: 2,
    alsoAsked: ['Grace Hopper'],
    reviewPath: 'workspaces/ws_1/reviews'
};

const digest: Notice = {
    kind: NOTIFICATION_KINDS.ALARM_DIGEST,
    to: 'amara@example.com',
    userId: 'u-1',
    recipientName: null,
    period: 'daily',
    settingsPath: 'inbox/settings',
    sections: [
        {
            workspaceName: 'Marketing site',
            alarmsPath: 'workspaces/ws_1/alarms',
            lines: [
                {
                    name: 'Author is not published',
                    severity: 'error',
                    contentTypeLabel: 'Articles',
                    newCount: 3,
                    openCount: 4
                }
            ]
        },
        {
            workspaceName: 'Product docs',
            alarmsPath: 'workspaces/ws_2/alarms',
            lines: [
                {
                    name: 'Missing SEO description',
                    severity: 'warn',
                    contentTypeLabel: 'Guides',
                    newCount: 2,
                    openCount: 9
                }
            ]
        }
    ]
};

const render = (notice: Notice) =>
    // The map is keyed by kind; the cast is the same narrowing the dispatcher does.
    (
        DEFAULT_NOTIFICATION_TEMPLATES[notice.kind] as (
            n: Notice,
            c: typeof context
        ) => { subject: string; text: string; html?: string }
    )(notice, context);

describe('the shipped notice templates', () => {
    it('cover every notice kind, and no other', () => {
        expect(Object.keys(DEFAULT_NOTIFICATION_TEMPLATES).sort()).toEqual(
            Object.values(NOTIFICATION_KINDS).sort()
        );
    });

    // `mail_deliveries.kind` is one column for both, and `reveal-link` tells a
    // token row from a notice by its kind — a shared name would hand a notice
    // back as somebody's secret.
    it('never reuse a token message’s kind', () => {
        const tokens = new Set<string>(Object.values(MAIL_KINDS));
        for (const kind of Object.values(NOTIFICATION_KINDS)) {
            expect(tokens.has(kind)).toBe(false);
        }
    });

    it('name who asked, what, where, and link to the review', () => {
        const mail = render(review);
        expect(mail.subject).toBe(
            'Margaret Hamilton asked you to review “Team page”'
        );
        expect(mail.text).toContain('Hello Amara Okafor,');
        expect(mail.text).toContain('Marketing site');
        expect(mail.text).toContain('need 2 approvals');
        expect(mail.text).toContain('Grace Hopper was asked too.');
        expect(mail.text).toContain(
            'https://cms.example.com/workspaces/ws_1/reviews'
        );
        expect(mail.html).toContain(
            '<a href="https://cms.example.com/workspaces/ws_1/reviews">'
        );
    });

    it('say an unprotected ask is a second pair of eyes, not a gate', () => {
        const mail = render({ ...review, requiredApprovals: 0, alsoAsked: [] });
        expect(mail.text).toContain('without approval');
        expect(mail.text).not.toContain('asked too');
    });

    it('name a record with no title by what it is', () => {
        const mail = render({ ...review, entryTitle: null });
        expect(mail.subject).toBe(
            'Margaret Hamilton asked you to review a record in Pages'
        );
    });

    it('sum a digest across workspaces and list each alarm', () => {
        const mail = render(digest);
        expect(mail.subject).toBe('5 new alarm findings in 2 workspaces');
        expect(mail.text).toContain('Hello,');
        expect(mail.text).toContain(
            'Error · “Author is not published” — 3 new, 4 open in Articles'
        );
        expect(mail.text).toContain(
            'Warning · “Missing SEO description” — 2 new, 9 open in Guides'
        );
        expect(mail.text).toContain('https://cms.example.com/inbox/settings');
    });

    it('escape what a person typed in the HTML part', () => {
        const mail = render({ ...review, entryTitle: '<b>x</b>' });
        expect(mail.html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(mail.html).not.toContain('<b>x</b>');
    });
});

describe('appLink', () => {
    it('keeps the deployment’s base path, with or without a leading slash', () => {
        expect(appLink('https://example.com/admin', '/workspaces/a')).toBe(
            'https://example.com/admin/workspaces/a'
        );
        expect(appLink('https://example.com/admin/', 'workspaces/a?x=1')).toBe(
            'https://example.com/admin/workspaces/a?x=1'
        );
    });
});
