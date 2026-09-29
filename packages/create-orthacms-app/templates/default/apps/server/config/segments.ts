import {
    headerSegmentResolver,
    type SegmentsPluginConfig
} from '@orthacms/segments-server';

import { readEnv } from '@orthacms/utils-server';

/** Reader entitlements — where a reader's tags come from. */
export function segmentsConfig(): SegmentsPluginConfig {
    return {
        // Where a reader's tags come from. On by default: the caller of the
        // public API — your site's backend, holding the API token — names the
        // reader in a comma-separated header, `X-Reader-Tags: premium, eu`, and
        // every read is checked against the audiences each entry admits and
        // refuses. `SEGMENTS_READER_TAGS_HEADER` renames the header.
        //
        // A request without the header is the anonymous reader: unrestricted
        // content serves and restricted content does not — exactly what every
        // caller got before, so turning this on changes nothing for a client
        // that does not send it.
        //
        // The header is trusted because the API token already is: whoever holds
        // one can read everything its workspace publishes. So it must come from
        // the backend that holds the token, never from a browser — a token
        // shipped to a browser would let anyone name any audience.
        //
        // Anything else — a JWT claim, a lookup against a billing system — is a
        // resolver of your own; it receives the Express request:
        //
        //   resolver: {
        //       resolve: async (request) => readTagsFrom(request)
        //   }
        resolver: headerSegmentResolver(
            readEnv('SEGMENTS_READER_TAGS_HEADER') ?? 'x-reader-tags'
        )
    };
}
