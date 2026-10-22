import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CommandRejected, defineGuardedCommand } from "./guarded-command.ts";

type PublicationCommand = {
  requestId: string;
  listingId: string;
  revision: number;
  command: "SUBMIT" | "REVIEW";
};

type Context<Input, Actor, State> = Readonly<{ input: Input; actor: Actor; state: State }>;
type Receipt<Result> = Readonly<{ fingerprint: string; result: Result }>;
type Decision<Domain, Notification, Job, Result> = Readonly<{
  domain: Domain;
  /** The owning flow determines required recipients/channels; there is no default. */
  notifications: readonly Notification[];
  jobs: readonly Job[];
  result: Result;
}>;

/** Internal coordination seam, not a publication command or authorization policy.
 * No runtime adapter is installed until publication/delivery/job policies exist.
 */
export type AtomicPublicationDefinition<Request, Input extends PublicationCommand, Actor, State, Transaction,
  Domain, Notification, Job, Result> = {
  schema: z.ZodType<Input>;
  resolveActor(request: Request): Promise<Actor | null>;
  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
  /** Serialize both target changes and actor/command/request-key reuse, including
   * concurrent requests naming different targets. Follow the owning lock order. */
  loadAndLock(transaction: Transaction, input: Input, actor: Actor): Promise<State>;
  /** Recheck live authorization even for a replay and again before commit. Include
   * session/deadline/restriction time checks under the held prerequisite locks.
   * Never grant access from a receipt. */
  authorize(context: Context<Input, Actor, State>): boolean | Promise<boolean>;
  readReceipt(transaction: Transaction, context: Context<Input, Actor, State>): Promise<Receipt<Result> | null>;
  isStateAllowed(context: Context<Input, Actor, State>): boolean | Promise<boolean>;
  /** Pure policy evaluation of locked state. No network calls or writes. */
  decide(context: Context<Input, Actor, State>): Decision<Domain, Notification, Job, Result>;
  /** Fail closed if a required intent/job is missing or lacks an accepted policy.
   * This is required even for an empty plan; [] never means policy was resolved. */
  validateEffects(context: Context<Input, Actor, State>, decision: Decision<Domain, Notification, Job, Result>): boolean;
  writeDomain(transaction: Transaction, context: Context<Input, Actor, State>, domain: Domain): Promise<void>;
  appendAudit(transaction: Transaction, context: Context<Input, Actor, State>, decisionId: string, domain: Domain): Promise<void>;
  appendNotification(transaction: Transaction, decisionId: string, index: number, notification: Notification): Promise<void>;
  appendJob(transaction: Transaction, decisionId: string, index: number, job: Job): Promise<void>;
  /** Store original safe result with a UNIQUE(actor, command, requestId) boundary.
   * Audit/effects also need unique decision/channel/recipient/work constraints.
   * All callbacks must use only the supplied transaction, with no sending. */
  saveReceipt(transaction: Transaction, context: Context<Input, Actor, State>, decisionId: string, receipt: Receipt<Result>): Promise<void>;
};

function fingerprint(input: unknown): string {
  // Only JSON command data: no Date, undefined, coercion or key-order dependence.
  const value = z.json().safeParse(input);
  if (!value.success) throw new CommandRejected("INVALID_INPUT");
  const canonical = JSON.stringify(value.data, (_key, item) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
    }
    return item;
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function defineAtomicPublicationDecision<Request, Input extends PublicationCommand, Actor, State, Transaction,
  Domain, Notification, Job, Result>(definition: AtomicPublicationDefinition<Request, Input, Actor, State, Transaction,
    Domain, Notification, Job, Result>) {
  return defineGuardedCommand({
    schema: definition.schema,
    resolveActor: definition.resolveActor,
    transaction: definition.transaction,
    loadState: definition.loadAndLock,
    authorize: definition.authorize,
    // Receipt lookup must follow authorization, but precede the transition guard:
    // the first successful command may already have advanced the listing state.
    isStateAllowed: () => true,
    async write(transaction, context) {
      const digest = fingerprint(context.input);
      const previous = await definition.readReceipt(transaction, context);
      if (previous) {
        if (previous.fingerprint !== digest) throw new CommandRejected("INVALID_STATE");
        if (await definition.authorize(context) !== true) throw new CommandRejected("UNAUTHORIZED");
        return previous.result;
      }
      if (await definition.isStateAllowed(context) !== true) throw new CommandRejected("INVALID_STATE");
      const decision = definition.decide(context);
      if (definition.validateEffects(context, decision) !== true) throw new CommandRejected("INVALID_STATE");
      const decisionId = randomUUID();
      await definition.writeDomain(transaction, context, decision.domain);
      await definition.appendAudit(transaction, context, decisionId, decision.domain);
      for (const [index, intent] of decision.notifications.entries()) {
        await definition.appendNotification(transaction, decisionId, index, intent);
      }
      for (const [index, job] of decision.jobs.entries()) {
        await definition.appendJob(transaction, decisionId, index, job);
      }
      await definition.saveReceipt(transaction, context, decisionId, { fingerprint: digest, result: decision.result });
      if (await definition.authorize(context) !== true) throw new CommandRejected("UNAUTHORIZED");
      return decision.result;
    },
  });
}
