import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useTopKills() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["topKills"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopKills();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTopPlacements() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["topPlacements"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopPlacements();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSubmitMatch() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playerName,
      kills,
      placement,
      survivalTime,
    }: {
      playerName: string;
      kills: number;
      placement: number;
      survivalTime: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.submitMatch(
        playerName,
        BigInt(kills),
        BigInt(placement),
        BigInt(Math.floor(survivalTime)),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topKills"] });
      queryClient.invalidateQueries({ queryKey: ["topPlacements"] });
    },
  });
}
