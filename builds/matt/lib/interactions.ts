import { sql } from "./db";

// Votes and saves. The user ID always comes from the session, never from the request, so a
// user can only ever change their own rows. (REQ-013 to REQ-016)

export type Interaction = "vote" | "save";

export async function storyExists(storyId: string): Promise<boolean> {
  if (!/^\d{1,18}$/.test(storyId)) return false;
  const rows = await sql`SELECT 1 FROM stories WHERE id = ${storyId}`;
  return rows.length > 0;
}

// Adds the row if it's missing, removes it if it's there. At most one per user per story.
export async function toggle(kind: Interaction, userId: string, storyId: string): Promise<void> {
  if (kind === "vote") {
    const removed = await sql`DELETE FROM votes WHERE user_id = ${userId} AND story_id = ${storyId} RETURNING 1`;
    if (removed.length === 0) {
      await sql`INSERT INTO votes (user_id, story_id) VALUES (${userId}, ${storyId}) ON CONFLICT DO NOTHING`;
    }
  } else {
    const removed = await sql`DELETE FROM saves WHERE user_id = ${userId} AND story_id = ${storyId} RETURNING 1`;
    if (removed.length === 0) {
      await sql`INSERT INTO saves (user_id, story_id) VALUES (${userId}, ${storyId}) ON CONFLICT DO NOTHING`;
    }
  }
}
