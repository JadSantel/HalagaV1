import "server-only";

/** Account-private prerequisite projection. Never use as a public profile or action grant. */
export type AccountAccess = Readonly<{
  accountId: string;
  displayName: string;
  adultEligible: boolean;
  emailVerified: boolean;
  recentSignIn: boolean;
}>;

export class AccountAccessRejected extends Error {
  readonly code: "INVALID_INPUT" | "UNAUTHORIZED" | "ADULT_ELIGIBILITY_REQUIRED" | "EMAIL_VERIFICATION_REQUIRED" | "INTERNAL_ERROR";

  constructor(code: AccountAccessRejected["code"]) {
    super(code);
    this.name = "AccountAccessRejected";
    this.code = code;
  }
}

/** Evaluate a private SQL date against the current PHT calendar date, without exposing DOB. */
export function hasAdultEligibility(dateOfBirth: Date | null, attestedAt: Date | null, now: Date): boolean {
  if (!dateOfBirth || !attestedAt || !Number.isFinite(dateOfBirth.getTime()) ||
      !Number.isFinite(attestedAt.getTime()) || attestedAt > now) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(today.find((value) => value.type === type)?.value);
  const birthYear = dateOfBirth.getUTCFullYear();
  const birthMonth = dateOfBirth.getUTCMonth() + 1;
  const birthDay = dateOfBirth.getUTCDate();
  const years = part("year") - birthYear;
  return years > 18 || (years === 18 &&
    (part("month") > birthMonth || (part("month") === birthMonth && part("day") >= birthDay)));
}

/** Required by these commands; restrictions, blocks and target/state guards are still separate. */
export function requireAccountPrerequisites(account: AccountAccess | null, action: unknown): AccountAccess {
  if (typeof action !== "string" || !["publish-listing", "send-inquiry", "submit-proposal"].includes(action)) {
    throw new AccountAccessRejected("INVALID_INPUT");
  }
  if (!account) throw new AccountAccessRejected("UNAUTHORIZED");
  if (!account.adultEligible) throw new AccountAccessRejected("ADULT_ELIGIBILITY_REQUIRED");
  if (!account.emailVerified) throw new AccountAccessRejected("EMAIL_VERIFICATION_REQUIRED");
  return account;
}
