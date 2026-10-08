import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Member, MemberCreate } from "@/api/client";
import { FormError, FormField } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateMember, useUpdateMember } from "@/hooks/useMembers";
import { MEMBER_ROLES } from "@/lib/members";
import { fieldErrorFor } from "@/lib/formErrors";

const POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
const SIZES = ["6y", "8y", "10y", "12y", "14y", "xs", "s", "m", "l", "xl", "xxl"] as const;
export function MemberCreateForm({
  teamId,
  member,
  onSuccess,
}: {
  teamId: string;
  member?: Member;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateMember();
  const update = useUpdateMember(member?.id ?? "");
  const mutation = member ? update : create;
  const [role, setRole] = useState<Member["role"]>(member?.role ?? "player");
  const [saved, setSaved] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    const form = event.currentTarget,
      data = new FormData(form);
    const optional = (key: string) => String(data.get(key) || "").trim() || null;
    const body: MemberCreate = {
      team_id: teamId,
      first_name: String(data.get("first_name")),
      last_name: String(data.get("last_name")),
      role,
      email: optional("email"),
      phone: optional("phone"),
      birth_date: optional("birth_date"),
      license_number: optional("license_number"),
      jersey_size: optional("jersey_size") as Member["jersey_size"],
      position: role === "player" ? (optional("position") as Member["position"]) : null,
      shirt_number:
        role === "player" && data.get("shirt_number") ? Number(data.get("shirt_number")) : null,
    };
    const done = () => {
      setSaved(true);
      if (!member) {
        form.reset();
        setRole("player");
      }
      onSuccess?.();
    };
    if (member) {
      const fields = { ...body } as Partial<MemberCreate>;
      delete fields.team_id;
      update.mutate(fields, { onSuccess: done });
    } else create.mutate(body, { onSuccess: done });
  };
  return (
    <form
      onSubmit={submit}
      aria-label={member ? "Modifier le membre" : t("members.newMember")}
      className="grid gap-4 sm:grid-cols-2"
    >
      <FormField label={t("members.firstName")} error={fieldErrorFor(mutation.error, "first_name")}>
        {(props) => (
          <Input
            {...props}
            name="first_name"
            required
            maxLength={80}
            defaultValue={member?.first_name}
          />
        )}
      </FormField>
      <FormField label={t("members.lastName")} error={fieldErrorFor(mutation.error, "last_name")}>
        {(props) => (
          <Input
            {...props}
            name="last_name"
            required
            maxLength={80}
            defaultValue={member?.last_name}
          />
        )}
      </FormField>
      <FormField label={t("members.email")} error={fieldErrorFor(mutation.error, "email")}>
        {(props) => (
          <Input {...props} name="email" type="email" defaultValue={member?.email ?? ""} />
        )}
      </FormField>
      <FormField label="Téléphone" error={fieldErrorFor(mutation.error, "phone")}>
        {(props) => <Input {...props} name="phone" type="tel" defaultValue={member?.phone ?? ""} />}
      </FormField>
      <FormField label={t("members.role")}>
        {(props) => (
          <NativeSelect
            {...props}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Member["role"])}
          >
            {MEMBER_ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Date de naissance">
        {(props) => (
          <Input {...props} name="birth_date" type="date" defaultValue={member?.birth_date ?? ""} />
        )}
      </FormField>
      <FormField label="Numéro de licence">
        {(props) => (
          <Input
            {...props}
            name="license_number"
            maxLength={30}
            defaultValue={member?.license_number ?? ""}
          />
        )}
      </FormField>
      <FormField label="Taille de maillot">
        {(props) => (
          <NativeSelect {...props} name="jersey_size" defaultValue={member?.jersey_size ?? ""}>
            <option value="">Non renseignée</option>
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {size.endsWith("y") ? `${size.slice(0, -1)} ans` : size.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {role === "player" && (
        <>
          <FormField label={t("members.position")}>
            {(props) => (
              <NativeSelect {...props} name="position" defaultValue={member?.position ?? ""}>
                <option value="">{t("members.noPosition")}</option>
                {POSITIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`positions.${value}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            label={t("members.shirtNumber")}
            error={fieldErrorFor(mutation.error, "shirt_number")}
          >
            {(props) => (
              <Input
                {...props}
                name="shirt_number"
                type="number"
                min={1}
                max={99}
                defaultValue={member?.shirt_number ?? ""}
              />
            )}
          </FormField>
        </>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormError error={mutation.error} />
        {saved && (
          <p role="status" className="text-sm text-primary">
            Fiche enregistrée.
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {member ? t("common.save") : t("members.add")}
        </Button>
      </div>
    </form>
  );
}
