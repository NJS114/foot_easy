import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteMember, useMembers } from "@/hooks/useMembers";

export function MemberList({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMembers(teamId);
  const deleteMember = useDeleteMember();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data?.items.length) return <EmptyState message={t("members.empty")} />;

  return (
    <ul className="divide-y rounded-md border">
      {data.items.map((member) => {
        const fullName = `${member.first_name} ${member.last_name}`;
        return (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-8 text-center font-mono text-sm text-muted-foreground">
              {member.shirt_number ?? ""}
            </span>
            <Link className="flex-1 font-medium flow-link" to={`/members/${member.id}`}>{fullName}</Link>
            {member.position && (
              <span className="text-sm text-muted-foreground">
                {t(`positions.${member.position}`)}
              </span>
            )}
            <Badge variant={member.role === "player" ? "secondary" : "outline"}>
              {t(`roles.${member.role}`)}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("members.remove", { name: fullName })}
              disabled={deleteMember.isPending}
              onClick={() => deleteMember.mutate(member.id)}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
