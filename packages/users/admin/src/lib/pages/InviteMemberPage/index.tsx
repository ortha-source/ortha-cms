import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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
import type { MemberRole } from '../../types/member';

const messages = defineMessages({
    title: { id: 'users.invitePage.title', defaultMessage: 'Invite a member' },
    subtitle: {
        id: 'users.invitePage.subtitle',
        defaultMessage:
            'Send an invite in two short steps. They join once they accept the emailed link.'
    },
    back: {
        id: 'users.invitePage.back',
        defaultMessage: 'Back to members'
    },
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
    stepAria: {
        id: 'users.invitePage.stepAria',
        defaultMessage: 'Step {number}: {label}'
    },
    // Step 1
    detailsTitle: {
        id: 'users.invitePage.detailsTitle',
        defaultMessage: 'Details'
    },
    detailsDescription: {
        id: 'users.invitePage.detailsDescription',
        defaultMessage: 'Where should the invite go?'
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
    continueToRole: {
        id: 'users.invitePage.continueToRole',
        defaultMessage: 'Continue to role'
    },
    // Step 2
    roleTitle: { id: 'users.invitePage.roleTitle', defaultMessage: 'Role' },
    roleDescription: {
        id: 'users.invitePage.roleDescription',
        defaultMessage: 'Pick the access level for this member.'
    },
    roleAdmin: { id: 'users.role.admin', defaultMessage: 'Admin' },
    roleAdminHint: {
        id: 'users.invitePage.roleAdminHint',
        defaultMessage: 'Full access, including managing members.'
    },
    roleContributor: {
        id: 'users.role.contributor',
        defaultMessage: 'Contributor'
    },
    roleContributorHint: {
        id: 'users.invitePage.roleContributorHint',
        defaultMessage: 'Read and contribute to workspace content.'
    },
    roleViewer: { id: 'users.role.viewer', defaultMessage: 'Viewer' },
    roleViewerHint: {
        id: 'users.invitePage.roleViewerHint',
        defaultMessage: 'Read-only access.'
    },
    back2: { id: 'users.invitePage.backLabel', defaultMessage: 'Back' },
    submit: {
        id: 'users.invitePage.submit',
        defaultMessage: 'Send invite'
    },
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

/**
 * Full-page, two-step invite wizard (Details → Role) at `/users/invite`, built
 * on the design-system wizard chrome. Gated on `users:create` — the server
 * enforces the same — so a user without it is redirected to the list.
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

    const goStep = (next: number) => {
        setStep(next);
        setMaxReached((m) => Math.max(m, next));
    };

    const submit = async () => {
        try {
            const created = await invite.mutateAsync({
                email: email.trim(),
                role,
                name: name.trim() || undefined
            });
            toast(intl.formatMessage(messages.sent, { email: created.email }));
            navigate('/users');
        } catch {
            // The error alert on the role step explains; the user can go back
            // and fix the email, then retry.
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
        }
    ];

    return (
        <Container className="max-w-[720px]">
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
                    ) : (
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
                                    onBack={() => goStep(1)}
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
                    )}
                </WizardStepCard>
            </div>
        </Container>
    );
}
