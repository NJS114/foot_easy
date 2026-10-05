import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { apiClient, type Club, type ClubCreate } from "@/api/client";
import { unwrap } from "@/api/errors";

export const clubKeys = { all: ["clubs"] as const };

export function useClubs() {
  return useQuery({
    queryKey: clubKeys.all,
    queryFn: async () => unwrap(await apiClient.GET("/api/v1/clubs", {})),
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ClubCreate) => unwrap(await apiClient.POST("/api/v1/clubs", { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clubKeys.all }),
  });
}

export const CurrentClubContext = createContext<Club | null>(null);

/** The club the signed-in space belongs to; only usable below the club gate. */
export function useCurrentClub(): Club {
  const club = useContext(CurrentClubContext);
  if (!club) throw new Error("useCurrentClub must be used inside ClubGate");
  return club;
}
