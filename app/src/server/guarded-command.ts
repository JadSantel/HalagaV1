import "server-only";
import type { z } from "zod";
import { logOperationalEvent } from "./operational-log.ts";

export type CommandRejection = "INVALID_INPUT" | "UNAUTHORIZED" | "INVALID_STATE";

/** Internal codes only. Request handlers must not serialize arbitrary errors. */
export class CommandRejected extends Error {
  readonly code: CommandRejection;

  constructor(code: CommandRejection) {
    super(code);
    this.name = "CommandRejected";
    this.code = code;
  }
}

type CommandContext<Input, Actor, State> = Readonly<{
  input: Input;
  actor: Actor;
  state: State;
}>;

export type GuardedCommandDefinition<Request, Input, Actor, State, Transaction, Result> = {
  schema: z.ZodType<Input>;
  resolveActor(request: Request): Promise<Actor | null>;
  /** A real database transaction: commit on success, roll back on any thrown error. */
  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
  loadState(transaction: Transaction, input: Input, actor: Actor): Promise<State>;
  authorize(context: CommandContext<Input, Actor, State>): boolean | Promise<boolean>;
  isStateAllowed(context: CommandContext<Input, Actor, State>): boolean | Promise<boolean>;
  write(transaction: Transaction, context: CommandContext<Input, Actor, State>): Promise<Result>;
};

/** Structural foundation only; concrete commands must supply all flow-specific safeguards. */
export function defineGuardedCommand<Request, Input, Actor, State, Transaction, Result>(
  definition: GuardedCommandDefinition<Request, Input, Actor, State, Transaction, Result>,
) {
  return async (rawInput: unknown, request: Request): Promise<Result> => {
    try {
      const parsed = await definition.schema.safeParseAsync(rawInput);
      if (!parsed.success) throw new CommandRejected("INVALID_INPUT");

      const actor = await definition.resolveActor(request);
      if (actor == null) throw new CommandRejected("UNAUTHORIZED");

      const result = await definition.transaction(async (transaction) => {
        const state = await definition.loadState(transaction, parsed.data, actor);
        const context = { input: parsed.data, actor, state };
        if (await definition.authorize(context) !== true) throw new CommandRejected("UNAUTHORIZED");
        if (await definition.isStateAllowed(context) !== true) throw new CommandRejected("INVALID_STATE");
        return definition.write(transaction, context);
      });
      logOperationalEvent({ operation: "guarded-command", outcome: "success" });
      return result;
    } catch (error) {
      const rejected = error instanceof CommandRejected;
      logOperationalEvent({
        operation: "guarded-command",
        outcome: rejected ? "rejected" : "failed",
        code: rejected ? error.code : "INTERNAL_ERROR",
      });
      throw error;
    }
  };
}
