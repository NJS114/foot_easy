import createClient from "openapi-fetch";
import type { components, paths } from "@/api/types";

export type Schemas = components["schemas"];
export type Team = Schemas["TeamResponse"];
export type TeamCreate = Schemas["TeamCreate"];
export type Member = Schemas["MemberResponse"];
export type MemberCreate = Schemas["MemberCreate"];
export type Event = Schemas["EventResponse"];
export type EventCreate = Schemas["EventCreate"];
export type Invitation = Schemas["InvitationResponse"];
export type InvitationReply = Schemas["InvitationReply"];
export type AvailabilitySummary = Schemas["AvailabilitySummary"];
export type ErrorEnvelope = Schemas["ErrorResponse"];

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://api.foot-easy.localhost";

// Resolve fetch per call so request interceptors installed later (e.g. MSW in tests) apply.
export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: (request) => globalThis.fetch(request),
});
