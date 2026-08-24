import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';

/** One object, as the fake holds it. */
interface FakeObject {
    body: Buffer;
    contentType?: string;
}

/** The error shape this family of services uses for a missing key. */
function notFound(name: 'NoSuchKey' | 'NotFound'): Error {
    return Object.assign(new Error(name), {
        name,
        $metadata: { httpStatusCode: 404 }
    });
}

/** Drains whatever `Body` the SDK was handed into one buffer. */
async function collect(body: unknown): Promise<Buffer> {
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body);
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * A stand-in `S3Client` that answers the four commands this adapter sends.
 *
 * **What it is for and what it is not.** It exercises *our* code — key shapes,
 * the metering that produces size and checksum, the error mapping, the abort
 * path — offline and in milliseconds. It is not a claim that the adapter works
 * against S3: a fake agrees with whatever the code does, which is exactly the
 * failure mode MinIO and a real bucket exist to catch. Both are named in
 * `AGENTS.md` as required before this provider is trusted with a deployment.
 *
 * Exported from `src/` rather than hidden in a spec so the eventual MinIO suite
 * can be written as the same cases against a different client.
 */
export class FakeS3Client {
    readonly objects = new Map<string, FakeObject>();
    /** Every command class name this client was asked to send, in order. */
    readonly sent: string[] = [];
    /** Buckets that exist. `HeadBucket` fails for anything else. */
    constructor(private readonly buckets: Set<string> = new Set(['bucket'])) {}

    /** The provider only ever calls `send`, so that is all this implements. */
    async send(command: {
        constructor: { name: string };
        input: Record<string, unknown>;
    }): Promise<unknown> {
        const kind = command.constructor.name;
        this.sent.push(kind);
        const key = command.input['Key'] as string;

        switch (kind) {
            case 'PutObjectCommand': {
                this.objects.set(key, {
                    body: await collect(command.input['Body']),
                    contentType: command.input['ContentType'] as
                        | string
                        | undefined
                });
                return { ETag: '"fake"' };
            }
            case 'GetObjectCommand': {
                const object = this.objects.get(key);
                if (!object) throw notFound('NoSuchKey');
                return {
                    Body: Readable.from(object.body),
                    ContentType: object.contentType
                };
            }
            case 'DeleteObjectCommand': {
                // S3 answers 204 whether or not the key was there.
                this.objects.delete(key);
                return {};
            }
            case 'HeadBucketCommand': {
                if (!this.buckets.has(command.input['Bucket'] as string)) {
                    throw notFound('NotFound');
                }
                return {};
            }
            default:
                throw new Error(`FakeS3Client cannot answer ${kind}`);
        }
    }

    /** Keys currently held, sorted — the harness for the contract suite. */
    keys(): string[] {
        return [...this.objects.keys()].sort();
    }

    /**
     * A **real** `S3Client` with only its `send` replaced.
     *
     * Hand-rolling the whole client does not work and should not be attempted:
     * `lib-storage` reads the client's own `config` — `requestHandler` for
     * progress events, `endpointProvider` to build the uploaded object's
     * `Location` — so a plain object fails inside the SDK rather than in our
     * code. Keeping the real client means the command construction, the
     * endpoint resolution and the middleware stack are all genuine, and only
     * the network hop is stubbed.
     */
    asClient(): S3Client {
        const client = new S3Client({
            region: 'auto',
            endpoint: 'https://fake.s3.test',
            forcePathStyle: true,
            credentials: {
                accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
                secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
            }
        });
        client.send = ((command: Parameters<FakeS3Client['send']>[0]) =>
            this.send(command)) as unknown as S3Client['send'];
        return client;
    }
}
