/** Типизированные обёртки над REST API сервера */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import type { ScenarioData } from "@shared/scenario";
import type { SubmitAttempt, LeaderboardEntry, LeaderboardScope, PlayerProfile, Attempt, Depot, Team, TeamAnalytics, Notification } from "@shared/schema";
import { NOTIFICATIONS_POLL_MS } from "@shared/rules";

export interface ScenarioDto {
  id: number;
  name: string;
  description: string;
  difficulty: number;
  data: ScenarioData;
  updatedAt: number;
}

export const useScenarios = () => useQuery<ScenarioDto[]>({ queryKey: ["/api/scenarios"] });
export const useScenario = (id: number) =>
  useQuery<ScenarioDto>({ queryKey: ["/api/scenarios", id], enabled: Number.isFinite(id) });
export const useLeaderboard = (scope: LeaderboardScope = "company", id?: number) =>
  useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", scope, id ?? ""],
    queryFn: async () => (await apiRequest("GET", `/api/leaderboard?scope=${scope}${id !== undefined ? `&id=${id}` : ""}`)).json(),
    enabled: scope === "company" || id !== undefined,
  });
export const useTeamAnalytics = (teamId?: number) =>
  useQuery<TeamAnalytics>({ queryKey: ["/api/teams", teamId ?? "", "analytics"], enabled: teamId !== undefined });
export const useStructure = () => useQuery<{ depots: Depot[]; teams: Team[] }>({ queryKey: ["/api/structure"] });
export const useProfile = (name: string) =>
  useQuery<PlayerProfile>({ queryKey: ["/api/players", encodeURIComponent(name)], enabled: !!name });
export const useAttempts = (player?: string) =>
  useQuery<Attempt[]>({
    queryKey: ["/api/attempts", player ?? ""],
    queryFn: async () => (await apiRequest("GET", `/api/attempts${player ? `?player=${encodeURIComponent(player)}` : ""}`)).json(),
  });

export type ScenarioPayload = Pick<ScenarioDto, "name" | "description" | "difficulty" | "data">;

export const useSaveScenario = () =>
  useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: ScenarioPayload }) => {
      const res = id
        ? await apiRequest("PUT", `/api/scenarios/${id}`, body)
        : await apiRequest("POST", "/api/scenarios", body);
      return (await res.json()) as ScenarioDto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

export const useDeleteScenario = () =>
  useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/scenarios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] }),
  });

export const useSubmitAttempt = () =>
  useMutation({
    mutationFn: async (body: SubmitAttempt) => (await apiRequest("POST", "/api/attempts", body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attempts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

/** Уведомления: опрос сервера раз в NOTIFICATIONS_POLL_MS (TanStack Query refetchInterval) */
export const useNotifications = (player: string) =>
  useQuery<Notification[]>({
    queryKey: ["/api/notifications", player],
    queryFn: async () => (await apiRequest("GET", `/api/notifications?player=${encodeURIComponent(player)}`)).json(),
    enabled: !!player,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    staleTime: 0,
  });

export const useMarkRead = () =>
  useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/notifications/${id}/read`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
