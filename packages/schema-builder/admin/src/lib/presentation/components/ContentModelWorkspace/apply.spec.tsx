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
import { article, author, envelopeOf } from '../../../../testing/document';
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
vi.mock('@orthacms/shell-admin', () => ({ PageTopBar: () => null }));
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

/** Makes a draft change (a new type), then opens the review page. */
function addTypeAndReview() {
    fireEvent.click(screen.getByRole('button', { name: 'New content type' }));
    const dialog = screen.getByRole('dialog', { name: 'New content type' });
    fireEvent.change(within(dialog).getByLabelText('Label'), {
        target: { value: 'Events' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    expect(
        screen.getByRole('heading', { level: 1, name: 'Review changes' })
    ).toBeTruthy();
}

const button = (name: string) =>
    screen.getByRole('button', { name }) as HTMLButtonElement;

/** Waits for the plan, then walks to the last step. */
async function toApplyStep() {
    await waitFor(() =>
        expect(button('Continue to files').disabled).toBe(false)
    );
    fireEvent.click(button('Continue to files'));
    fireEvent.click(button('Continue to apply'));
    expect(
        screen.getByRole('heading', { level: 2, name: 'Apply' })
    ).toBeTruthy();
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

    it('opens a page with steps: a skeleton while the plan is made, then the changes, the files and the SQL', async () => {
        let answer: (plan: SchemaPlan) => void = () => undefined;
        gateway.plan.mockReturnValue(
            new Promise((resolve) => (answer = resolve))
        );
        renderWorkspace();
        addTypeAndReview();

        expect(screen.getByText('Checking your changes…')).toBeTruthy();
        expect(button('Continue to files').disabled).toBe(true);
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
        const list = await screen.findByRole('list', { name: 'Changes' });
        expect(within(list).getByText('Safe')).toBeTruthy();

        fireEvent.click(button('Continue to files'));
        expect(
            screen.getByRole('heading', { level: 2, name: 'Files and SQL' })
        ).toBeTruthy();
        expect(
            screen.getByText('src/content/collections/events.ts')
        ).toBeTruthy();
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'SQL' }));
        expect(await screen.findByText(/CREATE TABLE "events"/)).toBeTruthy();

        fireEvent.click(button('Continue to apply'));
        expect(
            (screen.getByLabelText('Migration name') as HTMLInputElement).value
        ).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(button('Apply').disabled).toBe(false);
        expect(gateway.apply).not.toHaveBeenCalled();
    });

    it('holds the first step until every change that deletes data is confirmed, one by one', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent, dropAuthor]));
        renderWorkspace();
        addTypeAndReview();
        const confirm = await screen.findByRole('checkbox', {
            name: 'I understand this deletes data'
        });

        expect(button('Continue to files').disabled).toBe(true);
        expect(
            screen.getByText('Confirm the change that deletes data.')
        ).toBeTruthy();
        fireEvent.click(confirm);
        expect(button('Continue to files').disabled).toBe(false);
    });

    it('refuses a migration name drizzle-kit would not take', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        renderWorkspace();
        addTypeAndReview();
        await toApplyStep();

        fireEvent.change(screen.getByLabelText('Migration name'), {
            target: { value: 'Add Events!' }
        });
        expect(button('Apply').disabled).toBe(true);
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

        expect(await screen.findByText('Not applied')).toBeTruthy();
        expect(
            screen.getByText(
                'Some changes cannot be applied. Undo them to continue.'
            )
        ).toBeTruthy();
        expect(button('Continue to files').disabled).toBe(true);
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

        fireEvent.click(
            screen.getByRole('link', { name: 'Back to the Content Model' })
        );
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content Model' })
        ).toBeTruthy();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
        expect(button('Review changes')).toBeTruthy();
    });

    it('applies, follows the restart, offers the new type to workspaces, then returns to the editor', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        gateway.apply.mockResolvedValue({
            operationId: 'op-1',
            bootId: 'boot'
        });
        gateway.operation
            .mockResolvedValueOnce(operation({ step: 'migrate' }))
            .mockResolvedValue(operation({ status: 'succeeded', step: null }));
        // The old process answers once, then is gone, then the new one answers.
        gateway.document
            .mockResolvedValueOnce(envelope)
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValue({ ...envelope, bootId: 'boot-2' });
        gateway.grant.mockResolvedValue(undefined);
        const client = renderWorkspace();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        addTypeAndReview();
        await toApplyStep();

        fireEvent.click(button('Apply'));

        const grant = await screen.findByRole('dialog', {
            name: 'Use the new type in workspaces'
        });
        expect(gateway.apply).toHaveBeenCalledWith(
            expect.objectContaining({
                baseFingerprint: envelope.fingerprint,
                confirmed: []
            })
        );
        expect(gateway.document).toHaveBeenCalledTimes(3);
        // Behind the modal grant offer, the card reports the outcome.
        expect(
            screen.getByText('The content model is live', { exact: false })
        ).toBeTruthy();
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({ predicate: expect.any(Function) })
        );

        // Searchable: a query narrows the tiles, and says so when nothing matches.
        fireEvent.change(within(grant).getByRole('searchbox'), {
            target: { value: 'zzz' }
        });
        expect(
            within(grant).getByText('No workspace matches “zzz”.')
        ).toBeTruthy();
        fireEvent.change(within(grant).getByRole('searchbox'), {
            target: { value: 'mark' }
        });
        // Only active workspaces are offered.
        expect(within(grant).queryByLabelText('Old site')).toBeNull();
        const grantButton = within(grant).getByRole('button', {
            name: 'Grant'
        }) as HTMLButtonElement;
        expect(grantButton.disabled).toBe(true);
        const marketing = within(grant).getByRole('checkbox', {
            name: 'Marketing'
        });
        fireEvent.click(marketing);
        expect(marketing.getAttribute('aria-checked')).toBe('true');
        expect(within(grant).getByText('1 selected')).toBeTruthy();
        fireEvent.click(grantButton);
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', {
                    name: 'Use the new type in workspaces'
                })
            ).toBeNull()
        );
        expect(gateway.grant).toHaveBeenCalledWith('ws-1', 'events');

        fireEvent.click(button('Back to the Content Model'));
        // The restarted server's model is the page's now: nothing left to review.
        expect(
            screen.getByRole('heading', { level: 1, name: 'Content Model' })
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Review changes' })
        ).toBeNull();
    });

    it('grants nothing when the author says not now', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        gateway.apply.mockResolvedValue({
            operationId: 'op-1',
            bootId: 'boot'
        });
        gateway.operation.mockResolvedValue(
            operation({ status: 'succeeded', step: null })
        );
        gateway.document.mockResolvedValue({ ...envelope, bootId: 'boot-2' });
        renderWorkspace();
        addTypeAndReview();
        await toApplyStep();
        fireEvent.click(button('Apply'));

        const grant = await screen.findByRole('dialog', {
            name: 'Use the new type in workspaces'
        });
        fireEvent.click(within(grant).getByRole('button', { name: 'Not now' }));

        expect(
            screen.queryByRole('dialog', {
                name: 'Use the new type in workspaces'
            })
        ).toBeNull();
        expect(gateway.grant).not.toHaveBeenCalled();
    });

    it('reports a failed apply and goes back to the review with the draft kept', async () => {
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
        await toApplyStep();
        fireEvent.click(button('Apply'));

        const alert = await screen.findByRole('alert');
        expect(
            within(alert).getByText(/relation "event" already exists/)
        ).toBeTruthy();
        expect(gateway.document).not.toHaveBeenCalled();

        fireEvent.click(button('Back to the review'));
        expect(screen.queryByRole('alert')).toBeNull();
        // Back on the step the apply started from, ready to try again.
        expect(button('Apply').disabled).toBe(false);
        fireEvent.click(
            screen.getByRole('link', { name: 'Back to the Content Model' })
        );
        expect(screen.getByText('1 unsaved change')).toBeTruthy();
    });
});
