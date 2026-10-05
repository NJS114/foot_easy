import { useTranslation } from "react-i18next";

export function LoadingState() {
  const { t } = useTranslation();
  return (
    <p role="status" className="p-4 text-sm text-muted-foreground">
      {t("common.loading")}
    </p>
  );
}

export function ErrorState({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="p-4 text-sm text-destructive">
      {error?.message ?? t("common.error")}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="p-4 text-center text-sm text-muted-foreground">{message}</p>;
}
