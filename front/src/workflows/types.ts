import type {
  Club,
  Team,
  Member,
  Event,
  Invitation,
  TeamTaskResponse,
  AssignmentResponse,
  Lineup,
  MatchFact,
} from "@/api/client";

export type CoreState = {
  clubs: Club[];
  teams: Team[];
  members: Member[];
  events: Event[];
  invitations: Invitation[];
  tasks: TeamTaskResponse[];
  assignments: AssignmentResponse[];
  lineups: Lineup[];
  facts: MatchFact[];
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  entityType: string;
  entityId: string;
  action: string;
  detail: string;
};
export type DocumentFolder = { id: string; name: string; parentId: string; createdAt: string };
export type FileRecord = {
  id: string;
  folderId?: string;
  uploadedBy?: string;
  submittedByMemberId?: string;
  recipientMemberIds?: string[];
  rootId: string;
  version: number;
  name: string;
  mime: string;
  size: number;
  category: string;
  entityType: string;
  entityId: string;
  status: "pending" | "approved" | "rejected" | "archived";
  expiresAt: string | null;
  note: string;
  createdAt: string;
  url: string;
};
export type Profile = {
  memberId: string;
  photoId: string;
  guardian: string;
  emergencyPhone: string;
  notes: string;
  emailConsent: boolean;
  smsConsent: boolean;
  optedOut: boolean;
};
export type Channel = "email" | "sms" | "push" | "inapp";
export type DeliveryStatus =
  | "queued"
  | "sending"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "bounced"
  | "unsubscribed"
  | "excluded"
  | "cancelled";
export type Delivery = {
  id: string;
  campaignId: string;
  memberId: string;
  name: string;
  destination: string;
  channel: Channel;
  status: DeliveryStatus;
  attempt: number;
  reason: string;
  at: string;
  history: { at: string; status: DeliveryStatus; detail: string }[];
};
export type Campaign = {
  id: string;
  name: string;
  kind: "information" | "invitation" | "reminder" | "advertising";
  channel: Channel;
  subject: string;
  body: string;
  memberIds: string[];
  attachmentIds: string[];
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  scheduledAt: string | null;
  startedAt: string | null;
  createdAt: string;
  eventId: string;
  sponsorId: string;
  ctaLabel: string;
  ctaUrl: string;
  audienceFrozen: boolean;
};
export type Message = {
  id: string;
  author: string;
  body: string;
  attachmentIds: string[];
  createdAt: string;
  reactions: string[];
};
export type Conversation = {
  id: string;
  title: string;
  kind: "team" | "direct" | "announcement";
  memberIds: string[];
  teamId: string;
  eventId: string;
  archived: boolean;
  pinned: boolean;
  messages: Message[];
  createdAt: string;
};
export type Sponsor = {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  website: string;
  level: "bronze" | "silver" | "gold";
  stage: "prospect" | "contacted" | "proposal" | "negotiation" | "signed" | "declined";
  amount: number;
  startDate: string;
  endDate: string;
  logoId: string;
  attachmentIds: string[];
  notes: string;
  archived: boolean;
};
export type Placement = {
  id: string;
  sponsorId: string;
  name: string;
  surface: "dashboard" | "calendar" | "newsletter";
  imageId: string;
  url: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "paused" | "ended";
  impressions: number;
  clicks: number;
  budget: number;
};
export type Collection = {
  id: string;
  name: string;
  purpose: "membership" | "equipment" | "tournament" | "donation";
  amount: number;
  dueDate: string;
  installments: number;
  description: string;
  attachmentIds: string[];
  status: "draft" | "open" | "closed";
  createdAt: string;
  memberIds: string[];
};
export type Charge = {
  id: string;
  collectionId: string;
  memberId: string;
  amount: number;
  dueDate: string;
  installment: number;
  exempt: boolean;
  cancelled: boolean;
};
export type Transaction = {
  id: string;
  chargeId: string;
  amount: number;
  kind: "payment" | "refund";
  method: "card" | "cash" | "transfer" | "cheque";
  status: "pending" | "succeeded" | "failed";
  reference: string;
  createdAt: string;
  note: string;
  simulated: boolean;
};
export type WorkTask = {
  id: string;
  title: string;
  description: string;
  teamId: string;
  eventId: string;
  memberId: string;
  dueAt: string;
  priority: "low" | "normal" | "high";
  status: "todo" | "in_progress" | "blocked" | "submitted" | "done" | "cancelled";
  checklist: { id: string; text: string; done: boolean }[];
  attachmentIds: string[];
  requireProof: boolean;
  comments: Message[];
  createdAt: string;
  assignmentId: string;
};
export type CompetitionTeam = {
  id: string;
  name: string;
  internalTeamId: string;
  logoId: string;
  penalty: number;
};
export type Fixture = {
  id: string;
  round: number;
  homeId: string;
  awayId: string;
  startsAt: string;
  location: string;
  status: "scheduled" | "postponed" | "played" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  eventId: string;
  attachmentIds: string[];
};
export type Competition = {
  id: string;
  name: string;
  season: string;
  category: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  status: "draft" | "active" | "finished";
  teams: CompetitionTeam[];
  fixtures: Fixture[];
  attachmentIds: string[];
};
export type FlowState = {
  schemaVersion: 1;
  folders: DocumentFolder[];
  campaigns: Campaign[];
  deliveries: Delivery[];
  conversations: Conversation[];
  sponsors: Sponsor[];
  placements: Placement[];
  collections: Collection[];
  charges: Charge[];
  transactions: Transaction[];
  workTasks: WorkTask[];
  competitions: Competition[];
  profiles: Profile[];
  audit: Audit[];
  settings: { deliveryMode: "success" | "realistic" | "failure"; simulation: true };
};
export type WorkspaceState = { core: CoreState; flow: FlowState };
export type WorkspaceView = WorkspaceState & {
  files: FileRecord[];
  revision: number;
  user: { name: string };
  serverTime: string;
};
export type Action = { type: string; payload: Record<string, unknown>; requestId: string };
