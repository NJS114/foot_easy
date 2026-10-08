import { initialState } from "@/server/state";
import type { FileRecord, WorkspaceView } from "./types";
import {
  archiveEntries,
  folderPath,
  latestFiles,
  licenseStatus,
  memberFiles,
} from "./document-utils";
const file = (overrides: Partial<FileRecord> = {}): FileRecord => ({
  id: "file",
  rootId: "file",
  version: 1,
  name: "licence.pdf",
  mime: "application/pdf",
  size: 20,
  category: "license",
  entityType: "document",
  entityId: "",
  status: "pending",
  expiresAt: null,
  note: "",
  createdAt: "2026-10-07T12:00:00Z",
  url: "/api/v2/files/file",
  ...overrides,
});
function view(): WorkspaceView {
  return {
    ...initialState(),
    files: [],
    revision: 0,
    user: { name: "Coach" },
    serverTime: "2026-10-07T12:00:00Z",
  };
}
it("keeps nested archive paths, sanitizes unsafe names and preserves extensions on collisions", () => {
  const folders = [
    { id: "season", name: "Saison", parentId: "", createdAt: "" },
    { id: "licenses", name: "Licences", parentId: "season", createdAt: "" },
  ];
  expect(
    archiveEntries(
      [
        file({ folderId: "licenses" }),
        file({ id: "second", folderId: "licenses" }),
        file({ id: "unsafe", name: "../../secret.txt" }),
      ],
      folders,
    ).map((e) => e.path),
  ).toEqual(["Saison/Licences/licence.pdf", "Saison/Licences/licence (2).pdf", ".._.._secret.txt"]);
  expect(
    folderPath([...folders, { id: "loop", name: "Loop", parentId: "loop", createdAt: "" }], "loop"),
  ).toHaveLength(1);
});
it("shows a complete licence only with a number and an approved unexpired latest file", () => {
  const data = view(),
    member = data.core.members[0];
  member.license_number = "ABC";
  data.files = [file({ entityType: "member", entityId: member.id, status: "approved" })];
  expect(licenseStatus(data, member.id)).toBe("Complète");
  data.files.push(
    file({ id: "new", version: 2, entityType: "member", entityId: member.id, status: "pending" }),
  );
  expect(latestFiles(data.files)).toHaveLength(1);
  expect(licenseStatus(data, member.id)).toBe("À vérifier");
  data.files[1].status = "approved";
  data.files[1].expiresAt = "2000-01-01";
  expect(licenseStatus(data, member.id)).toBe("Expirée");
  data.files[1].expiresAt = null;
  member.license_number = null;
  expect(licenseStatus(data, member.id)).toBe("À compléter");
});
it("collects submitted, received, event and task documents once without including another member's files or draft campaigns", () => {
  const data = view(),
    id = data.core.members[0].id,
    other = data.core.members[1].id;
  const invitation = data.core.invitations.find((i) => i.member.id === id)!;
  data.files = [
    file({ id: "submitted", rootId: "submitted", submittedByMemberId: id }),
    file({ id: "received", rootId: "received", recipientMemberIds: [id] }),
    file({ id: "event", rootId: "event", entityType: "event", entityId: invitation.event_id }),
    file({ id: "other", rootId: "other", entityType: "member", entityId: other }),
    file({ id: "draft", rootId: "draft" }),
  ];
  data.flow.campaigns[0].status = "draft";
  data.flow.campaigns[0].memberIds = [id];
  data.flow.campaigns[0].attachmentIds = ["draft"];
  expect(memberFiles(data, id).map((f) => f.id)).toEqual(["submitted", "received", "event"]);
  data.flow.campaigns[0].status = "completed";
  expect(memberFiles(data, id).map((f) => f.id)).toContain("draft");
});
