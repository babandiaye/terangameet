/** Helpers shared by the administration routes. */
import { Prisma } from "@prisma/client";

// Egress connects to rooms as a hidden participant (identity "EG_..."); exclude
// it from human participant counts and attendance lists.
export const NOT_EGRESS: Prisma.MeetingParticipantWhereInput = {
  identity: { not: { startsWith: "EG_" } },
};

export function userBrief(u: {
  id: string;
  fullName: string | null;
  email: string | null;
  shortName: string | null;
}) {
  return {
    id: u.id,
    full_name: u.fullName ?? "",
    email: u.email ?? "",
    short_name: u.shortName ?? "",
  };
}
