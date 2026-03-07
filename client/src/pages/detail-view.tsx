import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Building2, User, Tag, Calendar, Shield, Banknote, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { aggregateSpecializedData, type AggregatedField } from "@/lib/specialized-sheets-config";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtField = (f: AggregatedField) => {
  if (f.format === 'text') return String(f.value);
  const num = Number(f.value);
  if (f.format === 'currency') return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals });
  if (f.format === 'percent') return `${num.toFixed(f.decimals)}%`;
  return num.toLocaleString('es-PE', { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals });
};

function InvoiceDetail({ items }: { items: { key: string; addendumId: string; paymentsList: import("@/lib/excel-processor").PaymentRecord[] }[] }) {
  const [expanded, setExpanded] = useState(false);
  const allInvoices = items.flatMap(item =>
    item.paymentsList
      .filter(p => !p.isAdelanto)
      .map(p => ({ ...p, adenda: item.addendumId }))
  );

  if (allInvoices.length === 0) return null;

  return (
    <div className="border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Facturas ({allInvoices.length})
        </span>
      </button>
      {expanded && (
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
                  <TableCell className="text-xs text-muted-foreground">{inv.descripcion || '-'}</TableCell>
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
      )}
    </div>
  );
}

export default function DetailView() {
  const consolidated = useAppStore(s => s.consolidated);
  const contracts = useAppStore(s => s.contracts);

  const handlePrint = () => {
    const doc = new jsPDF('l');
    doc.text("Detalle por Adenda", 14, 15);

    const tableData = contracts.map(c => [
      c.key,
      c.description || '-',
      fmt(c.amount),
      fmt(c.deductivo),
      fmt(c.amountNet),
      fmt(c.payments),
      fmt(c.saldoPorPagar),
    ]);

    autoTable(doc, {
      head: [['ID', 'Descripcion', 'Monto Contratado', 'Deductivo', 'Monto Neto', 'Pagos', 'Saldo x Pagar']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 58, 86] }
    });

    doc.save("detalle_adendas.pdf");
  };

  const getParentInfo = (items: typeof contracts) => {
    return items.find(i => i.addendumId === '0') || items[0];
  };

  const getGroupGuarantees = (items: typeof contracts) => {
    return items.flatMap(i => i.guaranteesList);
  };

  const getGroupAdelanto = (items: typeof contracts) => {
    const total = items.reduce((s, i) => s + i.adelantoContrato, 0);
    const amort = items.reduce((s, i) => s + i.amortizacionAdelanto, 0);
    return { total, amort, pending: total - amort };
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-heading font-bold text-foreground">Detalle por Adenda</h2>
          <p className="text-muted-foreground mt-1">Desglose detallado de cada componente contractual</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="space-y-6">
        {consolidated.map((group) => {
          const parent = getParentInfo(group.items);
          const guarantees = getGroupGuarantees(group.items);
          const adelanto = getGroupAdelanto(group.items);

          // Subtotals for contract detail table
          const subtotalInicio = group.items.find(i => i.startDate && i.startDate !== '-')?.startDate || '-';
          const subtotalFin = group.items.find(i => i.endDate && i.endDate !== '-')?.endDate || '-';
          const subtotalMonto = group.items.reduce((s, i) => s + i.amount, 0);

          return (
            <Card key={group.contractId}>
              {/* ============ BLOQUE 1: Data General ============ */}
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-heading">
                      Contrato Padre: <span className="font-mono">{group.contractId}</span>
                    </CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      group.state === 'Activo' ? 'bg-green-100 text-green-700' :
                      group.state === 'Cerrado' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {group.state}
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
              </CardHeader>

              {/* ============ BLOQUE 2: Detalle Contractual ============ */}
              <CardContent className="p-0 border-b">
                <div className="px-4 py-2 bg-muted/20">
                  <h4 className="text-sm font-medium text-foreground">Detalle Contractual</h4>
                </div>
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
                      {group.items.map((row) => (
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
                      {/* Subtotal row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-xs font-bold" colSpan={2}>Subtotal</TableCell>
                        <TableCell className="text-xs text-center">{subtotalInicio}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-xs text-center">{subtotalFin}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">{fmt(subtotalMonto)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.deductivo, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.amountNet, 0))}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* ============ BLOQUE 3: Detalle de Pagos ============ */}
              <CardContent className="p-0 border-b">
                <div className="px-4 py-2 bg-muted/20">
                  <h4 className="text-sm font-medium text-foreground">Detalle de Pagos y Financiero</h4>
                </div>
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
                      {group.items.map((row) => (
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
                      {/* Subtotal row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell className="text-xs font-bold">Subtotal</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-green-700/80">
                          {fmt(group.items.reduce((s, i) => s + i.payments, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.provisions, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.serviceOrders, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.changeOrders, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.guarantees, 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {fmt(group.items.reduce((s, i) => s + i.saldoPorPagar, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Detalle de Facturas */}
                <InvoiceDetail items={group.items} />
              </CardContent>

              {/* ============ BLOQUE 4: Datos Adicionales (E_ Sheets) ============ */}
              {(() => {
                const specializedEntries = group.items.flatMap(i => i.specializedData);
                if (specializedEntries.length === 0) return null;
                const aggregated = aggregateSpecializedData(specializedEntries);
                if (aggregated.length === 0) return null;
                return (
                  <CardContent className="p-0">
                    <div className="px-4 py-2 bg-blue-50/50">
                      <h4 className="text-sm font-medium text-foreground">Datos Adicionales</h4>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      {aggregated.map((sheet) => (
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
                  </CardContent>
                );
              })()}
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
