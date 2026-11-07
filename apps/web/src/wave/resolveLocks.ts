/**
 * Pure, deterministic edit-lock resolution.
 *
 * Several clients may claim the same blip at once (via Yjs awareness). Awareness
 * is eventually consistent, so every client eventually sees the same set of
 * claims. Given that set, this function must pick the same winner on every
 * client without any coordination. Rule: the lowest awareness clientID wins a
 * contested blip. The result is a blipId -> editor map that every client agrees on.
 */

/** One client's claim to be editing a blip. */
export interface EditClaim {
  /** The awareness clientID of the claimant (unique per connection). */
  clientID: number;
  /** The blip the client is editing. */
  blipId: string;
  /** Display name of the claimant, used for the "<name> is editing..." label. */
  name: string;
}

/** The winning editor of a blip. */
export interface LockHolder {
  clientID: number;
  name: string;
}

/**
 * Reduce a set of claims to a single holder per blip.
 * For each blip, the claim with the lowest clientID wins. Ties on clientID are
 * impossible because clientIDs are unique per connection.
 */
export function resolveLocks(claims: readonly EditClaim[]): Map<string, LockHolder> {
  const holders = new Map<string, LockHolder>();
  for (const claim of claims) {
    const current = holders.get(claim.blipId);
    if (!current || claim.clientID < current.clientID) {
      holders.set(claim.blipId, { clientID: claim.clientID, name: claim.name });
    }
  }
  return holders;
}
