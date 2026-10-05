import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { MemberCreate } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateMember } from "@/hooks/useMembers";
import { fieldErrorFor } from "@/lib/formErrors";

type Role = NonNullable<MemberCreate["role"]>;
type Position = NonNullable<MemberCreate["position"]>;

const ROLES: Role[] = ["player", "coach", "staff"];
const POSITIONS: Position[] = ["goalkeeper", "defender", "midfielder", "forward"];

function toMemberCreate(teamId: string, data: FormData): MemberCreate {
  const role = data.get("role") as Role;
  const isPlayer = role === "player";
  const optional = (key: string) => (data.get(key) ? String(data.get(key)) : null);
  return {
    team_id: teamId,
    first_name: String(data.get("first_name")),
    last_name: String(data.get("last_name")),
    email: optional("email"),
    role,
    position: isPlayer ? (optional("position") as Position | null) : null,
    shirt_number: isPlayer && data.get("shirt_number") ? Number(data.get("shirt_number")) : null,
  };
}

export function MemberCreateForm({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const createMember = useCreateMember();
  const [role, setRole] = useState<Role>("player");
  const error = createMember.error;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    createMember.mutate(toMemberCreate(teamId, new FormData(form)), {
      onSuccess: () => form.reset(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t("members.newMember")}
      className="grid gap-3 sm:grid-cols-2"
    >
      <FormField label={t("members.firstName")} error={fieldErrorFor(error, "first_name")}>
        {(props) => <Input {...props} name="first_name" required maxLength={80} />}
      </FormField>
      <FormField label={t("members.lastName")} error={fieldErrorFor(error, "last_name")}>
        {(props) => <Input {...props} name="last_name" required maxLength={80} />}
      </FormField>
      <FormField label={t("members.email")} error={fieldErrorFor(error, "email")}>
        {(props) => <Input {...props} name="email" type="email" />}
      </FormField>
      <FormField label={t("members.role")}>
        {(props) => (
          <NativeSelect
            {...props}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {role === "player" && (
        <>
          <FormField label={t("members.position")}>
            {(props) => (
              <NativeSelect {...props} name="position" defaultValue="">
                <option value="">{t("members.noPosition")}</option>
                {POSITIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`positions.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label={t("members.shirtNumber")} error={fieldErrorFor(error, "shirt_number")}>
            {(props) => <Input {...props} name="shirt_number" type="number" min={1} max={99} />}
          </FormField>
        </>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormError error={error} />
        <Button type="submit" disabled={createMember.isPending}>
          {t("members.add")}
        </Button>
      </div>
    </form>
  );
}
