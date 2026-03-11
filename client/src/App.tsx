import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ExecutiveView from "@/pages/executive-view";
import ConsolidatedView from "@/pages/consolidated-view";
import DetailView from "@/pages/detail-view";
import KpiConfig from "@/pages/kpi-config";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/executive" component={ExecutiveView} />
      <Route path="/consolidated" component={ConsolidatedView} />
      <Route path="/detail" component={DetailView} />
      <Route path="/kpis" component={KpiConfig} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
