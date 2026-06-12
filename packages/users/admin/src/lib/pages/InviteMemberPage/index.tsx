import { useState, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { HTTP_STATUS } from '@ortha-cms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Checkbox,
    Container,
    ContainerHeader,
    FieldGroup,
    InputField,
    Label,
    RadioGroup,
    RadioGroupItem,
    Spinner,
    Stepper,
    WizardFooter,
    WizardStepCard,
    cn,
    toast
} from '@ortha-cms/design-system';
import { useInviteMember } from '../../api/useInviteMember';
import { useWorkspaceOptions } from '../../api/useWorkspaceOptions';
import { MemberAvatar } from '../../components/MemberAvatar';
import type { MemberRole } from '../../types/member';

const messages = defineMessages({
    title: { id: 'users.invitePage.title', defaultMessage: 'Invite a member' },
    subtitle: {
        id: 'users.invitePage.subtitle',
        defaultMessage:
            'Add someone to Ortha in three short steps: who they are, what they can do, and which workspaces they can reach.'
    },
    back: { id: 'users.invitePage.back', defaultMessage: 'Back to members' },
    // Rail
    stepDetails: {
        id: 'users.invitePage.stepDetails',
        defaultMessage: 'Details'
    },
    stepDetailsHint: {
        id: 'users.invitePage.stepDetailsHint',
        defaultMessage: 'Who you’re inviting'
    },
    stepRole: { id: 'users.invitePage.stepRole', defaultMessage: 'Role' },
    stepRoleHint: {
        id: 'users.invitePage.stepRoleHint',
        defaultMessage: 'What they can do'
    },
    stepWorkspaces: {
        id: 'users.invitePage.stepWorkspaces',
        defaultMessage: 'Workspaces'
    },
    stepWorkspacesHint: {
        id: 'users.invitePage.stepWorkspacesHint',
        defaultMessage: 'What they can reach'
    },
    stepAria: {
        id: 'users.invitePage.stepAria',
        defaultMessage: 'Step {number}: {label}'
    },
    summaryAccess: {
        id: 'users.invitePage.summaryAccess',
        defaultMessage:
            '{count, plural, =0 {No workspaces} one {# workspace} other {# workspaces}}'
    },
    // Step 1 — Details
    detailsTitle: {
        id: 'users.invitePage.detailsTitle',
        defaultMessage: 'Who are you inviting?'
    },
    detailsDescription: {
        id: 'users.invitePage.detailsDescription',
        defaultMessage:
            'We’ll send a join link to this address. A name is optional — they can set their own when they accept.'
    },
    emailLabel: { id: 'users.invitePage.emailLabel', defaultMessage: 'Email' },
    emailInvalid: {
        id: 'users.invitePage.emailInvalid',
        defaultMessage: 'Enter a valid email address'
    },
    nameLabel: {
        id: 'users.invitePage.nameLabel',
        defaultMessage: 'Name (optional)'
    },
    detailsInfo: {
        id: 'users.invitePage.detailsInfo',
        defaultMessage:
            'Until they accept the invite, they appear in the members list as “Invited” and can’t sign in. You can resend or revoke the invite anytime.'
    },
    continueToRole: {
        id: 'users.invitePage.continueToRole',
        defaultMessage: 'Continue to role'
    },
    // Step 2 — Role
    roleTitle: {
        id: 'users.invitePage.roleTitle',
        defaultMessage: 'What can they do?'
    },
    roleDescription: {
        id: 'users.invitePage.roleDescription',
        defaultMessage: 'Pick the access level for this member.'
    },
    roleAdmin: { id: 'users.role.admin', defaultMessage: 'Admin' },
    roleAdminHint: {
        id: 'users.invitePage.roleAdminHint',
        defaultMessage:
            'Full access — manage members and roles, and reach every workspace.'
    },
    roleContributor: {
        id: 'users.role.contributor',
        defaultMessage: 'Contributor'
    },
    roleContributorHint: {
        id: 'users.invitePage.roleContributorHint',
        defaultMessage:
            'Create and edit content in the workspaces they’re assigned to.'
    },
    roleViewer: { id: 'users.role.viewer', defaultMessage: 'Viewer' },
    roleViewerHint: {
        id: 'users.invitePage.roleViewerHint',
        defaultMessage: 'Read-only access to assigned workspaces.'
    },
    roleInfo: {
        id: 'users.invitePage.roleInfo',
        defaultMessage:
            'A member has one global role that applies across Ortha — it isn’t set per workspace. You can change it later from the members list.'
    },
    continueToWorkspaces: {
        id: 'users.invitePage.continueToWorkspaces',
        defaultMessage: 'Continue to workspaces'
    },
    // Step 3 — Workspaces
    workspacesTitle: {
        id: 'users.invitePage.workspacesTitle',
        defaultMessage: 'Which workspaces can they reach?'
    },
    workspacesDescription: {
        id: 'users.invitePage.workspacesDescription',
        defaultMessage:
            'Select the workspaces to add this member to. You can leave this empty and assign access later.'
    },
    workspacesInfo: {
        id: 'users.invitePage.workspacesInfo',
        defaultMessage:
            'Membership only controls which workspaces a person can reach — what they can do inside one comes from their role above. You can change access anytime from a workspace.'
    },
    workspacesEmpty: {
        id: 'users.invitePage.workspacesEmpty',
        defaultMessage:
            'There are no workspaces yet. You can invite this member now and assign access once a workspace exists.'
    },
    workspacesError: {
        id: 'users.invitePage.workspacesError',
        defaultMessage: 'Couldn’t load workspaces. Try again in a moment.'
    },
    selectedCount: {
        id: 'users.invitePage.selectedCount',
        defaultMessage:
            '{count, plural, =0 {None selected} one {# selected} other {# selected}}'
    },
    back2: { id: 'users.invitePage.backLabel', defaultMessage: 'Back' },
    submit: { id: 'users.invitePage.submit', defaultMessage: 'Send invite' },
    submitting: {
        id: 'users.invitePage.submitting',
        defaultMessage: 'Sending invite…'
    },
    emailTaken: {
        id: 'users.invitePage.emailTaken',
        defaultMessage: 'A member with this email already exists.'
    },
    failed: {
        id: 'users.invitePage.failed',
        defaultMessage: 'Couldn’t send the invite. Please try again.'
    },
    sent: {
        id: 'users.invitePage.sent',
        defaultMessage: 'Invite sent to {email}'
    }
});

const EMAIL = z.email();

/** A muted, icon-led note for the extra context shown on each step. */
function InfoNote({ children }: { children: ReactNode }) {
    return (
        <div className="mt-4 flex gap-2.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{children}</p>
        </div>
    );
}

/**
 * Full-page, three-step invite wizard (Details → Role → Workspaces) at
 * `/users/invite`, on the design-system wizard chrome. Gated on `users:create`
 * — the server enforces the same — so a user without it is redirected.
 */
export function InviteMemberPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const canInvite = useHasPermission('users:create');
    const invite = useInviteMember();

    const [step, setStep] = useState(1);
    const [maxReached, setMaxReached] = useState(1);
    const [email, setEmail] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const [name, setName] = useState('');
    const [role, setRole] = useState<MemberRole>('viewer');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Prefetch the workspace list once the user has moved past the first step.
    const workspaces = useWorkspaceOptions(canInvite && maxReached >= 2);

    if (!canInvite) {
        return <Navigate to="/users" replace />;
    }

    const emailValid = EMAIL.safeParse(email.trim()).success;
    const emailError =
        emailTouched && !emailValid
            ? intl.formatMessage(messages.emailInvalid)
            : undefined;

    const roles: { value: MemberRole; label: string; hint: string }[] = [
        {
            value: 'admin',
            label: intl.formatMessage(messages.roleAdmin),
            hint: intl.formatMessage(messages.roleAdminHint)
        },
        {
            value: 'contributor',
            label: intl.formatMessage(messages.roleContributor),
            hint: intl.formatMessage(messages.roleContributorHint)
        },
        {
            value: 'viewer',
            label: intl.formatMessage(messages.roleViewer),
            hint: intl.formatMessage(messages.roleViewerHint)
        }
    ];
    const roleLabel = roles.find((r) => r.value === role)?.label;
    const options = workspaces.data ?? [];

    const goStep = (next: number) => {
        setStep(next);
        setMaxReached((m) => Math.max(m, next));
    };

    const toggleWorkspace = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    };

    const submit = async () => {
        try {
            const created = await invite.mutateAsync({
                email: email.trim(),
                role,
                name: name.trim() || undefined,
                workspaceIds: [...selected]
            });
            toast(intl.formatMessage(messages.sent, { email: created.email }));
            navigate('/users');
        } catch {
            // The error alert on this step explains; the user can go back and
            // fix the email, then retry.
        }
    };

    const errorMessage = invite.isError
        ? invite.error.status === HTTP_STATUS.CONFLICT
            ? intl.formatMessage(messages.emailTaken)
            : intl.formatMessage(messages.failed)
        : null;

    const railSteps = [
        {
            label: intl.formatMessage(messages.stepDetails),
            hint: intl.formatMessage(messages.stepDetailsHint),
            summary: email.trim() || undefined
        },
        {
            label: intl.formatMessage(messages.stepRole),
            hint: intl.formatMessage(messages.stepRoleHint),
            summary: roleLabel
        },
        {
            label: intl.formatMessage(messages.stepWorkspaces),
            hint: intl.formatMessage(messages.stepWorkspacesHint),
            optional: true,
            summary: intl.formatMessage(messages.summaryAccess, {
                count: selected.size
            })
        }
    ];

    return (
        <Container className="max-w-[760px]">
            <Link
                to="/users"
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="size-4" />
                {intl.formatMessage(messages.back)}
            </Link>

            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle)}
            />

            <div className="grid gap-8 lg:grid-cols-[244px_1fr]">
                <div className="lg:sticky lg:top-6 lg:self-start">
                    <Stepper
                        current={step}
                        maxReached={maxReached}
                        steps={railSteps}
                        onStepClick={goStep}
                        stepAriaLabel={(s, number) =>
                            intl.formatMessage(messages.stepAria, {
                                number,
                                label: s.label
                            })
                        }
                    />
                </div>

                <WizardStepCard key={step}>
                    {step === 1 ? (
                        <>
                            <CardHeader>
                                <CardTitle>
                                    {intl.formatMessage(messages.detailsTitle)}
                                </CardTitle>
                                <CardDescription>
                                    {intl.formatMessage(
                                        messages.detailsDescription
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <InputField
                                        id="invite-email"
                                        type="email"
                                        label={intl.formatMessage(
                                            messages.emailLabel
                                        )}
                                        value={email}
                                        autoComplete="off"
                                        onBlur={() => setEmailTouched(true)}
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        errors={
                                            emailError
                                                ? [{ message: emailError }]
                                                : undefined
                                        }
                                    />
                                    <InputField
                                        id="invite-name"
                                        label={intl.formatMessage(
                                            messages.nameLabel
                                        )}
                                        value={name}
                                        autoComplete="off"
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                    />
                                </FieldGroup>
                                <InfoNote>
                                    {intl.formatMessage(messages.detailsInfo)}
                                </InfoNote>
                            </CardContent>
                            <CardFooter>
                                <WizardFooter
                                    primary={
                                        <Button
                                            type="button"
                                            onClick={() => goStep(2)}
                                            disabled={!emailValid}
                                        >
                                            {intl.formatMessage(
                                                messages.continueToRole
                                            )}
                                            <ArrowRight />
                                        </Button>
                                    }
                                />
                            </CardFooter>
                        </>
                    ) : null}

                    {step === 2 ? (
                        <>
                            <CardHeader>
                                <CardTitle>
                                    {intl.formatMessage(messages.roleTitle)}
                                </CardTitle>
                                <CardDescription>
                                    {intl.formatMessage(
                                        messages.roleDescription
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup
                                    value={role}
                                    onValueChange={(value) =>
                                        setRole(value as MemberRole)
                                    }
                                    className="gap-3"
                                >
                                    {roles.map((option) => (
                                        <Label
                                            key={option.value}
                                            htmlFor={`invite-role-${option.value}`}
                                            className={cn(
                                                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-accent',
                                                role === option.value &&
                                                    'border-primary'
                                            )}
                                        >
                                            <RadioGroupItem
                                                id={`invite-role-${option.value}`}
                                                value={option.value}
                                                aria-label={option.label}
                                                className="mt-0.5"
                                            />
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium">
                                                    {option.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {option.hint}
                                                </span>
                                            </span>
                                        </Label>
                                    ))}
                                </RadioGroup>
                                <InfoNote>
                                    {intl.formatMessage(messages.roleInfo)}
                                </InfoNote>
                            </CardContent>
                            <CardFooter>
                                <WizardFooter
                                    onBack={() => goStep(1)}
                                    backLabel={intl.formatMessage(
                                        messages.back2
                                    )}
                                    primary={
                                        <Button
                                            type="button"
                                            onClick={() => goStep(3)}
                                        >
                                            {intl.formatMessage(
                                                messages.continueToWorkspaces
                                            )}
                                            <ArrowRight />
                                        </Button>
                                    }
                                />
                            </CardFooter>
                        </>
                    ) : null}

                    {step === 3 ? (
                        <>
                            <CardHeader>
                                <CardTitle>
                                    {intl.formatMessage(
                                        messages.workspacesTitle
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    {intl.formatMessage(
                                        messages.workspacesDescription
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {workspaces.isPending ? (
                                    <div className="flex justify-center py-8">
                                        <Spinner />
                                    </div>
                                ) : workspaces.isError ? (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {intl.formatMessage(
                                                messages.workspacesError
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                ) : options.length === 0 ? (
                                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.workspacesEmpty
                                        )}
                                    </p>
                                ) : (
                                    <>
                                        <div
                                            role="group"
                                            className="flex max-h-[320px] flex-col gap-2 overflow-y-auto"
                                        >
                                            {options.map((workspace) => (
                                                <Label
                                                    key={workspace.id}
                                                    htmlFor={`invite-ws-${workspace.id}`}
                                                    className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent"
                                                >
                                                    <Checkbox
                                                        id={`invite-ws-${workspace.id}`}
                                                        aria-label={
                                                            workspace.name
                                                        }
                                                        checked={selected.has(
                                                            workspace.id
                                                        )}
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            toggleWorkspace(
                                                                workspace.id,
                                                                checked === true
                                                            )
                                                        }
                                                    />
                                                    <MemberAvatar
                                                        initials={
                                                            workspace.initials
                                                        }
                                                        color={workspace.color}
                                                        className="size-7 text-[10px]"
                                                    />
                                                    <span className="truncate text-sm font-medium">
                                                        {workspace.name}
                                                    </span>
                                                </Label>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {intl.formatMessage(
                                                messages.selectedCount,
                                                { count: selected.size }
                                            )}
                                        </p>
                                    </>
                                )}

                                <InfoNote>
                                    {intl.formatMessage(messages.workspacesInfo)}
                                </InfoNote>

                                {errorMessage ? (
                                    <Alert
                                        variant="destructive"
                                        className="mt-4"
                                    >
                                        <AlertDescription>
                                            {errorMessage}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </CardContent>
                            <CardFooter>
                                <WizardFooter
                                    onBack={() => goStep(2)}
                                    backLabel={intl.formatMessage(
                                        messages.back2
                                    )}
                                    primary={
                                        <Button
                                            type="button"
                                            onClick={submit}
                                            disabled={invite.isPending}
                                        >
                                            {invite.isPending ? (
                                                <>
                                                    <Spinner aria-hidden />
                                                    <span className="sr-only">
                                                        {intl.formatMessage(
                                                            messages.submitting
                                                        )}
                                                    </span>
                                                </>
                                            ) : null}
                                            {intl.formatMessage(messages.submit)}
                                        </Button>
                                    }
                                />
                            </CardFooter>
                        </>
                    ) : null}
                </WizardStepCard>
            </div>
        </Container>
    );
}
