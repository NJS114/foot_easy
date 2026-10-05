import {
  Car,
  CircleDot,
  ClipboardCheck,
  Flag,
  HeartPulse,
  KeyRound,
  Plus,
  Shirt,
  Trash2,
  Utensils,
  WashingMachine,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { TeamTaskCreate, TeamTaskResponse } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { useAddDefaultTasks, useCreateTask, useDeleteTask, useTeamTasks } from "@/hooks/useTasks";
const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  laundry: { icon: WashingMachine, label: "Lessive" },
  ball: { icon: CircleDot, label: "Ballons" },
  water: { icon: Wine, label: "Eau" },
  car: { icon: Car, label: "Covoiturage" },
  flag: { icon: Flag, label: "Arbitrage" },
  key: { icon: KeyRound, label: "Clés" },
  shirt: { icon: Shirt, label: "Maillots" },
  food: { icon: Utensils, label: "Repas" },
  medkit: { icon: HeartPulse, label: "Pharmacie" },
  other: { icon: ClipboardCheck, label: "Autre" },
};
export function TaskIcon({ name }: { name: string }) {
  const Icon = ICONS[name]?.icon ?? ClipboardCheck;
  return <Icon className="size-5" aria-hidden />;
}
export function TaskCatalog({ teamId }: { teamId: string }) {
  const tasks = useTeamTasks(teamId),
    create = useCreateTask(),
    defaults = useAddDefaultTasks(),
    remove = useDeleteTask(teamId);
  const [deleting, setDeleting] = useState<TeamTaskResponse | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaved(false);
    const form = e.currentTarget,
      data = new FormData(form);
    create.mutate(
      {
        team_id: teamId,
        name: String(data.get("name")),
        icon: String(data.get("icon")) as TeamTaskCreate["icon"],
      },
      {
        onSuccess: () => {
          form.reset();
          setSaved(true);
        },
      },
    );
  };
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Les tâches de votre équipe</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Chacun contribue à la vie du collectif.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={defaults.isPending}
          onClick={() => defaults.mutate(teamId)}
        >
          Ajouter les tâches habituelles
        </Button>
      </div>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} />
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.data?.items.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="stat-icon">
                <TaskIcon name={task.icon} />
              </span>
              <span className="flex-1 text-xs font-medium">{task.name}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Supprimer ${task.name}`}
                onClick={() => setDeleting(task)}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-3 border-t pt-5"
        onSubmit={submit}
        aria-label="Créer une tâche"
      >
        <div className="min-w-40 flex-1">
          <FormField label="Nouvelle tâche">
            {(props) => (
              <Input
                {...props}
                name="name"
                required
                maxLength={60}
                placeholder="Ex. Préparer le goûter"
              />
            )}
          </FormField>
        </div>
        <FormField label="Icône">
          {(props) => (
            <NativeSelect {...props} name="icon">
              {Object.entries(ICONS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <Button disabled={create.isPending}>
          <Plus />
          Créer la tâche
        </Button>
      </form>
      <FormError error={create.error || defaults.error} />
      {saved && (
        <p role="status" className="mt-3 text-sm text-primary">
          Tâche ajoutée au catalogue.
        </p>
      )}
      {deleting && (
        <Modal title={`Supprimer « ${deleting.name} » ?`} onClose={() => setDeleting(null)}>
          <p className="mb-5 text-sm">
            Cette suppression retire aussi ses attributions et son historique dans le bilan des
            tâches.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Conserver
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
            >
              Supprimer la tâche
            </Button>
          </div>
          <FormError error={remove.error} />
        </Modal>
      )}
    </section>
  );
}
