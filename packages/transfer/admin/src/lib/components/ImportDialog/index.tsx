import { useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Upload } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label,
    RadioGroup,
    RadioGroupItem,
    Spinner,
    toast
} from '@orthacms/design-system';
import {
    CONFLICT_POLICY,
    type ConflictPolicy,
    type ImportPreview
} from '@orthacms/transfer-domain';
import { useImportPreview } from '../../api/useImportPreview';
import { useImportApply } from '../../api/useImportApply';
import { ImportVerdictList } from '../ImportVerdictList';

const messages = defineMessages({
    title: { id: 'transfer.import.title', defaultMessage: 'Import records' },
    description: {
        id: 'transfer.import.description',
        defaultMessage:
            'Choose a file exported from Ortha, or a CSV matching this collection’s columns. Nothing is written until you’ve seen what will change.'
    },
    file: { id: 'transfer.import.file', defaultMessage: 'File' },
    fileHint: {
        id: 'transfer.import.file.hint',
        defaultMessage: 'JSON, JSON Lines, CSV or a ZIP archive.'
    },
    template: {
        id: 'transfer.import.template',
        defaultMessage: 'Download a blank CSV with the right columns'
    },
    policy: {
        id: 'transfer.import.policy',
        defaultMessage: 'If a record is already here'
    },
    policySkip: {
        id: 'transfer.import.policy.skip',
        defaultMessage: 'Leave it alone'
    },
    policyUpdate: {
        id: 'transfer.import.policy.update',
        defaultMessage: 'Update it with the file’s values'
    },
    policyDuplicate: {
        id: 'transfer.import.policy.duplicate',
        defaultMessage: 'Add a second copy'
    },
    policyFail: {
        id: 'transfer.import.policy.fail',
        defaultMessage: 'Stop and import nothing'
    },
    check: { id: 'transfer.import.check', defaultMessage: 'Check the file' },
    checking: {
        id: 'transfer.import.checking',
        defaultMessage: 'Checking…'
    },
    summary: {
        id: 'transfer.import.summary',
        defaultMessage:
            '{create, plural, one {# to add} other {# to add}} · {update, plural, one {# to update} other {# to update}} · {skip, plural, one {# skipped} other {# skipped}} · {error, plural, one {# problem} other {# problems}}'
    },
    assetSummary: {
        id: 'transfer.import.assetSummary',
        defaultMessage:
            '{assetsNew, plural, one {# new file} other {# new files}}, {assetsReused, plural, one {# already here} other {# already here}}.'
    },
    nothing: {
        id: 'transfer.import.nothing',
        defaultMessage:
            'Nothing in this file would change anything here. It may already have been imported.'
    },
    cancel: { id: 'transfer.import.cancel', defaultMessage: 'Cancel' },
    back: { id: 'transfer.import.back', defaultMessage: 'Choose another file' },
    confirm: { id: 'transfer.import.confirm', defaultMessage: 'Import' },
    done: {
        id: 'transfer.import.done.toast',
        defaultMessage:
            'Imported {create, plural, one {# new record} other {# new records}} and updated {update, plural, one {# record} other {# records}}.'
    },
    failed: {
        id: 'transfer.import.failed.toast',
        defaultMessage: 'That import didn’t work.'
    }
});

const POLICY_LABEL = {
    [CONFLICT_POLICY.Skip]: messages.policySkip,
    [CONFLICT_POLICY.Update]: messages.policyUpdate,
    [CONFLICT_POLICY.Duplicate]: messages.policyDuplicate,
    [CONFLICT_POLICY.Fail]: messages.policyFail
} as const;

const POLICY_ORDER: ConflictPolicy[] = [
    CONFLICT_POLICY.Skip,
    CONFLICT_POLICY.Update,
    CONFLICT_POLICY.Duplicate,
    CONFLICT_POLICY.Fail
];

/** The message from a failed request, if the server sent one worth showing. */
function serverMessage(error: unknown): string | undefined {
    const message = (
        error as { response?: { data?: { message?: unknown } } } | undefined
    )?.response?.data?.message;
    return typeof message === 'string' ? message : undefined;
}

/**
 * The import dialog: pick a file, see what it would do, then do it.
 *
 * The two phases are not a nicety. An import is the one content operation that
 * can rewrite many records at once from a file the person did not necessarily
 * author, and "run it and find out" is not an acceptable interaction for that.
 * The check step calls the same pipeline the apply step does, so what the table
 * shows is what will happen.
 */
export function ImportDialog({
    open,
    onOpenChange,
    typeName
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    typeName: string;
}) {
    const intl = useIntl();
    const fieldId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [policy, setPolicy] = useState<ConflictPolicy>(CONFLICT_POLICY.Skip);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [error, setError] = useState<string | null>(null);

    const previewMutation = useImportPreview();
    const applyMutation = useImportApply();

    const reset = (): void => {
        setFile(null);
        setPreview(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const close = (): void => {
        reset();
        onOpenChange(false);
    };

    const check = (): void => {
        if (!file) return;
        setError(null);
        previewMutation
            .mutateAsync({ typeName, file, policy })
            .then(setPreview)
            .catch((cause) =>
                setError(
                    serverMessage(cause) ??
                        intl.formatMessage(messages.failed)
                )
            );
    };

    const apply = (): void => {
        if (!file) return;
        setError(null);
        applyMutation
            .mutateAsync({ typeName, file, policy })
            .then((result) => {
                toast.success(
                    intl.formatMessage(messages.done, {
                        create: result.counts.create,
                        update: result.counts.update
                    })
                );
                close();
            })
            .catch((cause) =>
                setError(
                    serverMessage(cause) ?? intl.formatMessage(messages.failed)
                )
            );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor={`${fieldId}-file`}>
                            {intl.formatMessage(messages.file)}
                        </Label>
                        <input
                            ref={inputRef}
                            id={`${fieldId}-file`}
                            type="file"
                            accept=".json,.ndjson,.jsonl,.csv,.zip"
                            aria-describedby={`${fieldId}-file-hint`}
                            className="border-input file:text-foreground w-full rounded-md border bg-transparent px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
                            onChange={(event) => {
                                // A new file invalidates the previous verdict —
                                // showing one file's table above another file's
                                // Import button is the worst possible bug here.
                                setPreview(null);
                                setError(null);
                                setFile(event.target.files?.[0] ?? null);
                            }}
                        />
                        <span
                            id={`${fieldId}-file-hint`}
                            className="text-muted-foreground text-xs"
                        >
                            {intl.formatMessage(messages.fileHint)}{' '}
                            <a
                                className="underline underline-offset-2"
                                href={`/api/content/${typeName}/import/template`}
                            >
                                {intl.formatMessage(messages.template)}
                            </a>
                        </span>
                    </div>

                    <fieldset className="grid gap-2">
                        <legend className="mb-1 text-sm font-medium">
                            {intl.formatMessage(messages.policy)}
                        </legend>
                        <RadioGroup
                            value={policy}
                            onValueChange={(next) => {
                                // The verdicts depend on the policy, so changing
                                // it retires the table rather than leaving a
                                // stale one that no longer describes the run.
                                setPreview(null);
                                setPolicy(next as ConflictPolicy);
                            }}
                        >
                            {POLICY_ORDER.map((value) => (
                                <div
                                    key={value}
                                    className="flex items-center gap-2"
                                >
                                    <RadioGroupItem
                                        id={`${fieldId}-policy-${value}`}
                                        value={value}
                                    />
                                    <Label
                                        htmlFor={`${fieldId}-policy-${value}`}
                                        className="font-normal"
                                    >
                                        {intl.formatMessage(
                                            POLICY_LABEL[value]
                                        )}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </fieldset>

                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}

                    {preview ? (
                        <div className="grid gap-2">
                            <p className="text-sm" aria-live="polite">
                                {intl.formatMessage(messages.summary, {
                                    ...preview.counts
                                })}
                            </p>
                            {preview.counts.assetsNew +
                                preview.counts.assetsReused >
                            0 ? (
                                <p className="text-muted-foreground text-xs">
                                    {intl.formatMessage(
                                        messages.assetSummary,
                                        { ...preview.counts }
                                    )}
                                </p>
                            ) : null}
                            {!preview.hasChanges ? (
                                <Alert>
                                    <AlertDescription>
                                        {intl.formatMessage(messages.nothing)}
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                            <ImportVerdictList verdicts={preview.verdicts} />
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={close}>
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    {preview ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={reset}
                            >
                                {intl.formatMessage(messages.back)}
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    applyMutation.isPending ||
                                    !preview.hasChanges
                                }
                                onClick={apply}
                            >
                                {applyMutation.isPending ? (
                                    <Spinner aria-hidden />
                                ) : (
                                    <Upload aria-hidden />
                                )}
                                {intl.formatMessage(messages.confirm)}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            disabled={!file || previewMutation.isPending}
                            onClick={check}
                        >
                            {previewMutation.isPending ? (
                                <>
                                    <Spinner aria-hidden />
                                    {intl.formatMessage(messages.checking)}
                                </>
                            ) : (
                                intl.formatMessage(messages.check)
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
