import { ensureSchema, S, sql } from "./db";

// Server-enforced Per-User Votes & Saves (REQ-013..REQ-016, AT-10..AT-12).
// Explicitly refuses cross-user tamper attempts with 403 Forbidden (AT-12) and derives
// ownership exclusively from the authenticated session user.

export type InteractionKind = "vote" | "save";

export type InteractionOutcome =
  | { ok: true; active: boolean; votesCount: number }
  | { ok: false; status: 403 | 404; error: string };

export async function storyExists(storyId: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(storyId)) return false;
  await ensureSchema();
  const rows = await sql`SELECT 1 FROM ${S()}.stories WHERE id = ${storyId} LIMIT 1`;
  return rows.length > 0;
}

export async function toggleUserInteraction(opts: {
  kind: InteractionKind;
  sessionUserId: string;
  storyId: string;
  claimedUserId?: string | null;
}): Promise<InteractionOutcome> {
  const { kind, sessionUserId, storyId, claimedUserId } = opts;

  // AT-12: If a request attempts to specify another user's ID (via form field, JSON body, or query),
  // explicitly refuse the request with 403 and leave the target user's state untouched.
  if (claimedUserId !== undefined && claimedUserId !== null && String(claimedUserId).trim() !== "") {
    if (String(claimedUserId).trim() !== String(sessionUserId)) {
      return {
        ok: false,
        status: 403,
        error: "You can only change your own votes and saves.",
      };
    }
  }

  if (!(await storyExists(storyId))) {
    return {
      ok: false,
      status: 404,
      error: "That story could not be found.",
    };
  }

  let active: boolean;
  if (kind === "vote") {
    const deleted = await sql`
      DELETE FROM ${S()}.votes
      WHERE user_id = ${sessionUserId} AND story_id = ${storyId}
      RETURNING 1
    `;
    if (deleted.length > 0) {
      active = false;
    } else {
      await sql`
        INSERT INTO ${S()}.votes (user_id, story_id)
        VALUES (${sessionUserId}, ${storyId})
        ON CONFLICT (user_id, story_id) DO NOTHING
      `;
      active = true;
    }
  } else {
    const deleted = await sql`
      DELETE FROM ${S()}.saves
      WHERE user_id = ${sessionUserId} AND story_id = ${storyId}
      RETURNING 1
    `;
    if (deleted.length > 0) {
      active = false;
    } else {
      await sql`
        INSERT INTO ${S()}.saves (user_id, story_id)
        VALUES (${sessionUserId}, ${storyId})
        ON CONFLICT (user_id, story_id) DO NOTHING
      `;
      active = true;
    }
  }

  const [countRow] = await sql<{ n: string }[]>`
    SELECT count(*)::text AS n FROM ${S()}.votes WHERE story_id = ${storyId}
  `;

  return {
    ok: true,
    active,
    votesCount: Number(countRow?.n ?? 0),
  };
}
