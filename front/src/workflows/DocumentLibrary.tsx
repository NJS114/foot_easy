import { useState, type ReactNode } from "react";
import type { FileRecord, WorkspaceView } from "./types";
import { Button } from "@/components/ui/button";
import { Page, Panel, Metrics, Select, Checkbox, SearchBox, Empty, Feedback } from "./ui";
import { useFileUpdate, downloadCSV } from "./client";
import { latestFiles, folderPath } from "./document-utils";
import { FolderBrowser, FolderOptions } from "./DocumentFolders";
import { DocumentDownload } from "./DocumentDownload";

export function DocumentLibrary({
  data,
  uploader,
  card,
}: {
  data: WorkspaceView;
  uploader: (folderId: string) => ReactNode;
  card: (file: FileRecord) => ReactNode;
}) {
  const [folder, setFolder] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [recursive, setRecursive] = useState(true),
    [versions, setVersions] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [destination, setDestination] = useState(""),
    [moveError, setMoveError] = useState<Error | null>(null),
    [moving, setMoving] = useState(false);
  const update = useFileUpdate();
  const all = versions ? data.files : latestFiles(data.files);
  const files = all.filter(
    (f) =>
      (!folder
        ? recursive || !f.folderId
        : recursive
          ? folderPath(data.flow.folders || [], f.folderId).some((p) => p.id === folder)
          : f.folderId === folder) &&
      f.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (!status ? f.status !== "archived" : f.status === status) &&
      (!category || f.category === category),
  );
  const chosen = files.filter((f) => selected.includes(f.id));
  async function move() {
    setMoving(true);
    setMoveError(null);
    try {
      for (const f of chosen) await update.mutateAsync({ id: f.id, folderId: destination });
      setSelected([]);
    } catch (e) {
      setMoveError(e as Error);
    } finally {
      setMoving(false);
    }
  }
  return (
    <Page
      title="Documents & médias"
      description="Classez les fichiers dans des dossiers, retrouvez leur origine et récupérez-les ensemble."
    >
      <Metrics
        items={[
          { label: "Documents", value: latestFiles(data.files).length },
          { label: "Dossiers", value: data.flow.folders?.length || 0 },
          {
            label: "À vérifier",
            value: latestFiles(data.files).filter((f) => f.status === "pending").length,
          },
          {
            label: "Validés",
            value: latestFiles(data.files).filter((f) => f.status === "approved").length,
          },
        ]}
      />
      <Panel title="Classement">
        <FolderBrowser
          data={data}
          current={folder}
          onChange={(id) => {
            setFolder(id);
            setSelected([]);
          }}
        />
        <Select
          label="Parcourir un dossier"
          value={folder}
          onChange={(e) => {
            setFolder(e.target.value);
            setSelected([]);
          }}
        >
          <FolderOptions data={data} rootLabel="Tous les dossiers (ou racine sans sous-dossiers)" />
        </Select>
      </Panel>
      <Panel
        title={
          folder
            ? `Ajouter dans ${folderPath(data.flow.folders || [], folder)
                .map((f) => f.name)
                .join(" / ")}`
            : "Ajouter un document"
        }
      >
        {uploader(folder)}
      </Panel>
      <Panel title="Retrouver et récupérer">
        <div className="flow-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un document" />
          <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Actifs</option>
            <option value="pending">À vérifier</option>
            <option value="approved">Validés</option>
            <option value="rejected">Refusés</option>
            <option value="archived">Archivés</option>
          </Select>
          <Select label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {[...new Set(data.files.map((f) => f.category))].map((c) => (
              <option value={c} key={c}>
                {(
                  {
                    license: "Licence",
                    medical: "Certificat médical",
                    other: "Autre document",
                    photo: "Photo",
                    parental: "Autorisation parentale",
                    receipt: "Justificatif",
                    match: "Feuille de match",
                  } as Record<string, string>
                )[c] || c}
              </option>
            ))}
          </Select>
          <Checkbox
            label="Inclure les sous-dossiers"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />
          <Checkbox
            label="Toutes les versions"
            checked={versions}
            onChange={(e) => setVersions(e.target.checked)}
          />
        </div>
        <div className="flow-actions">
          <Button
            variant="outline"
            onClick={() =>
              setSelected(chosen.length === files.length ? [] : files.map((f) => f.id))
            }
          >
            {chosen.length === files.length && files.length
              ? "Désélectionner"
              : "Tout sélectionner"}
          </Button>
          <span>
            {files.length} fichier(s) · {chosen.length} sélectionné(s)
          </span>
        </div>
        <DocumentDownload files={chosen.length ? chosen : files} data={data} />
        <Button
          variant="outline"
          onClick={() =>
            downloadCSV("foot-easy-documents.csv", [
              [
                "Document",
                "Dossier",
                "Statut",
                "Version",
                "Ajouté par",
                "Transmis par",
                "Pour les membres",
                "Rattachement",
              ],
              ...(chosen.length ? chosen : files).map((f) => [
                f.name,
                folderPath(data.flow.folders || [], f.folderId)
                  .map((p) => p.name)
                  .join(" / "),
                f.status,
                f.version,
                f.uploadedBy || "",
                data.core.members.find((m) => m.id === f.submittedByMemberId)?.last_name || "",
                (f.recipientMemberIds || [])
                  .map((id) => {
                    const m = data.core.members.find((m) => m.id === id);
                    return m ? `${m.first_name} ${m.last_name}` : id;
                  })
                  .join(", "),
                `${f.entityType}:${f.entityId}`,
              ]),
            ])
          }
        >
          Exporter la liste · CSV
        </Button>
        {!!chosen.length && (
          <div className="flow-toolbar">
            <Select
              label="Déplacer la sélection vers"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <FolderOptions data={data} />
            </Select>
            <Button disabled={moving} onClick={() => void move()}>
              {moving ? "Déplacement…" : "Déplacer la sélection"}
            </Button>
          </div>
        )}
        <Feedback error={moveError} />
        {files.length ? (
          <div className="document-grid">
            {files.map((f) => (
              <div key={f.id}>
                <Checkbox
                  label={`Sélectionner ${f.name} · v${f.version}`}
                  checked={selected.includes(f.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? [...selected, f.id] : selected.filter((id) => id !== f.id),
                    )
                  }
                />
                {card(f)}
              </div>
            ))}
          </div>
        ) : (
          <Empty>Aucun document dans cette sélection.</Empty>
        )}
      </Panel>
    </Page>
  );
}
