import { router } from "@/App";
import { api } from "@/workflows/client";
import type { WorkspaceView } from "@/workflows/types";

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
export function registerDemoTools() {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const register = (tool: Tool) => {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {
      /* Browsers without compatible WebMCP retain all visible controls. */
    }
  };
  register({
    name: "read_club_overview",
    title: "Consulter le club de démonstration",
    description:
      "Renvoie le club, ses équipes et les prochains événements de la démonstration en cours.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length)
        throw new Error("Aucun paramètre attendu.");
      const {
        core: { clubs, teams, members, events },
      } = await api<WorkspaceView>("/api/v2/workspace");
      return {
        simulation: true,
        club: clubs[0].name,
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          members: members.filter((m) => m.team_id === t.id).length,
        })),
        upcoming: events
          .filter((e) => !e.is_cancelled && e.starts_at >= new Date().toISOString())
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .slice(0, 6)
          .map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at })),
      };
    },
  });
  register({
    name: "open_club_section",
    title: "Ouvrir une rubrique",
    description:
      "Navigue vers le tableau de bord, le calendrier, les membres ou les équipes sans modifier les données.",
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["dashboard", "calendar", "members", "teams"] },
      },
      required: ["section"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      const paths: Record<string, string> = {
        dashboard: "/",
        calendar: "/calendar",
        members: "/members",
        teams: "/teams",
      };
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => k !== "section")
      )
        throw new Error("Rubrique invalide.");
      const section = (input as { section?: unknown }).section;
      if (typeof section !== "string" || !Object.hasOwn(paths, section))
        throw new Error("Rubrique invalide.");
      await router.navigate(paths[section]);
      return { section, path: router.state.location.pathname };
    },
  });
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
