import { describe, it, expect } from "vitest";
import { participantDisplayName, GUEST_NAME } from "./participantName";

const account = { fullName: "Awa DIOP", email: "awa.diop@unchk.edu.sn" };

describe("participantDisplayName", () => {
  it("names an authenticated participant from their account", () => {
    expect(participantDisplayName(account)).toBe("Awa DIOP");
  });

  it("ignores a name claimed by the client when authenticated", () => {
    // The bug this rule exists for: a stale name left in another user's browser.
    expect(participantDisplayName(account, "Papa Amadou Baba NDIAYE")).toBe(
      "Awa DIOP",
    );
  });

  it("falls back to the email when the account has no full name", () => {
    expect(
      participantDisplayName({ fullName: "", email: "awa@unchk.edu.sn" }),
    ).toBe("awa@unchk.edu.sn");
  });

  it("lets a guest name themselves", () => {
    expect(participantDisplayName(null, "Fatou")).toBe("Fatou");
  });

  it("trims a guest name", () => {
    expect(participantDisplayName(null, "  Fatou  ")).toBe("Fatou");
  });

  it("falls back for a guest who supplies nothing usable", () => {
    expect(participantDisplayName(null)).toBe(GUEST_NAME);
    expect(participantDisplayName(undefined, "")).toBe(GUEST_NAME);
    expect(participantDisplayName(null, "   ")).toBe(GUEST_NAME);
  });
});
