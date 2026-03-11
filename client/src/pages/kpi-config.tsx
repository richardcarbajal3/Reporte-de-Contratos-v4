import { useState, useMemo } from 'react';
import { useKpiConfigStore, getEffectiveKpis } from '@/lib/kpi-store';
import { useAvailableColumns } from '@/lib/use-available-columns';
import { EXECUTIVE_KPIS, stripAccents, type ExecutiveKpiDef, type AggregationType } from '@/lib/specialized-sheets-config';
import { useAppStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, RotateCcw, ChevronDown, Database, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { toast } from 'sonner';


const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'sum', label: 'Suma' },
  { value: 'avg', label: 'Promedio' },
  { value: 'max', label: 'Máximo' },
  { value: 'min', label: 'Mínimo' },
  { value: 'count', label: 'Conteo' },
  { value: 'first', label: 'Primero' },
];

const FORMAT_OPTIONS: { value: ExecutiveKpiDef['format']; label: string }[] = [
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moneda (USD)' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'text', label: 'Texto' },
];

const emptyForm: ExecutiveKpiDef = {
  sheetType: '',
  column: '',
  label: '',
  aggregation: 'sum',
  format: 'number',
  decimals: 2,
};

export default function KpiConfigPage() {
  const store = useKpiConfigStore();
  const kpis = getEffectiveKpis(store);
  const availableCols = useAvailableColumns();
  const consolidated = useAppStore((s) => s.consolidated);
  const hasData = consolidated.length > 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<ExecutiveKpiDef>({ ...emptyForm });
  const [colsOpen, setColsOpen] = useState(false);

  const sheetTypes = [...availableCols.keys()];

  // Build a flat set of all available columns (normalized) for validation
  const allAvailableNormalized = useMemo(() => {
    const map = new Map<string, Set<string>>(); // sheetType → Set<normalizedColumn>
    for (const [type, info] of availableCols) {
      const set = new Set<string>();
      for (const col of info.columns) {
        set.add(stripAccents(col.trim().toUpperCase().replace(/\s+/g, ' ')));
      }
      map.set(type, set);
    }
    return map;
  }, [availableCols]);

  // Diagnostics: total contracts with/without E_ data
  const diagnostics = useMemo(() => {
    if (!hasData) return null;
    let withE = 0;
    let withoutE = 0;
    for (const c of consolidated) {
      const has = c.items.some(i => i.specializedData.length > 0);
      if (has) withE++; else withoutE++;
    }
    return { withE, withoutE, total: consolidated.length };
  }, [consolidated, hasData]);

  function kpiColumnExists(kpi: ExecutiveKpiDef): boolean | null {
    if (!hasData || sheetTypes.length === 0) return null; // unknown
    const cols = allAvailableNormalized.get(kpi.sheetType.toLowerCase());
    if (!cols) return false; // sheet type not found
    const normalized = stripAccents(kpi.column.trim().toUpperCase().replace(/\s+/g, ' '));
    return cols.has(normalized);
  }

  function openAdd(preSheetType?: string, preColumn?: string) {
    setEditIndex(null);
    setForm({
      ...emptyForm,
      sheetType: preSheetType ?? sheetTypes[0] ?? '',
      column: preColumn ?? '',
      label: preColumn ?? '',
    });
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditIndex(index);
    setForm({ ...kpis[index] });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.sheetType.trim() || !form.column.trim() || !form.label.trim()) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    const kpi: ExecutiveKpiDef = {
      ...form,
      sheetType: form.sheetType.trim().toLowerCase(),
      column: form.column.trim().toUpperCase(),
      label: form.label.trim(),
    };
    if (editIndex !== null) {
      store.updateKpi(editIndex, kpi);
      toast.success('KPI actualizado');
    } else {
      store.addKpi(kpi);
      toast.success('KPI agregado');
    }
    setDialogOpen(false);
  }

  function handleDelete(index: number) {
    store.removeKpi(index);
    toast.success('KPI eliminado');
  }

  function handleReset() {
    store.resetToDefaults();
    toast.success('KPIs restaurados a valores por defecto');
  }

  const aggLabel = (v: AggregationType) =>
    AGGREGATION_OPTIONS.find((o) => o.value === v)?.label ?? v;
  const fmtLabel = (v: string) =>
    FORMAT_OPTIONS.find((o) => o.value === v)?.label ?? v;

  const getColumnsForSheet = (sheetType: string): string[] => {
    return availableCols.get(sheetType)?.columns ?? [];
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Configurar KPIs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina qué columnas de las hojas E_ se muestran como indicadores en el Reporte Ejecutivo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar por defecto
        </Button>
      </div>

      {/* Diagnostics panel */}
      {hasData && (
        <Card className={diagnostics && diagnostics.withE > 0 ? 'border-green-200 bg-green-50/30' : 'border-yellow-200 bg-yellow-50/30'}>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              {diagnostics && diagnostics.withE > 0 ? (
                <>
                  <Link2 className="h-4 w-4 text-green-600" />
                  <span>
                    <strong>{diagnostics.withE}</strong> de {diagnostics.total} contratos tienen datos E_ vinculados
                    {sheetTypes.length > 0 && (
                      <span className="text-muted-foreground">
                        {' '}({sheetTypes.map(t => {
                          const info = availableCols.get(t)!;
                          return `E_${t}: ${info.entryCount} registros en ${info.contractCount} contratos`;
                        }).join(', ')})
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>
                    Ningún contrato tiene datos E_ vinculados. Verifique que las hojas E_ del Excel tengan una columna
                    <span className="font-mono mx-1">N° CONTRATO</span> o <span className="font-mono mx-1">CONTRATO + ADENDA</span>
                    con IDs que coincidan con la hoja principal.
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available columns panel */}
      <Collapsible open={colsOpen} onOpenChange={setColsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Columnas Disponibles en Datos Cargados
                  {sheetTypes.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {sheetTypes.length} hoja{sheetTypes.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${colsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              {sheetTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Cargue un archivo Excel con hojas E_ para ver las columnas disponibles.
                </p>
              ) : (
                <div className="space-y-4">
                  {sheetTypes.map((type) => {
                    const info = availableCols.get(type)!;
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-medium font-mono">E_{type}</span>
                          <span className="text-xs text-muted-foreground">
                            {info.entryCount} registros en {info.contractCount} contratos
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {info.columns.map((col) => (
                            <Badge
                              key={col}
                              variant="secondary"
                              className="text-xs font-mono cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => openAdd(type, col)}
                              title="Click para agregar como KPI"
                            >
                              <Plus className="h-2.5 w-2.5 mr-1 opacity-50" />
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground italic mt-2">
                    Haga click en una columna para agregarla como KPI.
                  </p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* KPI Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              KPIs Configurados ({kpis.length})
            </CardTitle>
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar KPI
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {kpis.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No hay KPIs configurados. Agregue uno para comenzar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Hoja</TableHead>
                  <TableHead>Columna</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Agregación</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead className="text-center">Dec.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.map((kpi, i) => {
                  const exists = kpiColumnExists(kpi);
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        {exists === null ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">-</Badge>
                        ) : exists ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" title="Columna encontrada en datos" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" title="Columna no encontrada en datos cargados" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          E_{kpi.sheetType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{kpi.column}</TableCell>
                      <TableCell>{kpi.label}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {aggLabel(kpi.aggregation)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {fmtLabel(kpi.format)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{kpi.decimals ?? 2}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(i)}
                            className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editIndex !== null ? 'Editar KPI' : 'Agregar KPI'}</DialogTitle>
            <DialogDescription>
              Configure qué columna de una hoja E_ se muestra como indicador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Sheet Type */}
            <div className="space-y-2">
              <Label>Tipo de Hoja</Label>
              {sheetTypes.length > 0 ? (
                <Select value={form.sheetType} onValueChange={(v) => setForm({ ...form, sheetType: v, column: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione hoja..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetTypes.map((t) => (
                      <SelectItem key={t} value={t}>E_{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="ej: arrendamiento"
                  value={form.sheetType}
                  onChange={(e) => setForm({ ...form, sheetType: e.target.value })}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Nombre de la hoja sin el prefijo E_ (ej: arrendamiento, obras)
              </p>
            </div>

            {/* Column */}
            <div className="space-y-2">
              <Label>Columna</Label>
              {form.sheetType && availableCols.has(form.sheetType) ? (
                <Select value={form.column} onValueChange={(v) => setForm({ ...form, column: v, label: form.label || v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione columna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getColumnsForSheet(form.sheetType).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="ej: PAGO ANUAL (US$)"
                  value={form.column}
                  onChange={(e) => setForm({ ...form, column: e.target.value })}
                />
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label>Etiqueta</Label>
              <Input
                placeholder="Nombre que se muestra en la tarjeta"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>

            {/* Aggregation */}
            <div className="space-y-2">
              <Label>Agregación</Label>
              <Select value={form.aggregation} onValueChange={(v) => setForm({ ...form, aggregation: v as AggregationType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v as ExecutiveKpiDef['format'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Decimals */}
            {form.format !== 'text' && (
              <div className="space-y-2">
                <Label>Decimales</Label>
                <Input
                  type="number"
                  min={0}
                  max={6}
                  value={form.decimals ?? 2}
                  onChange={(e) => setForm({ ...form, decimals: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>
              {editIndex !== null ? 'Guardar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
