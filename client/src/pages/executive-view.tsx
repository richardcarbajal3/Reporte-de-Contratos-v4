import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";
import { DollarSign, FileText, Activity, TrendingUp, ShieldCheck, Lock, ChevronDown, FilterX, Calendar, Clock, AlertTriangle, FileCheck, ArrowRight, Check, Printer } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function ExecutiveView() {
  const contracts = useAppStore(s => s.contracts);
  const consolidated = useAppStore(s => s.consolidated);
  const [viewMode, setViewMode] = useState<"type" | "group">("type");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedContractClasses, setSelectedContractClasses] = useState<string[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to detail section when categories are selected
  useEffect(() => {
    if (selectedCategories.length > 0 && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCategories]);

  // Extract unique contract classes
  const availableContractClasses = useMemo(() => {
    const classes = new Set<string>();
    contracts.forEach(c => {
      if (c.contractClass) classes.add(c.contractClass);
    });
    return Array.from(classes).sort();
  }, [contracts]);

  const filteredByClassConsolidated = useMemo(() => {
    if (selectedContractClasses.length === 0) return consolidated;
    return consolidated.filter(c => c.items.some(i => selectedContractClasses.includes(i.contractClass || '')));
  }, [consolidated, selectedContractClasses]);

  const totalInvestment = filteredByClassConsolidated.reduce((acc, c) => acc + c.totalAmount, 0);
  const totalPaid = filteredByClassConsolidated.reduce((acc, c) => acc + c.totalPaid, 0);
  // Suma de Retención (Pagos) + Garantías (Cartas Fianza)
  const totalRetentionAndGuarantees = filteredByClassConsolidated.reduce((acc, c) => acc + c.totalRetention + c.totalGuarantees, 0);
  
  // Status Counts - desglose individual por estado
  const contractsByStatus = useMemo(() => {
    const statusMap: Record<string, number> = {};
    filteredByClassConsolidated.forEach(c => {
      const state = c.state?.trim() || 'Sin Estado';
      statusMap[state] = (statusMap[state] || 0) + 1;
    });
    return Object.entries(statusMap).sort((a, b) => b[1] - a[1]);
  }, [filteredByClassConsolidated]);
  
  // Chart Data: Investment by Type vs Group (Filtered by Class)
  const investmentMap = useMemo(() => {
    return contracts.reduce((acc, c) => {
      // Filter by Class first
      if (selectedContractClasses.length > 0 && !selectedContractClasses.includes(c.contractClass || '')) return acc;

      const key = viewMode === "type" 
        ? (c.investmentType || 'Otros') 
        : (c.investmentGroup || 'Sin Grupo');
      acc[key] = (acc[key] || 0) + c.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [contracts, viewMode, selectedContractClasses]);
  
  const investmentChartData = Object.entries(investmentMap).map(([name, value]) => ({ name, value }));

  // Filtered Contracts Logic - Show CONSOLIDATED Contracts that match the category AND Class
  const filteredConsolidatedContracts = useMemo(() => {
    if (selectedCategories.length === 0) return [];

    return filteredByClassConsolidated.filter(c => {
        // Check if any addendum in this contract matches ANY of the selected categories
        return c.items.some(item => {
           const key = viewMode === "type" 
            ? (item.investmentType || 'Otros') 
            : (item.investmentGroup || 'Sin Grupo');
           return selectedCategories.includes(key);
        });
      });
  }, [filteredByClassConsolidated, selectedCategories, viewMode]);

  const selectedContractDetails = selectedContractId 
    ? consolidated.find(c => c.contractId === selectedContractId) 
    : null;

  // Chart Data: Top Contracts (Filtered by Class)
  const topContractsData = [...filteredByClassConsolidated]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map(c => ({
      name: `Cto. ${c.contractId}`,
      amount: c.totalAmount,
      paid: c.totalPaid
    }));

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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 print:mb-4">
        <div>
          <h2 className="text-3xl font-heading font-bold text-foreground">Reporte Ejecutivo</h2>
          <p className="text-muted-foreground mt-1 print:hidden">Visión estratégica y métricas clave de rendimiento</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto print:hidden">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
            <CardTitle className="text-sm font-medium">Estado Contratos ({filteredByClassConsolidated.length})</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`grid gap-1 text-center`} style={{ gridTemplateColumns: `repeat(${Math.min(contractsByStatus.length, 4)}, 1fr)` }}>
              {contractsByStatus.map(([state, count]) => (
                <div key={state}>
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{state}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top 5 Contratos por Monto</CardTitle>
            <CardDescription>Comparativa de monto contratado vs pagado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContractsData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value) => Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  />
                  <Legend />
                  <Bar dataKey="amount" fill="hsl(215, 25%, 27%)" radius={[0, 4, 4, 0]} barSize={20} name="Contratado" />
                  <Bar dataKey="paid" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} barSize={20} name="Pagado" />
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

      {/* Filtered Contracts Detail Section */}
      {selectedCategories.length > 0 && (
        <div ref={scrollRef} className="animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="flex items-center gap-2 mb-4">
             <ChevronDown className="h-5 w-5 text-primary animate-bounce" />
             <h3 className="text-2xl font-heading font-bold">
               Contratos Padre en: <span className="text-primary">{selectedCategories.length > 3 ? `${selectedCategories.length} categorías seleccionadas` : selectedCategories.join(', ')}</span>
             </h3>
          </div>
          
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
                        <TableCell className="text-center font-mono text-xs text-blue-600 font-medium">
                          {percentPaid.toFixed(1)}%
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
                        <TableCell className="text-center font-mono text-blue-700">
                          {(
                            filteredConsolidatedContracts.reduce((a, b) => a + b.totalAmount, 0) > 0 
                            ? (filteredConsolidatedContracts.reduce((a, b) => a + b.totalPaid, 0) / filteredConsolidatedContracts.reduce((a, b) => a + b.totalAmount, 0) * 100)
                            : 0
                          ).toFixed(1)}%
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
        </div>
      )}

      {/* Detailed Contract Modal/Dialog */}
      <Dialog open={!!selectedContractId} onOpenChange={(open) => !open && setSelectedContractId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full print:h-auto print:overflow-visible">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-2xl font-heading flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Detalle Contrato Padre: {selectedContractId}
            </DialogTitle>
            <DialogDescription>
               Vista consolidada y desglose por adendas
            </DialogDescription>
          </DialogHeader>

          {selectedContractDetails && (
             <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                   <div>
                      <div className="text-xs text-muted-foreground">Monto Total</div>
                      <div className="font-mono font-bold text-lg">
                        {selectedContractDetails.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground">Pagado</div>
                      <div className="font-mono font-bold text-lg text-green-600">
                        {selectedContractDetails.totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground">Custodia Total</div>
                      <div className="font-mono font-bold text-lg text-orange-600">
                        {(selectedContractDetails.totalRetention + selectedContractDetails.totalGuarantees).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        (Ret: {selectedContractDetails.totalRetention.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} + Gar: {selectedContractDetails.totalGuarantees.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})
                      </div>
                   </div>
                   <div>
                      <div className="text-xs text-muted-foreground">Avance Ponderado</div>
                      <div className="font-mono font-bold text-lg">
                        {(selectedContractDetails.progressPercent).toFixed(1)}%
                      </div>
                   </div>
                </div>

                <Separator />
                
                {/* Addendums List */}
                <div>
                   <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                     <Clock className="h-4 w-4" /> Historial de Adendas
                   </h4>
                   <div className="space-y-4">
                      {selectedContractDetails.items.sort((a,b) => a.addendumId.localeCompare(b.addendumId)).map(item => (
                         <div key={item.key} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                               <div>
                                  <Badge variant={item.addendumId === '0' ? "default" : "secondary"}>
                                     {item.addendumId === '0' ? 'Contrato Primigenio' : `Adenda ${item.addendumId}`}
                                  </Badge>
                                  <h5 className="font-bold mt-1 text-sm">{item.description}</h5>
                                  {item.chineseDescription && (
                                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{item.chineseDescription}</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal bg-muted/20">
                                      Clase: {item.contractClass || 'N/A'}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal bg-muted/20">
                                      Empresa: {item.company || '-'}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal bg-muted/20">
                                      Resp: {item.responsible || '-'}
                                    </Badge>
                                  </div>
                               </div>
                               <div className="text-right flex-shrink-0 ml-4">
                                  <div className="text-xs text-muted-foreground">Monto</div>
                                  <div className="font-mono font-bold text-sm">
                                    {item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                  </div>
                               </div>
                            </div>

                            <Separator className="my-3" />
                            
                            {/* Dates Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-y-2 gap-x-4 text-[10px] mb-3 bg-muted/20 p-2 rounded">
                               <div>
                                  <span className="text-muted-foreground">F. Suscripción:</span> <br/>
                                  <span className="font-medium">{item.contractDate || '-'}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Inicio Obra:</span> <br/>
                                  <span className="font-medium">{item.startDate || '-'}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Plazo Ejec.:</span> <br/>
                                  <span className="font-medium">{item.executionTerm || '-'}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Ampliación:</span> <br/>
                                  <span className="font-medium">{item.extensionTerm || '-'}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Fin (Recepción):</span> <br/>
                                  <span className="font-medium">{item.endDate || '-'}</span>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-xs mt-3">
                               <div>
                                  <span className="text-muted-foreground">Pagado Acumulado:</span> <br/>
                                  <span className="font-mono">{item.payments.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Retención Acumulada:</span> <br/>
                                  <span className="font-mono text-orange-600">{item.retention.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">O. Servicio:</span> <br/>
                                  <span className="font-mono">{item.serviceOrders.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">O. Cambio:</span> <br/>
                                  <span className="font-mono">{item.changeOrders.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Provisionado Acumulado:</span> <br/>
                                  <span className="font-mono">{item.provisions.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Garantías Fianza:</span> <br/>
                                  <span className="font-mono text-orange-600">{item.guarantees.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                               </div>
                               <div>
                                  <span className="text-muted-foreground">Avance Físico:</span> <br/>
                                  <span className="font-mono font-bold">{(item.progress).toFixed(1)}%</span>
                               </div>
                            </div>
                            
                            {/* Payments Table */}
                            {item.paymentsList && item.paymentsList.length > 0 && (
                              <div className="mt-4 border rounded-md overflow-hidden">
                                <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                  <Activity className="h-3 w-3" /> Historial de Pagos
                                </div>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="text-[10px] h-7 px-2">Valorización #</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Descripción</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2 text-right">Valor Sin IGV</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Factura</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Fecha Contab.</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2 text-right">Retención FG/FC</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.paymentsList.map((p, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50">
                                          <TableCell className="text-[10px] p-2 whitespace-nowrap">{p.valorizacion}</TableCell>
                                          <TableCell className="text-[10px] p-2 truncate max-w-[150px]" title={p.descripcion}>{p.descripcion}</TableCell>
                                          <TableCell className="text-[10px] p-2 text-right font-mono">{p.monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                          <TableCell className="text-[10px] p-2">{p.factura}</TableCell>
                                          <TableCell className="text-[10px] p-2">{p.fechaContabilizacion}</TableCell>
                                          <TableCell className="text-[10px] p-2 text-right font-mono text-orange-600">{p.retencion.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {/* Guarantees Table */}
                            {item.guaranteesList && item.guaranteesList.length > 0 && (
                              <div className="mt-4 border rounded-md overflow-hidden">
                                <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                  <ShieldCheck className="h-3 w-3" /> Cartas Fianza en Custodia
                                </div>
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        <TableHead className="text-[10px] h-7 px-2">Nro Carta</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Entidad</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Detalle</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Emisión</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2">Vencimiento</TableHead>
                                        <TableHead className="text-[10px] h-7 px-2 text-right">Monto (US$)</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {item.guaranteesList.map((g, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50">
                                          <TableCell className="text-[10px] p-2">{g.nroCarta}</TableCell>
                                          <TableCell className="text-[10px] p-2">{g.entidad}</TableCell>
                                          <TableCell className="text-[10px] p-2 truncate max-w-[150px]" title={g.detalle}>{g.detalle}</TableCell>
                                          <TableCell className="text-[10px] p-2">{g.fechaEmision}</TableCell>
                                          <TableCell className="text-[10px] p-2">{g.fechaVencimiento}</TableCell>
                                          <TableCell className="text-[10px] p-2 text-right font-mono text-orange-600">{g.monto.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {/* Provisions Summary */}
                            {item.provisionsList && item.provisionsList.length > 0 && (
                              <div className="mt-4 p-2 bg-blue-50/50 border border-blue-100 rounded text-xs flex justify-between items-center">
                                <span className="text-blue-800 font-medium">Saldo de Provisiones (Sin IGV US$):</span>
                                <span className="font-mono font-bold text-blue-900">{item.provisionsList.reduce((acc, p) => acc + p.monto, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
                              </div>
                            )}
                            
                            {item.comments.length > 0 && (
                               <div className="mt-3 p-2 bg-yellow-50/50 border border-yellow-100 rounded text-[10px] text-yellow-800">
                                  <strong>Notas:</strong> {item.comments.join(', ')}
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
