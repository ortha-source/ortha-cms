import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@ortha-cms/identity-admin';
import { initialsOf } from '@ortha-cms/utils-admin';
import type { AvatarColor } from '@ortha-cms/design-system';
import { useContentTypes } from '../../api/useContentTypes';
import { useCreateWorkspace } from '../../api/useCreateWorkspace';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import type {
    ContentMode,
    MemberDraft,
    ResourceSelection,
    WizardData,
    WizardSnapshot
} from '../../types/wizard';
import { buildCreateWorkspaceBody } from '../../utils/buildCreateWorkspaceBody';
import { count, EMPTY_SELECTION } from '../../utils/resourceSelection';
import { useBasicsSchema } from '../useBasicsSchema';

const STEP_PARAM = 'step';
const MIN_STEP = 1;
const MAX_STEP = 3;

/** Default accent color for a new workspace. */
const DEFAULT_COLOR: AvatarColor = 'slate';

const INITIAL_DATA: WizardData = {
    name: '',
    slug: '',
    slugEdited: false,
    description: '',
    color: DEFAULT_COLOR
};

const clampStep = (n: number) =>
    Math.min(MAX_STEP, Math.max(MIN_STEP, Number.isFinite(n) ? n : MIN_STEP));

/** The full controller returned by {@link useWizard}. */
export type WizardController = {
    /** Active step (1–3), mirrored to `?step=` and clamped. */
    step: number;
    /** Highest step the user has reached (gates rail navigation). */
    maxReached: number;
    /** Step 1 basics. */
    data: WizardData;
    /** Added members (excludes the implied owner). */
    members: MemberDraft[];
    /** Page-level content decision. */
    contentMode: ContentMode;
    /** Collection selection. */
    collections: ResourceSelection;
    /** Page selection. */
    pages: ResourceSelection;
    /** Whether the content-types list is still loading. */
    ctLoading: boolean;
    /** Whether the content-types list failed to load. */
    ctError: boolean;
    /** Navigate to a step (clamped); bumps {@link maxReached}. */
    goStep: (next: number) => void;
    /** Merge a partial patch into the basics data. */
    update: (patch: Partial<WizardData>) => void;
    /** Add a member if not already present. */
    addMember: (member: MemberDraft) => void;
    /** Remove a member by id. */
    removeMember: (id: string) => void;
    /** Set the page-level content mode. */
    setContentMode: (mode: ContentMode) => void;
    /** Replace the collection selection. */
    setCollections: (selection: ResourceSelection) => void;
    /** Replace the page selection. */
    setPages: (selection: ResourceSelection) => void;
    /** Whether the basics step passes shape validation (not availability). */
    basicsValid: boolean;
    /** Total members including the owner. */
    memberCount: number;
    /** Number of selected collections. */
    collectionCount: number;
    /** Number of selected pages. */
    pageCount: number;
    /** Submit the wizard. `override` replaces snapshot fields without mutating state. */
    submit: (override?: Partial<WizardSnapshot>) => Promise<Workspace>;
    /** Whether a submission is in flight. */
    submitting: boolean;
};

/**
 * Single source of truth for the create-workspace wizard: step (mirrored to the
 * `?step=` query param and clamped), the per-step form state, derived validity
 * and counts, and the submit action. Step bodies are presentational and read
 * everything from here, so state survives navigating between steps.
 */
export function useWizard(): WizardController {
    const [searchParams, setSearchParams] = useSearchParams();
    const step = clampStep(Number(searchParams.get(STEP_PARAM) ?? MIN_STEP));
    const [maxReached, setMaxReached] = useState(step);

    const [data, setData] = useState<WizardData>(INITIAL_DATA);
    const [members, setMembers] = useState<MemberDraft[]>([]);
    const [contentMode, setContentMode] = useState<ContentMode>('all');
    const [collections, setCollections] =
        useState<ResourceSelection>(EMPTY_SELECTION);
    const [pages, setPages] = useState<ResourceSelection>(EMPTY_SELECTION);

    const auth = useAuth();
    const user = 'user' in auth ? auth.user : undefined;
    const createMutation = useCreateWorkspace();
    const basicsSchema = useBasicsSchema();
    const contentTypes = useContentTypes();

    // Keep maxReached monotonic across deep-links and browser back/forward.
    useEffect(() => {
        setMaxReached((m) => Math.max(m, step));
    }, [step]);

    const allTypes = contentTypes.data ?? [];
    const collectionsTotal = allTypes.filter(
        (ct) => ct.kind === 'collection'
    ).length;
    const pagesTotal = allTypes.filter((ct) => ct.kind === 'single').length;

    const goStep = useCallback(
        (next: number) => {
            const clamped = clampStep(next);
            setMaxReached((m) => Math.max(m, clamped));
            setSearchParams({ [STEP_PARAM]: String(clamped) });
        },
        [setSearchParams]
    );

    const update = useCallback(
        (patch: Partial<WizardData>) =>
            setData((prev) => ({ ...prev, ...patch })),
        []
    );

    const addMember = useCallback((member: MemberDraft) => {
        setMembers((prev) =>
            prev.some((m) => m.id === member.id) ? prev : [...prev, member]
        );
    }, []);

    const removeMember = useCallback((id: string) => {
        setMembers((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const submit = useCallback(
        (override?: Partial<WizardSnapshot>) => {
            const snapshot: WizardSnapshot = {
                data,
                members,
                contentMode,
                collections,
                pages,
                ...override
            };
            const displayName = user?.name ?? user?.email ?? 'You';
            const creator: WorkspaceMember = {
                id: user?.id ?? 'me',
                name: displayName,
                email: user?.email ?? '',
                initials: initialsOf(displayName),
                color: snapshot.data.color,
                // The creator is the workspace owner; the server confirms this on
                // refetch, but the optimistic stub reflects it immediately.
                isOwner: true
            };
            return createMutation.mutateAsync({
                body: buildCreateWorkspaceBody(snapshot),
                creator
            });
        },
        [data, members, contentMode, collections, pages, user, createMutation]
    );

    return {
        step,
        maxReached,
        data,
        members,
        contentMode,
        collections,
        pages,
        ctLoading: contentTypes.isPending,
        ctError: contentTypes.isError,
        goStep,
        update,
        addMember,
        removeMember,
        setContentMode,
        setCollections,
        setPages,
        basicsValid: basicsSchema.safeParse({
            name: data.name,
            slug: data.slug,
            description: data.description
        }).success,
        memberCount: members.length + 1,
        collectionCount: count(collections, collectionsTotal),
        pageCount: count(pages, pagesTotal),
        submit,
        submitting: createMutation.isPending
    };
}
