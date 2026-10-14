import "server-only";

export type OperationalOutcome = "success" | "rejected" | "failed";
export type OperationalCode = "INVALID_INPUT" | "UNAUTHORIZED" | "INVALID_STATE" | "INTERNAL_ERROR";

type OperationalEvent = Readonly<{
  operation: "guarded-command" | "account-access";
  outcome: OperationalOutcome;
  code?: OperationalCode;
  requestId?: string;
}>;

/** Emit only fixed operational fields. Never pass request, input, or exception objects here. */
export function logOperationalEvent(event: OperationalEvent, write: (line: string) => void = console.error): void {
  const operation = event.operation;
  if (!["guarded-command", "account-access"].includes(operation) || !["success", "rejected", "failed"].includes(event.outcome)) return;
  const record: Record<string, string> = {
    operation,
    outcome: event.outcome,
  };
  if (event.code && ["INVALID_INPUT", "UNAUTHORIZED", "INVALID_STATE", "INTERNAL_ERROR"].includes(event.code)) {
    record.code = event.code;
  }
  if (typeof event.requestId === "string" && event.requestId.length === 36 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.requestId)) {
    record.requestId = event.requestId;
  }
  try {
    write(JSON.stringify(record));
  } catch {
    // Operational output must not replace a committed result or the original command error.
    // Do not retry through another sink: that could serialize the sink's exception.
  }
}
