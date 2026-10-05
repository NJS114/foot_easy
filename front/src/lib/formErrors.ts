import { ApiError } from "@/api/errors";

export function fieldErrorFor(error: Error | null, field: string): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return error.fieldErrors.find((fieldError) => fieldError.field === field)?.message;
}

export function hasFieldErrors(error: Error): boolean {
  return error instanceof ApiError && error.fieldErrors.length > 0;
}
