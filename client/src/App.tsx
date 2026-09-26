import { lazy, Suspense } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/player";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
// Редактор и игровой режим грузятся лениво: ассеты игры не попадают в маршрут редактора и наоборот
const Editor = lazy(() => import("@/pages/editor"));
const Play = lazy(() => import("@/pages/play"));
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import TeamPage from "@/pages/team";

function AppRouter() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Загрузка…</div>}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/editor/:id" component={Editor} />
      <Route path="/play/:id/:mode" component={Play} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/team" component={TeamPage} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
