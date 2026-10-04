import type {
    BuilderCapabilities,
    TypeDoc
} from '@orthacms/schema-builder-domain';

/** Why a type cannot be edited here, when it cannot. */
export type Editability =
    | { ok: true }
    | {
          ok: false;
          reason: 'no-permission' | 'read-only-server' | 'hand-written';
      };

/** The UX mirror of the server's guards — the server still decides. */
export function typeEditability(
    type: TypeDoc,
    capabilities: BuilderCapabilities,
    canManage: boolean
): Editability {
    if (!canManage) return { ok: false, reason: 'no-permission' };
    if (!capabilities.editable)
        return { ok: false, reason: 'read-only-server' };
    if (type.origin === 'code') return { ok: false, reason: 'hand-written' };
    return { ok: true };
}
