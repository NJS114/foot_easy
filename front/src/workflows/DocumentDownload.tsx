import { useRef, useState } from "react";
import { zip } from "fflate";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileRecord, WorkspaceView } from "./types";
import { archiveEntries } from "./document-utils";
import { Feedback } from "./ui";

export function DocumentDownload({
  files,
  data,
  name = "foot-easy-documents",
}: {
  files: FileRecord[];
  data: WorkspaceView;
  name?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState<Error | null>(null);
  const abort = useRef<AbortController | null>(null);
  async function download() {
    setError(null);
    if (files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024) {
      setError(new Error("Sélectionnez moins de fichiers : maximum 100 Mo par archive."));
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    try {
      const entries = archiveEntries(files, data.flow.folders || []),
        contents: Record<string, Uint8Array> = {};
      let next = 0,
        done = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, entries.length) }, async () => {
          while (next < entries.length) {
            const { file, path } = entries[next++];
            const response = await fetch(`${file.url}?download=1`, { signal: controller.signal });
            if (!response.ok)
              throw new Error(`Téléchargement impossible : ${file.name}. Réessayez.`);
            contents[path] = new Uint8Array(await response.arrayBuffer());
            setProgress(++done);
          }
        }),
      );
      controller.signal.throwIfAborted();
      const archive = await new Promise<Uint8Array>((resolve, reject) =>
        zip(contents, { level: 0 }, (err, result) => (err ? reject(err) : resolve(result))),
      );
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(
        new Blob([archive as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      controller.abort();
      setError(
        new Error(
          (e as Error).name === "AbortError"
            ? "Téléchargement interrompu. Vous pouvez réessayer."
            : (e as Error).message,
        ),
      );
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }
  return (
    <div>
      <div className="flow-actions">
        <Button
          variant="outline"
          disabled={!files.length || progress !== null}
          onClick={() => void download()}
        >
          <Download size={16} />
          {progress === null
            ? `Télécharger ${files.length} fichier(s) · ZIP`
            : `${progress} / ${files.length} fichiers récupérés`}
        </Button>
        {progress !== null && (
          <Button variant="outline" onClick={() => abort.current?.abort()}>
            Interrompre
          </Button>
        )}
      </div>
      <Feedback error={error} />
    </div>
  );
}
