import createClient from "openapi-fetch";
import type { components, paths } from "@/api/types";

export type Schemas = components["schemas"];
export type Club = Schemas["ClubResponse"];
export type ClubCreate = Schemas["ClubCreate"];
export type Team = Schemas["TeamResponse"];
export type TeamCreate = Schemas["TeamCreate"];
export type Member = Schemas["MemberResponse"];
export type MemberCreate = Schemas["MemberCreate"];
export type Event = Schemas["EventResponse"];
export type EventCreate = Schemas["EventCreate"];
export type EventUpdate = Schemas["EventUpdate"];
export type Formation = Schemas["FormationResponse"];
export type Lineup = Schemas["LineupResponse"];
export type LineupWrite = Schemas["LineupWrite"];
export type SlotInput = Schemas["SlotInput"];
export type MatchFact = Schemas["MatchFactResponse"];
export type MatchFactCreate = Schemas["MatchFactCreate"];
export type TeamStats = Schemas["TeamStats"];
export type PlayerStats = Schemas["PlayerStats"];
export type Invitation = Schemas["InvitationResponse"];
export type InvitationReply = Schemas["InvitationReply"];
export type AvailabilitySummary = Schemas["AvailabilitySummary"];
export type ErrorEnvelope = Schemas["ErrorResponse"];
export type AttendanceReport = Schemas["AttendanceReport"];
export type AttendanceRow = Schemas["AttendanceRow"];
export type TaskReport = Schemas["TaskReport"];
export type TaskRow = Schemas["TaskRow"];
export type TeamTaskResponse = Schemas["TeamTaskResponse"];
export type TeamTaskCreate = Schemas["TeamTaskCreate"];
export type AssignmentResponse = Schemas["AssignmentResponse"];
export type AssignmentCreate = Schemas["AssignmentCreate"];
export type ImportReport = Schemas["ImportReport"];

export const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

// Resolve fetch per call so request interceptors installed later (e.g. MSW in tests) apply.
export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: (request) => globalThis.fetch(request),
});
