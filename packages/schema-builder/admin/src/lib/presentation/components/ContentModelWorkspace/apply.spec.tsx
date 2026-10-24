import type { ReactNode } from 'react';
import '../../../../testing/jsdomShims';
import {
    QueryClient,
    QueryClientProvider,
    useQuery
} from '@tanstack/react-query';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ApplyOperation,
    ClassifiedChange,
    SchemaPlan
} from '@orthacms/schema-builder-domain';
import { useHasPermission } from '@orthacms/identity-admin';
import { useWorkspaces } from '@orthacms/workspaces-admin';
import { ApiError } from '@orthacms/utils-admin';
import {
    article,
    author,
    envelopeOf,
    typeDoc
} from '../../../../testing/document';
import { httpSchemaGateway } from '../../../infrastructure/httpSchemaGateway';
import { schemaKeys } from '../../../infrastructure/schemaKeys';
import { ContentModelWorkspace } from './index';

vi.mock('../../../infrastructure/httpSchemaGateway', () => ({
    httpSchemaGateway: {
        document: vi.fn(),
        plan: vi.fn(),
        apply: vi.fn(),
        operation: vi.fn(),
        grant: vi.fn()
    }
}));
// Polls without waiting: the specs drive the order of answers, not the clock.
vi.mock('../../../application/polling', () => ({
    sleep: () => Promise.resolve()
}));
vi.mock('@orthacms/identity-admin', () => ({ useHasPermission: vi.fn() }));
vi.mock('@orthacms/shell-admin', () => ({
    PageTopBar: () => null,
    PageActionsPortal: ({ children }: { children: ReactNode }) => children
}));
vi.mock('@orthacms/workspaces-admin', () => ({
    useWorkspaces: vi.fn(),
    WorkspaceAvatar: () => null,
    workspacesKey: ['workspaces'],
    workspaceContentAccessRoot: ['workspace-content-access']
}));

const gateway = vi.mocked(httpSchemaGateway);
const editable = { editable: true, restart: 'watch' } as const;
const envelope = envelopeOf(
    [
        { ...article, origin: 'builder' },
        { ...author, origin: 'builder' }
    ],
    editable
);

/** What the restarted server serves: the model with the new type in it. */
const restarted = {
    ...envelopeOf(
        [
            ...envelope.document.types,
            typeDoc({ name: 'events', label: 'Events', origin: 'builder' })
        ],
        editable
    ),
    bootId: 'boot-2'
};

const change = (
    over: Partial<ClassifiedChange> & Pick<ClassifiedChange, 'change'>
): ClassifiedChange => ({
    id: `${over.change.kind}:${over.change.type}`,
    safety: 'safe',
    reason: 'new-type',
    storage: true,
    ...over
});

const addEvent = change({ change: { kind: 'type.add', type: 'events' } });
const dropAuthor = change({
    id: 'type.remove:author',
    change: { kind: 'type.remove', type: 'author' },
    safety: 'destructive',
    reason: 'drops-data'
});

const planOf = (
    changes: ClassifiedChange[],
    over: Partial<SchemaPlan> = {}
): SchemaPlan => ({
    baseFingerprint: envelope.fingerprint,
    changes,
    blocked: false,
    files: [
        {
            path: 'collections/events.ts',
            before: null,
            after: "export const events = collection('events', {});\n"
        }
    ],
    sql: ['CREATE TABLE "events" ("id" uuid PRIMARY KEY);'],
    ...over
});

const operation = (over: Partial<ApplyOperation>): ApplyOperation => ({
    id: 'op-1',
    status: 'running',
    step: 'generate',
    migrations: [],
    files: [],
    bootId: 'boot',
    startedAt: '2026-10-04T00:00:00.000Z',
    ...over
});

/** The envelope through the query cache, as the page passes it — so a restart reaches the workspace. */
function Served() {
    const { data } = useQuery({
        queryKey: schemaKeys.document(),
        queryFn: () => envelope,
        initialData: envelope,
        staleTime: Infinity
    });
    return <ContentModelWorkspace envelope={data} />;
}

function renderWorkspace() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    render(
        <QueryClientProvider client={client}>
            <IntlProvider locale="en">
                <MemoryRouter initialEntries={['/content-model/article']}>
                    <Routes>
                        <Route
                            path="/content-model/:typeName?"
                            element={<Served />}
                        />
                    </Routes>
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
    return client;
}

/** Makes a draft change (a new type with a field), then opens the review page. */
function addTypeAndReview() {
    fireEvent.click(screen.getByRole('button', { name: 'New content type' }));
    const dialog = screen.getByRole('dialog', { name: 'New content type' });
    fireEvent.change(within(dialog).getByLabelText('Name'), {
        target: { value: 'Events' }
    });
    // A type needs a field before it can be reviewed: start from a template.
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Event/ }));
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Create type' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    expect(
        screen.getByRole('heading', { level: 1, name: /^Review/ })
    ).toBeTruthy();
}

const button = (name: string | RegExp) =>
    screen.getByRole('button', { name }) as HTMLButtonElement;
const applyButton = () => button(/^Apply \d/);

/** Waits for the plan, then for Apply to be on. */
async function toApply() {
    await waitFor(() => expect(applyButton().disabled).toBe(false));
}

describe('ContentModelWorkspace — review and apply', () => {
    beforeEach(() => {
        vi.mocked(useHasPermission).mockReturnValue(true);
        vi.mocked(useWorkspaces).mockReturnValue({
            data: [
                { id: 'ws-1', name: 'Marketing', status: 'Active' },
                { id: 'ws-2', name: 'Old site', status: 'Archived' }
            ]
        } as unknown as ReturnType<typeof useWorkspaces>);
        for (const fn of Object.values(gateway)) fn.mockReset();
    });

    it('reviews on one page: a skeleton while the plan is made, then the changes by type, the files and SQL folded, and Apply at the foot', async () => {
        let answer: (plan: SchemaPlan) => void = () => undefined;
        gateway.plan.mockReturnValue(
            new Promise((resolve) => (answer = resolve))
        );
        renderWorkspace();
        addTypeAndReview();

        expect(screen.getByText('Checking your changes…')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Apply \d/ })).toBeNull();
        // The plan is made against the draft and the fingerprint it started from.
        await waitFor(() =>
            expect(gateway.plan).toHaveBeenCalledWith(
                expect.objectContaining({
                    types: expect.arrayContaining([
                        expect.objectContaining({ name: 'events' })
                    ])
                }),
                envelope.fingerprint
            )
        );

        answer(planOf([addEvent]));
        const events = await screen.findByRole('region', { name: 'Events' });
        expect(within(events).getByText('New collection')).toBeTruthy();
        expect(within(events).getByText('Safe')).toBeTruthy();
        expect(
            screen.getByRole('heading', { level: 1, name: 'Review 1 change' })
        ).toBeTruthy();

        fireEvent.click(button(/Technical details/));
        expect(
            screen.getByText('src/content/collections/events.ts')
        ).toBeTruthy();
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'SQL' }));
        expect(await screen.findByText(/CREATE TABLE "events"/)).toBeTruthy();

        expect(
            (screen.getByLabelText('Migration name') as HTMLInputElement).value
        ).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(applyButton().disabled).toBe(false);
        expect(applyButton().textContent).toBe('Apply 1 change');
        expect(gateway.apply).not.toHaveBeenCalled();
    });

    it('holds Apply until every change that deletes data is confirmed, one by one', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent, dropAuthor]));
        renderWorkspace();
        addTypeAndReview();
        const confirm = await screen.findByRole('checkbox', {
            name: 'I understand this deletes data'
        });
        // The card of the type it deletes says so.
        expect(
            within(screen.getByRole('region', { name: 'author' })).getByText(
                'Deletes data'
            )
        ).toBeTruthy();

        expect(applyButton().disabled).toBe(true);
        expect(
            screen.getByText('Confirm the change that deletes data.')
        ).toBeTruthy();
        fireEvent.click(confirm);
        expect(applyButton().disabled).toBe(false);
    });

    it('refuses a migration name drizzle-kit would not take', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        renderWorkspace();
        addTypeAndReview();
        await toApply();

        fireEvent.change(screen.getByLabelText('Migration name'), {
            target: { value: 'Add Events!' }
        });
        expect(applyButton().disabled).toBe(true);
        expect(screen.getByText(/lowercase letters/)).toBeTruthy();
    });

    it('says why a blocked plan cannot go further', async () => {
        gateway.plan.mockResolvedValue(
            planOf(
                [
                    change({
                        id: 'field.rename:article.title',
                        change: {
                            kind: 'field.rename',
                            type: 'article',
                            from: 'title',
                            to: 'headline'
                        },
                        safety: 'blocked',
                        reason: 'rename-unsupported'
                    })
                ],
                { blocked: true, files: [], sql: [] }
            )
        );
        renderWorkspace();
        addTypeAndReview();

        expect((await screen.findAllByText('Not applied')).length).toBe(2);
        expect(
            screen.getByText(
                'Some changes cannot be applied. Undo them to continue.'
            )
        ).toBeTruthy();
        expect(applyButton().disabled).toBe(true);
    });

    it('asks for a reload when the model changed under the draft', async () => {
        gateway.plan.mockRejectedValue(
            new ApiError(409, 'The document changed.')
        );
        renderWorkspace();
        addTypeAndReview();

        expect(
            await screen.findByText(/The content model changed/)
        ).toBeTruthy();
        expect(button('Reload')).toBeTruthy();
    });

    it('goes back to the editor with the draft as it was', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        renderWorkspace();
        addTypeAndReview();

        fireEvent.click(screen.getByRole('link', { name: 'Back to editing' }));
        expect(
            screen.getByRole('heading', { level: 1, name: 'Events' })
        ).toBeTruthy();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
        expect(button('Review changes')).toBeTruthy();
    });

    it('applies, follows the steps and the restart, offers the new type to workspaces on the page, then returns to the editor', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        gateway.apply.mockResolvedValue({
            operationId: 'op-1',
            bootId: 'boot'
        });
        gateway.operation
            .mockResolvedValueOnce(operation({ step: 'migrate' }))
            .mockResolvedValue(
                operation({
                    status: 'succeeded',
                    step: null,
                    migrations: ['0007_add_events.sql']
                })
            );
        // The old process answers once, then is gone, then the new one answers.
        gateway.document
            .mockResolvedValueOnce(envelope)
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValue(restarted);
        gateway.grant.mockResolvedValue(undefined);
        const client = renderWorkspace();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        addTypeAndReview();
        await toApply();

        fireEvent.click(applyButton());
        expect(
            screen.getByRole('heading', { level: 1, name: 'Applying 1 change' })
        ).toBeTruthy();
        expect(
            within(screen.getByRole('status')).getAllByRole('listitem')
        ).toHaveLength(5);

        expect(
            await screen.findByRole('heading', { level: 1, name: 'Applied' })
        ).toBeTruthy();
        expect(screen.getByText(/migration 0007_add_events\.sql/)).toBeTruthy();
        expect(gateway.apply).toHaveBeenCalledWith(
            expect.objectContaining({
                baseFingerprint: envelope.fingerprint,
                confirmed: []
            })
        );
        expect(gateway.document).toHaveBeenCalledTimes(3);
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({ predicate: expect.any(Function) })
        );

        // The grant is on the page, not in a modal over it.
        const grant = screen.getByRole('region', {
            name: 'Use Events in workspaces'
        });
        // Only active workspaces are offered.
        expect(
            within(grant).queryByRole('checkbox', { name: 'Old site' })
        ).toBeNull();
        expect(
            (
                within(grant).getByRole('button', {
                    name: 'Grant'
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        const marketing = within(grant).getByRole('checkbox', {
            name: 'Marketing'
        });
        fireEvent.click(marketing);
        expect(marketing.getAttribute('aria-checked')).toBe('true');
        fireEvent.click(
            within(grant).getByRole('button', { name: 'Grant to 1 workspace' })
        );
        expect(
            await screen.findByText('Events can be used in 1 workspace now.')
        ).toBeTruthy();
        expect(gateway.grant).toHaveBeenCalledWith('ws-1', 'events');

        fireEvent.click(button('Back to the Content Model'));
        // Back where the review was opened from — the new type, served now:
        // nothing left to review.
        expect(
            screen.getByRole('heading', { level: 1, name: 'Events' })
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Review changes' })
        ).toBeNull();
    });

    it('offers a search over many workspaces, and grants nothing when the author says not now', async () => {
        vi.mocked(useWorkspaces).mockReturnValue({
            data: Array.from({ length: 8 }, (_, index) => ({
                id: `ws-${index}`,
                name: `Site ${index}`,
                status: 'Active'
            }))
        } as unknown as ReturnType<typeof useWorkspaces>);
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        gateway.apply.mockResolvedValue({
            operationId: 'op-1',
            bootId: 'boot'
        });
        gateway.operation.mockResolvedValue(
            operation({ status: 'succeeded', step: null })
        );
        gateway.document.mockResolvedValue(restarted);
        renderWorkspace();
        addTypeAndReview();
        await toApply();
        fireEvent.click(applyButton());

        const grant = await screen.findByRole('region', {
            name: 'Use Events in workspaces'
        });
        fireEvent.change(within(grant).getByRole('searchbox'), {
            target: { value: 'zzz' }
        });
        expect(
            within(grant).getByText('No workspace matches “zzz”.')
        ).toBeTruthy();
        fireEvent.click(within(grant).getByRole('button', { name: 'Not now' }));

        expect(
            screen.queryByRole('region', { name: 'Use Events in workspaces' })
        ).toBeNull();
        expect(screen.getByText(/Not granted/)).toBeTruthy();
        expect(gateway.grant).not.toHaveBeenCalled();
        // The new type is a click away.
        fireEvent.click(button('Open Events in the model'));
        expect(
            screen.getByRole('heading', { level: 1, name: 'Events' })
        ).toBeTruthy();
    });

    it('reports a failed apply at its step and goes back to the review with the draft kept', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        gateway.apply.mockResolvedValue({
            operationId: 'op-1',
            bootId: 'boot'
        });
        gateway.operation.mockResolvedValue(
            operation({
                status: 'failed',
                step: 'migrate',
                error: {
                    code: 'schema-builder.migrate-failed',
                    message: 'relation "event" already exists.'
                }
            })
        );
        renderWorkspace();
        addTypeAndReview();
        await toApply();
        fireEvent.click(applyButton());

        const alert = await screen.findByRole('alert');
        expect(
            within(alert).getByText(/relation "event" already exists/)
        ).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'The change was not applied'
            })
        ).toBeTruthy();
        expect(gateway.document).not.toHaveBeenCalled();

        fireEvent.click(button('Back to the review'));
        expect(screen.queryByRole('alert')).toBeNull();
        // Back on the review, ready to try again.
        expect(applyButton().disabled).toBe(false);
        fireEvent.click(screen.getByRole('link', { name: 'Back to editing' }));
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
    });
});
