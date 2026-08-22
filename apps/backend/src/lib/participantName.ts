import type { User } from "@prisma/client";

/** The part of a user this rule needs — keeps it testable without a full row. */
export type NamedUser = Pick<User, "fullName" | "email">;

export const GUEST_NAME = "Invité";

/**
 * The name a participant appears under, in the room and in the attendance sheet.
 *
 * An authenticated participant is named by their Keycloak account, never by what
 * the client sends. Two reasons: the browser keeps whatever name was last used
 * on that machine, so a shared computer would put the previous person's name on
 * this one's session; and a self-declared name would make the attendance record
 * worthless as a record, since anyone could sign in as themselves and appear as
 * someone else.
 *
 * Guests have no account, so they — and only they — name themselves.
 */
export function participantDisplayName(
  user: NamedUser | null | undefined,
  claimed?: string | null,
): string {
  if (user) return user.fullName || user.email || GUEST_NAME;
  return claimed?.trim() || GUEST_NAME;
}
