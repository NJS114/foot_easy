import { AppShell } from "@/components/layout/AppShell";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { CurrentClubContext, useClubs } from "@/hooks/useClubs";
import { ClubRegisterPage } from "@/pages/ClubRegisterPage";

/** Shows the club registration until a club exists, then the club space. */
export function ClubGate() {
  const { data, isLoading, error } = useClubs();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  const club = data?.items[0];
  if (!club) return <ClubRegisterPage />;

  return (
    <CurrentClubContext.Provider value={club}>
      <AppShell club={club} />
    </CurrentClubContext.Provider>
  );
}
