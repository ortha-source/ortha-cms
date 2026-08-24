import { PassThrough, Readable, Writable } from 'node:stream';
import type { Bucket } from '@google-cloud/storage';

/** One object, as the fake holds it. */
interface FakeObject {
    body: Buffer;
    contentType?: string;
}

/** The error shape the GCS client raises for a missing object. */
function objectNotFound(): Error {
    return Object.assign(new Error('No such object'), { code: 404 });
}

/**
 * A stand-in `Bucket` covering the five calls this adapter makes.
 *
 * The seam is the bucket handle, which the provider already accepts for
 * deployments with hand-built auth — so these tests drive the same entry point
 * a real caller uses rather than a private hook.
 *
 * It proves this adapter's logic and nothing about GCS: the fake agrees with
 * whatever the code does. `AGENTS.md` names the acceptance step.
 */
export class FakeBucket {
    readonly objects = new Map<string, FakeObject>();
    /** Flip to make `getMetadata` fail, as a missing bucket would. */
    exists = true;
    /** Make the next upload fail part-way, to exercise the cleanup path. */
    failNextUpload = false;
    /** Object names `delete` was called for, in order. */
    readonly deleted: string[] = [];
    /** Options the last `getSignedUrl` was asked for. */
    lastSignedUrlOptions: Record<string, unknown> | undefined;

    file(name: string) {
        return {
            createWriteStream: (options?: { contentType?: string }) => {
                const chunks: Buffer[] = [];
                const sink = new Writable({
                    write: (chunk: Buffer, _encoding, done) => {
                        if (this.failNextUpload) {
                            this.failNextUpload = false;
                            done(new Error('upload failed'));
                            return;
                        }
                        chunks.push(
                            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
                        );
                        done();
                    }
                });
                sink.on('finish', () => {
                    this.objects.set(name, {
                        body: Buffer.concat(chunks),
                        contentType: options?.contentType
                    });
                });
                return sink as unknown as PassThrough;
            },
            createReadStream: () => {
                const object = this.objects.get(name);
                // Lazily, exactly like the real client — which is why the
                // provider reads metadata first rather than trusting this.
                if (object) return Readable.from(object.body);
                return new Readable({
                    read() {
                        this.destroy(objectNotFound());
                    }
                });
            },
            getMetadata: async () => {
                const object = this.objects.get(name);
                if (!object) throw objectNotFound();
                return [{ size: object.body.byteLength }];
            },
            delete: async (options?: { ignoreNotFound?: boolean }) => {
                this.deleted.push(name);
                const existed = this.objects.delete(name);
                if (!existed && !options?.ignoreNotFound) {
                    throw objectNotFound();
                }
                return [{}];
            },
            getSignedUrl: async (options: Record<string, unknown>) => {
                this.lastSignedUrlOptions = options;
                return [`https://storage.test/${name}?signed=1`];
            }
        };
    }

    async getMetadata() {
        if (!this.exists) throw objectNotFound();
        return [{}];
    }

    /** Object names currently held, sorted. */
    keys(): string[] {
        return [...this.objects.keys()].sort();
    }

    /** Presents as the real thing to a provider that only uses the above. */
    asBucket(): Bucket {
        return this as unknown as Bucket;
    }
}
