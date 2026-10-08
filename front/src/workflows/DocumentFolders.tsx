import { useState } from "react";
import { FolderOpen, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { DocumentFolder, WorkspaceView } from "./types";
import { useAction } from "./client";
import { folderPath } from "./document-utils";
import { Field, Select, Feedback, FormActions, ConfirmButton, formValues } from "./ui";

export function FolderOptions({
  data,
  exclude = "",
  rootLabel = "Racine · sans dossier",
}: {
  data: WorkspaceView;
  exclude?: string;
  rootLabel?: string;
}) {
  return (
    <>
      <option value="">{rootLabel}</option>
      {(data.flow.folders || [])
        .filter((f) => !folderPath(data.flow.folders, f.id).some((p) => p.id === exclude))
        .sort((a, b) =>
          folderPath(data.flow.folders, a.id)
            .map((f) => f.name)
            .join("/")
            .localeCompare(
              folderPath(data.flow.folders, b.id)
                .map((f) => f.name)
                .join("/"),
            ),
        )
        .map((f) => (
          <option key={f.id} value={f.id}>
            {folderPath(data.flow.folders, f.id)
              .map((p) => p.name)
              .join(" / ")}
          </option>
        ))}
    </>
  );
}
export function FolderBrowser({
  data,
  current,
  onChange,
}: {
  data: WorkspaceView;
  current: string;
  onChange: (id: string) => void;
}) {
  const [edit, setEdit] = useState<DocumentFolder | null | undefined>(undefined);
  const action = useAction();
  const folders = data.flow.folders || [],
    active = folders.find((f) => f.id === current);
  return (
    <div className="folder-browser">
      <nav className="flow-actions" aria-label="Chemin du dossier">
        <Button variant="outline" size="sm" onClick={() => onChange("")}>
          Tous les dossiers
        </Button>
        {folderPath(folders, current).map((f) => (
          <Button variant="outline" size="sm" key={f.id} onClick={() => onChange(f.id)}>
            {f.name}
          </Button>
        ))}
      </nav>
      <div className="flow-actions">
        {folders
          .filter((f) => f.parentId === current)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((f) => (
            <Button variant="outline" key={f.id} onClick={() => onChange(f.id)}>
              <FolderOpen size={18} />
              {f.name}
            </Button>
          ))}
        <Button variant="outline" onClick={() => setEdit(null)}>
          <Plus size={16} />
          {current ? "Nouveau sous-dossier" : "Nouveau dossier"}
        </Button>
        {active && (
          <>
            <Button variant="outline" onClick={() => setEdit(active)}>
              <Pencil size={16} />
              Renommer / déplacer
            </Button>
            <ConfirmButton
              label="Supprimer le dossier vide"
              title="Supprimer ce dossier ?"
              pending={action.isPending}
              onConfirm={async () => {
                await action.mutateAsync({ type: "folder.delete", payload: { id: current } });
                onChange(active.parentId);
              }}
            >
              Seuls les dossiers vides peuvent être supprimés. Déplacez auparavant leurs fichiers et
              sous-dossiers.
            </ConfirmButton>
          </>
        )}
      </div>
      {edit !== undefined && (
        <Modal
          title={edit ? "Modifier le dossier" : "Créer un dossier"}
          onClose={() => setEdit(undefined)}
        >
          <form
            className="flow-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const result = await action.mutateAsync({
                  type: "folder.save",
                  payload: { ...formValues(e.currentTarget), id: edit?.id || "" },
                });
                setEdit(undefined);
                onChange(result.entityId);
              } catch {
                /* keep form */
              }
            }}
          >
            <Field
              label="Nom du dossier"
              name="name"
              defaultValue={edit?.name}
              required
              maxLength={120}
            />
            <Select label="Dossier parent" name="parentId" defaultValue={edit?.parentId ?? current}>
              <FolderOptions data={data} exclude={edit?.id} />
            </Select>
            <Feedback error={action.error} />
            <FormActions pending={action.isPending} onClose={() => setEdit(undefined)} />
          </form>
        </Modal>
      )}
    </div>
  );
}
