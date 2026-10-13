import "server-only";

export type OperationalOutcome = "success" | "rejected" | "failed";
export type OperationalCode = "INVALID_INPUT" | "UNAUTHORIZED" | "INVALID_STATE" | "INTERNAL_ERROR";

type OperationalEvent = Readonly<{
  operation: "guarded-command";
  outcome: OperationalOutcome;
  code?: OperationalCode;
  requestId?: string;
}>;

/** Emit only fixed operational fields. Never pass request, input, or exception objects here. */
export function logOperationalEvent(event: OperationalEvent, write: (line: string) => void = console.error): void {
  if (event.operation !== "guarded-command" || !["success", "rejected", "failed"].includes(event.outcome)) return;
  const record: Record<string, string> = {
    operation: "guarded-command",
    outcome: event.outcome,
  };
  if (event.code && ["INVALID_INPUT", "UNAUTHORIZED", "INVALID_STATE", "INTERNAL_ERROR"].includes(event.code)) {
    record.code = event.code;
  }
  if (event.requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.requestId)) {
    record.requestId = event.requestId;
  }
  write(JSON.stringify(record));
}
