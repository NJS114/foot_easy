import type { ErrorEnvelope } from "@/api/client";

export class ApiError extends Error {
  readonly code: string;
  readonly fieldErrors: ErrorEnvelope["errors"];
  readonly requestId: string | null | undefined;

  constructor(envelope: ErrorEnvelope) {
    super(envelope.message);
    this.code = envelope.code;
    this.fieldErrors = envelope.errors;
    this.requestId = envelope.request_id;
  }
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}

/** Returns the response data or throws the backend error envelope as an ApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error === undefined && result.response.ok) {
    return result.data as T;
  }
  if (isEnvelope(result.error)) {
    throw new ApiError(result.error);
  }
  throw new ApiError({
    code: `http_${result.response.status}`,
    message: "Unexpected error",
    errors: [],
  });
}
