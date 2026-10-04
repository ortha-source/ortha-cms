import '../../../../testing/jsdomShims';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
                            element={
                                <ContentModelWorkspace envelope={envelope} />
                            }
                        />
                    </Routes>
                </MemoryRouter>
            </IntlProvider>
        </QueryClientProvider>
    );
    return client;
}

/** Makes a draft change (a new type), then opens the review. */
function addTypeAndReview() {
    fireEvent.click(screen.getByRole('button', { name: 'New content type' }));
    const dialog = screen.getByRole('dialog', { name: 'New content type' });
    fireEvent.change(within(dialog).getByLabelText('Label'), {
        target: { value: 'Events' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
    return screen.getByRole('dialog', { name: 'Review changes' });
}

const applyButton = (drawer: HTMLElement) =>
    within(drawer).getByRole('button', { name: 'Apply' }) as HTMLButtonElement;

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

    it('shows a skeleton while the plan is made, then the changes, files and SQL', async () => {
        let answer: (plan: SchemaPlan) => void = () => undefined;
        gateway.plan.mockReturnValue(
            new Promise((resolve) => (answer = resolve))
        );
        renderWorkspace();
        const drawer = addTypeAndReview();

        expect(within(drawer).getByRole('status')).toBeTruthy();
        expect(applyButton(drawer).disabled).toBe(true);
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
        const list = await within(drawer).findByRole('list', {
            name: 'Changes'
        });
        expect(within(list).getByText('Safe')).toBeTruthy();
        expect(
            (
                within(drawer).getByLabelText(
                    'Migration name'
                ) as HTMLInputElement
            ).value
        ).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(applyButton(drawer).disabled).toBe(false);

        fireEvent.mouseDown(within(drawer).getByRole('tab', { name: 'SQL' }));
        expect(
            await within(drawer).findByText(/CREATE TABLE "events"/)
        ).toBeTruthy();
    });

    it('holds Apply until every change that deletes data is confirmed, one by one', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent, dropAuthor]));
        renderWorkspace();
        const drawer = addTypeAndReview();
        const confirm = await within(drawer).findByRole('checkbox', {
            name: 'I understand this deletes data'
        });

        expect(applyButton(drawer).disabled).toBe(true);
        expect(
            within(drawer).getByText('Confirm the change that deletes data.')
        ).toBeTruthy();
        fireEvent.click(confirm);
        expect(applyButton(drawer).disabled).toBe(false);
    });

    it('refuses a migration name drizzle-kit would not take', async () => {
        gateway.plan.mockResolvedValue(planOf([addEvent]));
        renderWorkspace();
        const drawer = addTypeAndReview();
        const name = await within(drawer).findByLabelText('Migration name');

        fireEvent.change(name, { target: { value: 'Add Events!' } });
        expect(applyButton(drawer).disabled).toBe(true);
        expect(within(drawer).getByText(/lowercase letters/)).toBeTruthy();
    });

    it('says why a blocked plan cannot be applied, and offers no name', async () => {
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
        const drawer = addTypeAndReview();

        expect(await within(drawer).findByText('Not applied')).toBeTruthy();
        expect(within(drawer).queryByLabelText('Migration name')).toBeNull();
        expect(
            within(drawer).getByText(
                'Some changes cannot be applied. Undo them to continue.'
            )
        ).toBeTruthy();
        expect(applyButton(drawer).disabled).toBe(true);
    });

    it('asks for a reload when the model changed under the draft', async () => {
        gateway.plan.mockRejectedValue(
            new ApiError(409, 'The document changed.')
        );
        renderWorkspace();
        const drawer = addTypeAndReview();

        expect(
            await within(drawer).findByText(/The content model changed/)
        ).toBeTruthy();
        expect(
            within(drawer).getByRole('button', { name: 'Reload' })
        ).toBeTruthy();
    });

    it('applies, waits for the restart, then offers the new type to workspaces', async () => {
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
        const drawer = addTypeAndReview();
        await waitFor(() => expect(applyButton(drawer).disabled).toBe(false));

        fireEvent.click(applyButton(drawer));

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
        expect(screen.getByText('The content model is live')).toBeTruthy();
        // The new process served the model: the draft started over from it.
        expect(
            screen.queryByRole('button', {
                name: 'Review changes',
                hidden: true
            })
        ).toBeNull();
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({ predicate: expect.any(Function) })
        );

        // Only active workspaces are offered.
        expect(within(grant).queryByLabelText('Old site')).toBeNull();
        const grantButton = within(grant).getByRole('button', {
            name: 'Grant'
        }) as HTMLButtonElement;
        expect(grantButton.disabled).toBe(true);
        fireEvent.click(within(grant).getByLabelText('Marketing'));
        fireEvent.click(grantButton);

        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', {
                    name: 'Use the new type in workspaces'
                })
            ).toBeNull()
        );
        expect(gateway.grant).toHaveBeenCalledWith('ws-1', 'events');
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
        const drawer = addTypeAndReview();
        await waitFor(() => expect(applyButton(drawer).disabled).toBe(false));
        fireEvent.click(applyButton(drawer));

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

    it('reports a failed apply and keeps the draft', async () => {
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
        const drawer = addTypeAndReview();
        await waitFor(() => expect(applyButton(drawer).disabled).toBe(false));
        fireEvent.click(applyButton(drawer));

        const alert = await screen.findByRole('alert');
        expect(
            within(alert).getByText(/relation "event" already exists/)
        ).toBeTruthy();
        expect(gateway.document).not.toHaveBeenCalled();

        fireEvent.click(within(alert).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('alert')).toBeNull();
        // The draft is still there to fix and try again.
        expect(
            screen.getByRole('button', { name: 'Review changes' })
        ).toBeTruthy();
    });
});
