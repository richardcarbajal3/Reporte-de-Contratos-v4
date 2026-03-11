import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend, CartesianGrid } from "recharts";
import { DollarSign, FileText, Activity, TrendingUp, ShieldCheck, Lock, ChevronDown, ChevronRight, FilterX, Calendar, Clock, AlertTriangle, FileCheck, ArrowRight, Check, Printer, Shield, Banknote, Tag, Building2, User, PanelLeftClose, PanelLeft } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { aggregateSpecializedData, computeExecutiveKpis, computeStandardKpis, EXECUTIVE_KPIS, type AggregatedSheetData, type AggregatedField, type ComputedKpi } from "@/lib/specialized-sheets-config";
import { useKpiConfigStore, getEffectiveKpis } from "@/lib/kpi-store";
import type { SpecializedSheetEntry } from "@/lib/excel-processor";

export default function ExecutiveView() {
  const contracts = useAppStore(s => s.contracts);
  const consolidated = useAppStore(s => s.consolidated);
  const configuredKpis = useKpiConfigStore(s => getEffectiveKpis(s));
  const [viewMode, setViewMode] = useState<"type" | "group">("type");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedContractClasses, setSelectedContractClasses] = useState<string[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper: classify raw ESTADO into main category using substring matching
  // Handles prefixed states like "3 CERRADO (i)", "2.0 EJECUCION", etc.
  // IMPORTANT: Must be defined before any useMemo that references it to avoid TDZ.
  const getMainStateCategory = (state: string): string => {
    const s = state.toUpperCase().trim();
    if (s.includes('CERRADO')) return 'CERRADOS';
    if (s.includes('EJECUCION')) return 'EJECUCION';
    return 'FINIQUITO';
  };

  // Scroll to detail section when categories are selected
  useEffect(() => {
    if (selectedCategories.length > 0 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCategories]);

  // Extract unique contract classes (filtered by state if active)
  const availableContractClasses = useMemo(() => {
    const classes = new Set<string>();
    const source = selectedStateFilter
      ? consolidated.filter(c => {
          const raw = c.state?.trim() || 'Sin Estado';
          const main = getMainStateCategory(raw);
          if (selectedStateFilter === 'EJECUCION' || selectedStateFilter === 'CERRADOS') return main === selectedStateFilter;
          if (selectedStateFilter === 'FINIQUITO') return main === 'FINIQUITO';
          return raw === selectedStateFilter;
        })
      : consolidated;
    source.forEach(c => {
      c.items.forEach(i => { if (i.contractClass) classes.add(i.contractClass); });
    });
    return Array.from(classes).sort();
  }, [consolidated, selectedStateFilter]);

  // Auto-clear class selections that are no longer available when state filter changes
  useEffect(() => {
    if (selectedContractClasses.length > 0) {
      const valid = selectedContractClasses.filter(cls => availableContractClasses.includes(cls));
      if (valid.length !== selectedContractClasses.length) {
        setSelectedContractClasses(valid);
      }
    }
  }, [availableContractClasses]);

  const filteredByClassConsolidated = useMemo(() => {
    if (selectedContractClasses.length === 0) return consolidated;
    return consolidated.filter(c => c.items.some(i => selectedContractClasses.includes(i.contractClass || '')));
  }, [consolidated, selectedContractClasses]);

  // Status hierarchy for Estado Contratos KPI card
  // Responds to class filter AND category selection from pie chart
  const statusHierarchy = useMemo(() => {
    const source = selectedCategories.length > 0
      ? filteredByClassConsolidated.filter(c =>
          c.items.some(item => {
            const key = viewMode === "type"
              ? (item.investmentType || 'Otros')
              : (item.investmentGroup || 'Sin Grupo');
            return selectedCategories.includes(key);
          })
        )
      : filteredByClassConsolidated;

    const mainCounts: Record<string, number> = { EJECUCION: 0, FINIQUITO: 0, CERRADOS: 0 };
    const finiquitoSubs: Record<string, number> = {};

    source.forEach(c => {
      const raw = c.state?.trim() || 'Sin Estado';
      const main = getMainStateCategory(raw);
      mainCounts[main] = (mainCounts[main] || 0) + 1;
      if (main === 'FINIQUITO') {
        finiquitoSubs[raw] = (finiquitoSubs[raw] || 0) + 1;
      }
    });

    return { mainCounts, finiquitoSubs };
  }, [filteredByClassConsolidated, selectedCategories, viewMode]);

  // Apply state filter on top of class filter
  const filteredByStateConsolidated = useMemo(() => {
    if (!selectedStateFilter) return filteredByClassConsolidated;
    return filteredByClassConsolidated.filter(c => {
      const raw = c.state?.trim() || 'Sin Estado';
      const main = getMainStateCategory(raw);
      // If the filter is a main category, match all contracts in that category
      if (selectedStateFilter === 'EJECUCION' || selectedStateFilter === 'CERRADOS') {
        return main === selectedStateFilter;
      }
      // If the filter is a specific sub-state within FINIQUITO
      if (main === 'FINIQUITO') {
        // If user selected "FINIQUITO" (main), show all finiquito contracts
        if (selectedStateFilter === 'FINIQUITO') return true;
        // If user selected a specific sub-state, match exactly
        return raw === selectedStateFilter;
      }
      return false;
    });
  }, [filteredByClassConsolidated, selectedStateFilter]);

  // KPI source: use category-filtered contracts if categories are selected, otherwise use state-filtered
  const kpiSource = useMemo(() => {
    if (selectedCategories.length === 0) return filteredByStateConsolidated;
    return filteredByStateConsolidated.filter(c =>
      c.items.some(item => {
        const key = viewMode === "type"
          ? (item.investmentType || 'Otros')
          : (item.investmentGroup || 'Sin Grupo');
        return selectedCategories.includes(key);
      })
    );
  }, [filteredByStateConsolidated, selectedCategories, viewMode]);

  const totalInvestment = kpiSource.reduce((acc, c) => acc + c.totalAmount, 0);
  const totalPaid = kpiSource.reduce((acc, c) => acc + c.totalPaid, 0);
  // Suma de Retención (Pagos) + Garantías (Cartas Fianza)
  const totalRetentionAndGuarantees = kpiSource.reduce((acc, c) => acc + c.totalRetention + c.totalGuarantees, 0);

  // Executive KPIs from specialized sheets (E_arrendamiento, E_obras, etc.)
  const executiveKpis = useMemo((): ComputedKpi[] => {
    const allEntries = kpiSource.flatMap(c => c.items.flatMap(i => i.specializedData));
    if (allEntries.length === 0) return [];
    const result = computeExecutiveKpis(allEntries, configuredKpis);
    return result;
  }, [kpiSource, configuredKpis]);

  // Standard KPIs from contract fields (always available)
  const standardKpis = useMemo((): ComputedKpi[] => {
    return computeStandardKpis(kpiSource);
  }, [kpiSource]);

  // Check if any contract has specialized data (for showing info message)
  const hasAnySpecializedData = useMemo(() => {
    return consolidated.some(c => c.items.some(i => i.specializedData.length > 0));
  }, [consolidated]);

  // Build a set of contract IDs from the state-filtered consolidated list for filtering individual contracts
  const stateFilteredContractIds = useMemo(() => {
    if (!selectedStateFilter) return null;
    const ids = new Set<string>();
    filteredByStateConsolidated.forEach(c => ids.add(c.contractId));
    return ids;
  }, [filteredByStateConsolidated, selectedStateFilter]);

  // Chart Data: Investment by Type vs Group (Filtered by Class + State)
  const investmentMap = useMemo(() => {
    return contracts.reduce((acc, c) => {
      // Filter by Class first
      if (selectedContractClasses.length > 0 && !selectedContractClasses.includes(c.contractClass || '')) return acc;
      // Filter by State
      if (stateFilteredContractIds && !stateFilteredContractIds.has(c.contractId)) return acc;

      const key = viewMode === "type"
        ? (c.investmentType || 'Otros')
        : (c.investmentGroup || 'Sin Grupo');
      acc[key] = (acc[key] || 0) + c.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [contracts, viewMode, selectedContractClasses, stateFilteredContractIds]);
  
  const investmentChartData = Object.entries(investmentMap).map(([name, value]) => ({ name, value }));

  // Filtered Contracts Logic - Show CONSOLIDATED Contracts that match the category AND Class AND State
  const filteredConsolidatedContracts = useMemo(() => {
    if (selectedCategories.length === 0) return [];

    return filteredByStateConsolidated.filter(c => {
        // Check if any addendum in this contract matches ANY of the selected categories
        return c.items.some(item => {
           const key = viewMode === "type"
            ? (item.investmentType || 'Otros')
            : (item.investmentGroup || 'Sin Grupo');
           return selectedCategories.includes(key);
        });
      });
  }, [filteredByStateConsolidated, selectedCategories, viewMode]);

  const selectedContractDetails = selectedContractId
    ? consolidated.find(c => c.contractId === selectedContractId)
    : null;

  // Detail dialog helpers
  const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getParentInfo = (items: typeof contracts) => items.find(i => i.addendumId === '0') || items[0];
  const getGroupGuarantees = (items: typeof contracts) => items.flatMap(i => i.guaranteesList);
  const getGroupAdelanto = (items: typeof contracts) => {
    const total = items.reduce((s, i) => s + i.adelantoContrato, 0);
    const amort = items.reduce((s, i) => s + i.amortizacionAdelanto, 0);
    return { total, amort, pending: total - amort };
  };

  // Chart Data: Contracts grouped by Estado (main category → sub-states with amounts)
  // Uses filteredByStateConsolidated so chart reflects the state filter
  const { stateChartData, allSubStates } = useMemo(() => {
    const categoryMap: Record<string, Record<string, { count: number; amount: number }>> = {};

    filteredByStateConsolidated.forEach(c => {
      const raw = c.state?.trim() || 'Sin Estado';
      const main = getMainStateCategory(raw);
      if (!categoryMap[main]) categoryMap[main] = {};
      if (!categoryMap[main][raw]) categoryMap[main][raw] = { count: 0, amount: 0 };
      categoryMap[main][raw].count += 1;
      categoryMap[main][raw].amount += c.totalAmount;
    });

    const order = ['EJECUCION', 'FINIQUITO', 'CERRADOS'];
    const subStatesSet = new Set<string>();

    const data = order
      .filter(cat => categoryMap[cat])
      .map(cat => {
        const entry: Record<string, any> = { mainState: cat };
        let totalCount = 0;
        Object.entries(categoryMap[cat]).forEach(([sub, info]) => {
          entry[sub] = info.amount;
          entry[`${sub}_count`] = info.count;
          totalCount += info.count;
          subStatesSet.add(sub);
        });
        entry._totalCount = totalCount;
        return entry;
      });

    return { stateChartData: data, allSubStates: Array.from(subStatesSet) };
  }, [filteredByStateConsolidated]);

  // Format aggregated field values for display
  const fmtField = (f: AggregatedField) => {
    if (f.format === 'text') return String(f.value);
    const num = Number(f.value);
    if (f.format === 'currency') return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals });
    if (f.format === 'percent') return `${num.toFixed(f.decimals)}%`;
    return num.toLocaleString('es-PE', { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals });
  };

  // Compute aggregated specialized data for filtered contracts
  const filteredSpecializedAggregation = useMemo((): AggregatedSheetData[] => {
    if (filteredConsolidatedContracts.length === 0) return [];
    const allEntries: SpecializedSheetEntry[] = filteredConsolidatedContracts.flatMap(c =>
      c.items.flatMap(i => i.specializedData)
    );
    if (allEntries.length === 0) return [];
    return aggregateSpecializedData(allEntries);
  }, [filteredConsolidatedContracts]);

  // Collapsible state for dialog blocks
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const toggleBlock = (blockId: string) => setCollapsedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  const isBlockOpen = (blockId: string) => !collapsedBlocks[blockId]; // open by default

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Monthly payments aggregation with contract-level detail
  // Responds to class, state, AND category selection from pie chart
  const { monthlyPaymentsData, monthlyPaymentsDetail } = useMemo(() => {
    const monthMap: Record<string, { month: string; monto: number }> = {};
    const detailMap: Record<string, { contractId: string; description: string; company: string; monto: number }[]> = {};
    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    let contractsToUse = selectedContractClasses.length > 0
      ? contracts.filter(c => selectedContractClasses.includes(c.contractClass || ''))
      : contracts;
    if (stateFilteredContractIds) {
      contractsToUse = contractsToUse.filter(c => stateFilteredContractIds.has(c.contractId));
    }
    // Filter by selected categories (group/type from pie chart)
    if (selectedCategories.length > 0) {
      const categoryContractIds = new Set(
        filteredByStateConsolidated
          .filter(c => c.items.some(item => {
            const key = viewMode === "type"
              ? (item.investmentType || 'Otros')
              : (item.investmentGroup || 'Sin Grupo');
            return selectedCategories.includes(key);
          }))
          .map(c => c.contractId)
      );
      contractsToUse = contractsToUse.filter(c => categoryContractIds.has(c.contractId));
    }

    contractsToUse.forEach(c => {
      c.paymentsList.forEach(p => {
        if (!p.fechaContabilizacion || p.fechaContabilizacion === '-') return;
        const parts = p.fechaContabilizacion.split('/');
        if (parts.length !== 3) return;
        const monthIdx = parseInt(parts[1], 10) - 1;
        const year = parts[2];
        if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return;
        const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        const label = `${MONTH_NAMES[monthIdx]} ${year}`;
        if (!monthMap[key]) {
          monthMap[key] = { month: label, monto: 0 };
        }
        monthMap[key].monto += p.monto;
        if (!detailMap[key]) detailMap[key] = [];
        detailMap[key].push({
          contractId: c.contractId,
          description: c.description || '-',
          company: c.company || '-',
          monto: p.monto,
        });
      });
    });

    const sorted = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b));
    return {
      monthlyPaymentsData: sorted.map(([key, v]) => ({ ...v, key })),
      monthlyPaymentsDetail: detailMap,
    };
  }, [contracts, selectedContractClasses, stateFilteredContractIds, selectedCategories, viewMode, filteredByStateConsolidated]);

  // Aggregate detail by contract for selected month (enriched with cumulative progress)
  const selectedMonthDetail = useMemo(() => {
    if (!selectedMonth || !monthlyPaymentsDetail[selectedMonth]) return [];
    const byContract: Record<string, { contractId: string; description: string; company: string; monto: number; totalAmount: number; totalPaid: number }> = {};
    monthlyPaymentsDetail[selectedMonth].forEach(d => {
      if (!byContract[d.contractId]) {
        const cons = consolidated.find(c => c.contractId === d.contractId);
        byContract[d.contractId] = {
          ...d,
          totalAmount: cons?.totalAmount ?? 0,
          totalPaid: cons?.totalPaid ?? 0,
        };
      } else {
        byContract[d.contractId].monto += d.monto;
      }
    });
    return Object.values(byContract).sort((a, b) => b.monto - a.monto);
  }, [selectedMonth, monthlyPaymentsDetail, consolidated]);

  const COLORS = ['hsl(221, 83%, 53%)', 'hsl(215, 25%, 27%)', 'hsl(200, 90%, 70%)', 'hsl(210, 20%, 90%)', '#F59E0B', '#10B981', '#6366F1', '#EC4899'];

  const onPieClick = (data: any) => {
    if (data && data.name) {
      setSelectedCategories(prev => {
        if (prev.includes(data.name)) {
          return prev.filter(cat => cat !== data.name);
        } else {
          return [...prev, data.name];
        }
      });
      setSelectedContractId(null);
    }
  };

  const toggleCategory = (categoryName: string) => {
      setSelectedCategories(prev => {
        if (prev.includes(categoryName)) {
          return prev.filter(cat => cat !== categoryName);
        } else {
          return [...prev, categoryName];
        }
      });
      setSelectedContractId(null);
  };

  const toggleContractClass = (cls: string) => {
    setSelectedContractClasses(prev => {
      if (prev.includes(cls)) {
        return prev.filter(c => c !== cls);
      } else {
        return [...prev, cls];
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-2 print:mb-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-heading font-bold text-foreground">Reporte Ejecutivo</h2>
          <span className="text-xs text-muted-foreground print:hidden">Visión estratégica</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto print:hidden">
          {/* Export to PDF Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs border-dashed gap-2"
            onClick={() => window.print()}
          >
            <Printer className="h-3 w-3" />
            Exportar PDF
          </Button>

          {/* Class Filter (Multi-select) */}
          <div className="flex items-center gap-2 bg-card border p-1.5 rounded-lg shadow-sm">
             <span className="text-xs font-medium text-muted-foreground ml-2">Clase:</span>
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="outline" size="sm" className="h-8 text-xs border-dashed">
                   {selectedContractClasses.length === 0 
                     ? "Todas las clases" 
                     : `${selectedContractClasses.length} seleccionadas`}
                   <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="p-0 w-[200px]" align="start">
                 <Command>
                   <CommandInput placeholder="Buscar clase..." className="h-8 text-xs" />
                   <CommandList>
                     <CommandEmpty>No se encontraron clases.</CommandEmpty>
                     <CommandGroup>
                       {availableContractClasses.map(cls => (
                         <CommandItem
                           key={cls}
                           onSelect={() => toggleContractClass(cls)}
                           className="text-xs"
                         >
                           <div className={cn(
                             "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                             selectedContractClasses.includes(cls)
                               ? "bg-primary text-primary-foreground"
                               : "opacity-50 [&_svg]:invisible"
                           )}>
                             <Check className={cn("h-3 w-3")} />
                           </div>
                           {cls}
                         </CommandItem>
                       ))}
                     </CommandGroup>
                     {selectedContractClasses.length > 0 && (
                       <>
                         <Separator />
                         <CommandGroup>
                           <CommandItem
                             onSelect={() => setSelectedContractClasses([])}
                             className="justify-center text-center text-xs"
                           >
                             Limpiar filtros
                           </CommandItem>
                         </CommandGroup>
                       </>
                     )}
                   </CommandList>
                 </Command>
               </PopoverContent>
             </Popover>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
            <Button 
              variant={viewMode === "type" ? "default" : "ghost"} 
              size="sm"
              onClick={() => { setViewMode("type"); setSelectedCategories([]); }}
              className="text-xs"
            >
              Por Tipo Inversión
            </Button>
            <Button 
              variant={viewMode === "group" ? "default" : "ghost"} 
              size="sm"
              onClick={() => { setViewMode("group"); setSelectedCategories([]); }}
              className="text-xs"
            >
              Por Grupo Inversión
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {selectedCategories.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-primary font-medium">
          <Activity className="h-3.5 w-3.5" />
          Mostrando datos de: {selectedCategories.length > 3 ? `${selectedCategories.length} categorías` : selectedCategories.join(', ')}
          <span className="text-muted-foreground">({kpiSource.length} contratos)</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {totalInvestment.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Monto contratado (Sin IGV)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagado a la Fecha</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600">
              {totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pagado (Sin IGV)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custodia Total (Ret. + Garantías)</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-orange-600">
              {totalRetentionAndGuarantees.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Retenciones + Cartas Fianza</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estado ({filteredByClassConsolidated.length})
              {selectedStateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 ml-2 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedStateFilter(null)}
                >
                  <FilterX className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              )}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1 text-center">
              {(['EJECUCION', 'FINIQUITO', 'CERRADOS'] as const).map(mainState => {
                const count = statusHierarchy.mainCounts[mainState] || 0;
                const isActive = selectedStateFilter === mainState;
                return (
                  <div
                    key={mainState}
                    onClick={() => setSelectedStateFilter(isActive ? null : mainState)}
                    className={cn(
                      "cursor-pointer rounded-md p-2 transition-all border",
                      isActive
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "border-transparent hover:bg-muted"
                    )}
                  >
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{mainState}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Section: Standard (always) + Specialized (from E_ sheets) */}
      {(standardKpis.length > 0 || executiveKpis.length > 0) && (
        <div className="mb-6 space-y-3">
          {/* Standard KPIs - always visible */}
          {standardKpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {standardKpis.map((kpi) => (
                <Card key={kpi.label} className="border border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                    <p className="text-lg font-bold font-mono mt-1">
                      {kpi.format === 'currency'
                        ? (kpi.value as number).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: kpi.decimals })
                        : kpi.format === 'percent'
                        ? `${(kpi.value as number).toFixed(kpi.decimals)}%`
                        : (kpi.value as number).toLocaleString('es-PE', { minimumFractionDigits: kpi.decimals, maximumFractionDigits: kpi.decimals })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Specialized KPIs from E_ sheets */}
          {executiveKpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {executiveKpis.map((kpi) => (
                <Card key={kpi.label} className="border-dashed border-blue-200 bg-blue-50/20">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                    <p className="text-lg font-bold font-mono mt-1">
                      {kpi.format === 'currency'
                        ? (kpi.value as number).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: kpi.decimals })
                        : kpi.format === 'percent'
                        ? `${(kpi.value as number).toFixed(kpi.decimals)}%`
                        : (kpi.value as number).toLocaleString('es-PE', { minimumFractionDigits: kpi.decimals, maximumFractionDigits: kpi.decimals })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Info message when no E_ sheets exist */}
          {!hasAnySpecializedData && contracts.length > 0 && (
            <div className="p-2 border border-dashed border-muted-foreground/20 rounded-lg text-[11px] text-muted-foreground text-center">
              KPIs especializados (ej. área, USD/ha, M2) disponibles al incluir hojas <span className="font-mono font-medium">E_arrendamiento</span>, <span className="font-mono font-medium">E_obras</span>, etc. en el Excel
            </div>
          )}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Contratos por Estado</CardTitle>
            <CardDescription>Distribución de montos por estado contractual (sub-estados)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateChartData} layout="vertical" margin={{ left: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="mainState" type="category" width={100} tick={{fontSize: 12}} />
                  <Tooltip
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: string, props: any) => {
                      const countKey = `${name}_count`;
                      const count = props.payload[countKey];
                      return [
                        `${Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (${count} cto${count !== 1 ? 's' : ''})`,
                        name
                      ];
                    }}
                  />
                  <Legend />
                  {allSubStates.map((sub, i) => (
                    <Bar
                      key={sub}
                      dataKey={sub}
                      stackId="estado"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === allSubStates.length - 1 ? [0, 4, 4, 0] : undefined}
                      barSize={28}
                      name={sub}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 relative overflow-hidden">
           {selectedCategories.length > 0 && (
            <div className="absolute top-2 right-2 z-10">
              <Button size="sm" variant="secondary" onClick={() => setSelectedCategories([])} className="h-6 text-xs gap-1">
                <FilterX className="h-3 w-3" /> Limpiar ({selectedCategories.length})
              </Button>
            </div>
           )}
          <CardHeader>
            <CardTitle>Inversión por {viewMode === 'type' ? 'Tipo' : 'Grupo'}</CardTitle>
            <CardDescription>
              {selectedCategories.length > 0
                ? <span className="text-primary font-medium">Filtrado por: {selectedCategories.join(', ')}</span> 
                : "Selecciona una o más categorías para ver detalles"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Chart Side */}
              <div className="h-[300px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={investmentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={onPieClick}
                      cursor="pointer"
                    >
                      {investmentChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          stroke={selectedCategories.includes(entry.name) ? "black" : "none"}
                          strokeWidth={2}
                          className="transition-all duration-300 hover:opacity-80"
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend/Buttons Side */}
              <div className="flex-1 max-h-[300px] overflow-y-auto pr-2 space-y-2">
                {investmentChartData.sort((a,b) => b.value - a.value).map((entry, index) => {
                  const color = COLORS[index % COLORS.length];
                  const isSelected = selectedCategories.includes(entry.name);
                  const total = investmentChartData.reduce((acc, curr) => acc + curr.value, 0);
                  const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";

                  return (
                    <div 
                      key={entry.name}
                      onClick={() => toggleCategory(entry.name)}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border",
                        isSelected ? "bg-primary/10 border-primary shadow-sm" : "bg-background hover:bg-muted border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full ring-1 ring-white" />
                          )}
                        </div>
                        <span className="text-xs font-medium truncate max-w-[120px]" title={entry.name}>
                          {entry.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold">
                          {entry.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{percent}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Payments Chart */}
      {monthlyPaymentsData.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                Pagos por Mes
              </CardTitle>
              <CardDescription>Selecciona una barra para ver el detalle de pagos del mes</CardDescription>
            </div>
            {selectedMonth && (
              <Button size="sm" variant="secondary" onClick={() => setSelectedMonth(null)} className="h-6 text-xs gap-1">
                <FilterX className="h-3 w-3" /> Limpiar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPaymentsData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [
                      Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                      'Pagado'
                    ]}
                    labelFormatter={(label) => `Mes: ${label}`}
                  />
                  <Bar
                    dataKey="monto"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data: any) => data && setSelectedMonth(data.key)}
                  >
                    {monthlyPaymentsData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={selectedMonth === entry.key ? 'hsl(221, 83%, 53%)' : 'hsl(142, 71%, 45%)'}
                        strokeWidth={selectedMonth === entry.key ? 2 : 0}
                        stroke="hsl(221, 83%, 40%)"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detail table for selected month */}
            {selectedMonth && selectedMonthDetail.length > 0 && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-5 duration-300">
                <h4 className="text-sm font-medium mb-2">
                  Detalle: <span className="text-primary">{monthlyPaymentsData.find(m => m.key === selectedMonth)?.month}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({selectedMonthDetail.length} contratos)</span>
                </h4>
                <div className="max-h-[300px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                      <TableRow>
                        <TableHead>Nro Contrato</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Monto Pagado</TableHead>
                        <TableHead className="text-center">% Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedMonthDetail.map((d) => {
                        const pctAcum = d.totalAmount > 0 ? (d.totalPaid / d.totalAmount) * 100 : 0;
                        return (
                        <TableRow key={d.contractId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedContractId(d.contractId)}>
                          <TableCell className="font-mono text-xs font-bold">{d.contractId}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={d.description}>{d.description}</TableCell>
                          <TableCell className="text-xs">{d.company}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-green-600">
                            {d.monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-500"
                                  style={{ width: `${Math.min(pctAcum, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-blue-600 font-medium">{pctAcum.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter className="bg-primary/5 font-bold">
                      <TableRow>
                        <TableCell colSpan={3}>Total</TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {selectedMonthDetail.reduce((a, b) => a + b.monto, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filtered Contracts Detail Section */}
      {selectedCategories.length > 0 && (
        <div ref={scrollRef} className="animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="flex items-center gap-2 mb-4">
             <ChevronDown className="h-5 w-5 text-primary animate-bounce" />
             <h3 className="text-2xl font-heading font-bold">
               Contratos Padre en: <span className="text-primary">{selectedCategories.length > 3 ? `${selectedCategories.length} categorías seleccionadas` : selectedCategories.join(', ')}</span>
             </h3>
          </div>

          {/* KPI strip for selected category */}
          {(standardKpis.length > 0 || executiveKpis.length > 0) && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
              {standardKpis.map((kpi) => (
                <div key={`detail-std-${kpi.label}`} className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-sm font-bold font-mono">
                    {kpi.format === 'currency'
                      ? (kpi.value as number).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: kpi.decimals })
                      : kpi.format === 'percent'
                      ? `${(kpi.value as number).toFixed(kpi.decimals)}%`
                      : (kpi.value as number).toLocaleString('es-PE', { minimumFractionDigits: kpi.decimals, maximumFractionDigits: kpi.decimals })}
                  </p>
                </div>
              ))}
              {executiveKpis.map((kpi) => (
                <div key={`detail-spec-${kpi.label}`} className="rounded-lg border border-dashed border-blue-200 bg-blue-50/20 p-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-sm font-bold font-mono">
                    {kpi.format === 'currency'
                      ? (kpi.value as number).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: kpi.decimals })
                      : kpi.format === 'percent'
                      ? `${(kpi.value as number).toFixed(kpi.decimals)}%`
                      : (kpi.value as number).toLocaleString('es-PE', { minimumFractionDigits: kpi.decimals, maximumFractionDigits: kpi.decimals })}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Contrato Padre</TableHead>
                      <TableHead>Descripción (Primigenio)</TableHead>
                      <TableHead>Clase</TableHead>
                      <TableHead className="text-right">Monto Total</TableHead>
                      <TableHead className="text-right">Pagado Total</TableHead>
                      <TableHead className="text-center">% Pagado</TableHead>
                      <TableHead className="text-right">Custodia Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsolidatedContracts.map((c) => {
                       const mainContract = c.items.find(i => i.addendumId === '0') || c.items[0];
                       // Find which class triggered the inclusion if needed, but let's just show main class
                       const contractClass = mainContract?.contractClass || 'Sin Clase';
                       const percentPaid = c.totalAmount > 0 ? (c.totalPaid / c.totalAmount) * 100 : 0;
                       
                       return (
                      <TableRow 
                        key={c.contractId} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedContractId(c.contractId)}
                      >
                        <TableCell className="font-mono text-xs font-bold">{c.contractId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={mainContract?.description}>
                          {mainContract?.description || 'Sin descripción'}
                        </TableCell>
                         <TableCell>
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">{contractClass}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {c.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-green-600">
                          {c.totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(percentPaid, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-blue-600 font-medium">{percentPaid.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-orange-600">
                          {(c.totalRetention + c.totalGuarantees).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{c.state}</Badge>
                        </TableCell>
                        <TableCell>
                           <Button size="icon" variant="ghost" className="h-6 w-6">
                             <ArrowRight className="h-4 w-4" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    )})}
                    {filteredConsolidatedContracts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                          No se encontraron contratos para estas categorías.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {filteredConsolidatedContracts.length > 0 && (
                    <TableFooter className="bg-primary/5 font-bold">
                      <TableRow>
                        <TableCell colSpan={3}>Total ({filteredConsolidatedContracts.length} contratos)</TableCell>
                        <TableCell className="text-right font-mono">
                          {filteredConsolidatedContracts.reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {filteredConsolidatedContracts.reduce((a, b) => a + b.totalPaid, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const totalAmt = filteredConsolidatedContracts.reduce((a, b) => a + b.totalAmount, 0);
                            const totalPaidAmt = filteredConsolidatedContracts.reduce((a, b) => a + b.totalPaid, 0);
                            const pct = totalAmt > 0 ? (totalPaidAmt / totalAmt) * 100 : 0;
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 transition-all duration-500"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-blue-700">{pct.toFixed(1)}%</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-700">
                          {filteredConsolidatedContracts.reduce((a, b) => a + b.totalRetention + b.totalGuarantees, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Aggregated Specialized Data for Filtered Group */}
          {filteredSpecializedAggregation.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSpecializedAggregation.map((sheet) => (
                <Card key={sheet.sheetType} className="border-dashed border-blue-300 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      Datos Adicionales: {sheet.label}
                    </CardTitle>
                    <CardDescription className="text-xs">Agregado del grupo filtrado ({filteredConsolidatedContracts.length} contratos)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sheet.fields.map((f) => (
                        <div key={f.label} className="text-center p-2 rounded-md bg-background border">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</div>
                          <div className="text-sm font-mono font-bold mt-1">{fmtField(f)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed Contract Modal/Dialog */}
      <Dialog open={!!selectedContractId} onOpenChange={(open) => !open && setSelectedContractId(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:h-auto print:overflow-visible">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-2xl font-heading flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Detalle Contrato Padre: {selectedContractId}
            </DialogTitle>
            <DialogDescription>
               Vista consolidada y desglose por adendas
            </DialogDescription>
          </DialogHeader>

          {selectedContractDetails && (() => {
            const parent = getParentInfo(selectedContractDetails.items);
            const guarantees = getGroupGuarantees(selectedContractDetails.items);
            const adelanto = getGroupAdelanto(selectedContractDetails.items);
            const contractSpecialized = aggregateSpecializedData(
              selectedContractDetails.items.flatMap(i => i.specializedData)
            );
            const subtotalInicio = selectedContractDetails.items.find(i => i.startDate && i.startDate !== '-')?.startDate || '-';
            const subtotalFin = selectedContractDetails.items.find(i => i.endDate && i.endDate !== '-')?.endDate || '-';
            const subtotalMonto = selectedContractDetails.items.reduce((s, i) => s + i.amount, 0);

            return (
             <div className="space-y-0">
                {/* ============ BLOQUE 1: Data General ============ */}
                <div className="pb-3 border-b bg-muted/30 rounded-t-lg px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-heading font-bold">
                        Contrato Padre: <span className="font-mono">{selectedContractDetails.contractId}</span>
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        selectedContractDetails.state === 'Activo' ? 'bg-green-100 text-green-700' :
                        selectedContractDetails.state === 'Cerrado' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedContractDetails.state}
                      </span>
                    </div>

                    {parent?.description && (
                      <p className="text-sm text-foreground">{parent.description}</p>
                    )}
                    {parent?.chineseDescription && (
                      <p className="text-sm text-muted-foreground italic">{parent.chineseDescription}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                      {parent?.contractClass && parent.contractClass !== 'Sin Clase' && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Clase: <span className="text-foreground font-medium">{parent.contractClass}</span>
                        </span>
                      )}
                      {parent?.company && parent.company !== '-' && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          Empresa: <span className="text-foreground font-medium">{parent.company}</span>
                        </span>
                      )}
                      {parent?.responsible && parent.responsible !== '-' && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Resp: <span className="text-foreground font-medium">{parent.responsible}</span>
                        </span>
                      )}
                    </div>

                    {guarantees.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <Shield className="h-3 w-3" />
                          Cartas Fianza / Polizas:
                        </span>
                        <div className="grid gap-1 ml-4">
                          {guarantees.map((g, i) => (
                            <div key={i} className="text-xs text-muted-foreground flex flex-wrap gap-3">
                              <span>Nro: <span className="text-foreground font-medium">{g.nroCarta}</span></span>
                              <span>Monto: <span className="text-foreground font-mono">{fmt(g.monto)}</span></span>
                              <span>Vigencia: <span className="text-foreground font-medium">{g.fechaVencimiento}</span></span>
                              {g.detalle !== '-' && <span>({g.detalle})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adelanto.total > 0 && (
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Banknote className="h-3 w-3" />
                          Adelanto Contrato: <span className="text-foreground font-mono font-medium">{fmt(adelanto.total)}</span>
                        </span>
                        <span>
                          Amortizacion: <span className="text-foreground font-mono font-medium">{fmt(adelanto.amort)}</span>
                        </span>
                        <span>
                          Por Amortizar: <span className="text-orange-600 font-mono font-medium">{fmt(adelanto.pending)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ============ BLOQUE 2: Detalle Contractual (Collapsible) ============ */}
                <Collapsible open={isBlockOpen('contractual')} onOpenChange={() => toggleBlock('contractual')}>
                  <div className="border-b">
                    <CollapsibleTrigger asChild>
                      <button className="w-full px-4 py-2 bg-muted/20 flex items-center gap-2 hover:bg-muted/40 transition-colors cursor-pointer">
                        {isBlockOpen('contractual') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <h4 className="text-sm font-medium text-foreground">Detalle Contractual</h4>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="w-[120px]">Contrato / Adenda</TableHead>
                              <TableHead className="min-w-[180px]">Descripcion</TableHead>
                              <TableHead className="text-center">Inicio Plazo</TableHead>
                              <TableHead className="text-center">Plazo</TableHead>
                              <TableHead className="text-center">Fin</TableHead>
                              <TableHead className="text-center">Ampliacion Plazo</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                              <TableHead className="text-right">Deductivo</TableHead>
                              <TableHead className="text-right">Monto Neto</TableHead>
                              <TableHead className="min-w-[150px]">Observaciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedContractDetails.items.map((row) => (
                              <TableRow key={row.key} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="text-xs font-medium">
                                  {row.addendumId === '0' ? 'Contrato' : `Adenda ${row.addendumId}`}
                                </TableCell>
                                <TableCell className="text-xs">{row.description || '-'}</TableCell>
                                <TableCell className="text-xs text-center">{row.startDate || '-'}</TableCell>
                                <TableCell className="text-xs text-center">{row.executionTerm || '-'}</TableCell>
                                <TableCell className="text-xs text-center">{row.endDate || '-'}</TableCell>
                                <TableCell className="text-xs text-center">{row.extensionTerm && row.extensionTerm !== '-' ? row.extensionTerm : '-'}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{fmt(row.amount)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                  {row.deductivo ? fmt(row.deductivo) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-medium">{fmt(row.amountNet)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px]" title={row.observaciones}>
                                  {row.observaciones || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell className="text-xs font-bold" colSpan={2}>Subtotal</TableCell>
                              <TableCell className="text-xs text-center">{subtotalInicio}</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-xs text-center">{subtotalFin}</TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">{fmt(subtotalMonto)}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.deductivo, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.amountNet, 0))}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* ============ BLOQUE 3: Detalle de Pagos y Facturas (Collapsible) ============ */}
                <Collapsible open={isBlockOpen('pagos')} onOpenChange={() => toggleBlock('pagos')}>
                  <div className="border-b">
                    <CollapsibleTrigger asChild>
                      <button className="w-full px-4 py-2 bg-muted/20 flex items-center gap-2 hover:bg-muted/40 transition-colors cursor-pointer">
                        {isBlockOpen('pagos') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <h4 className="text-sm font-medium text-foreground">Detalle de Pagos y Financiero</h4>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="w-[120px]">Contrato / Adenda</TableHead>
                              <TableHead className="text-right text-green-600">Pagos</TableHead>
                              <TableHead className="text-right">Provisiones</TableHead>
                              <TableHead className="text-right">O. Servicio</TableHead>
                              <TableHead className="text-right">O. Cambio</TableHead>
                              <TableHead className="text-right">Garantias</TableHead>
                              <TableHead className="text-right font-bold text-primary">Saldo x Pagar</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedContractDetails.items.map((row) => (
                              <TableRow key={row.key} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="text-xs font-medium">
                                  {row.addendumId === '0' ? 'Contrato' : `Adenda ${row.addendumId}`}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-green-700/80 font-medium">{fmt(row.payments)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmt(row.provisions)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmt(row.serviceOrders)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmt(row.changeOrders)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmt(row.guarantees)}</TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold">{fmt(row.saldoPorPagar)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell className="text-xs font-bold">Subtotal</TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold text-green-700/80">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.payments, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.provisions, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.serviceOrders, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.changeOrders, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.guarantees, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold">
                                {fmt(selectedContractDetails.items.reduce((s, i) => s + i.saldoPorPagar, 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      {/* Detalle de Facturas (dentro de Pagos) */}
                      {(() => {
                        const allInvoices = selectedContractDetails.items.flatMap(item =>
                          item.paymentsList.map(p => ({ ...p, adenda: item.addendumId }))
                        );
                        if (allInvoices.length === 0) return null;
                        return (
                          <div className="border-t">
                            <div className="px-4 py-1.5 bg-muted/10">
                              <span className="text-xs font-medium text-muted-foreground">Facturas ({allInvoices.length})</span>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/20">
                                    <TableHead className="text-xs">Adenda</TableHead>
                                    <TableHead className="text-xs">Valorizacion</TableHead>
                                    <TableHead className="text-xs">Descripcion</TableHead>
                                    <TableHead className="text-xs">Factura</TableHead>
                                    <TableHead className="text-xs">Fecha Contabilizacion</TableHead>
                                    <TableHead className="text-right text-xs">Monto (sin IGV)</TableHead>
                                    <TableHead className="text-right text-xs">Retencion</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {allInvoices.map((inv, idx) => (
                                    <TableRow key={idx} className="hover:bg-muted/20 transition-colors">
                                      <TableCell className="text-xs">{inv.adenda === '0' ? 'Contrato' : `Adenda ${inv.adenda}`}</TableCell>
                                      <TableCell className="text-xs font-medium">{inv.valorizacion || '-'}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={inv.descripcion}>{inv.descripcion || '-'}</TableCell>
                                      <TableCell className="text-xs font-medium">{inv.factura || '-'}</TableCell>
                                      <TableCell className="text-xs">{inv.fechaContabilizacion || '-'}</TableCell>
                                      <TableCell className="text-right font-mono text-xs">{fmt(inv.monto)}</TableCell>
                                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmt(inv.retencion)}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-muted/40 font-medium">
                                    <TableCell className="text-xs font-bold" colSpan={5}>Total Facturas</TableCell>
                                    <TableCell className="text-right font-mono text-xs font-bold">
                                      {fmt(allInvoices.reduce((s, i) => s + i.monto, 0))}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-bold">
                                      {fmt(allInvoices.reduce((s, i) => s + i.retencion, 0))}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })()}
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* ============ BLOQUE 4: Datos Adicionales (E_ Sheets) (Collapsible) ============ */}
                {contractSpecialized.length > 0 && (
                  <Collapsible open={isBlockOpen('specialized')} onOpenChange={() => toggleBlock('specialized')}>
                    <div className="border-t">
                      <CollapsibleTrigger asChild>
                        <button className="w-full px-4 py-2 bg-blue-50/50 flex items-center gap-2 hover:bg-blue-100/50 transition-colors cursor-pointer">
                          {isBlockOpen('specialized') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <h4 className="text-sm font-medium text-foreground">Datos Adicionales</h4>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 py-3 space-y-3">
                          {contractSpecialized.map((sheet) => (
                            <div key={sheet.sheetType}>
                              <Badge variant="secondary" className="text-[10px] mb-2">{sheet.label}</Badge>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {sheet.fields.map((f) => (
                                  <div key={f.label} className="text-center p-1.5 rounded bg-muted/40 border">
                                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight">{f.label}</div>
                                    <div className="text-xs font-mono font-bold mt-0.5">{fmtField(f)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
             </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
