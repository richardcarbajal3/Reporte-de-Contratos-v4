import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Info, Building2, User, Tag } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function DetailView() {
  const consolidated = useAppStore(s => s.consolidated);
  const contracts = useAppStore(s => s.contracts);

  const handlePrint = () => {
    const doc = new jsPDF('l');
    doc.text("Detalle por Adenda", 14, 15);

    const tableData = contracts.map(c => [
      c.key,
      c.description || '-',
      c.amount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.payments.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.provisions.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.serviceOrders.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.changeOrders.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.guarantees.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.balance.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })
    ]);

    autoTable(doc, {
      head: [['ID (Con-Ade)', 'Descripción', 'Monto', 'Pagos', 'Provisiones', 'O. Servicio', 'O. Cambio', 'Garantías', 'Saldo']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 58, 86] }
    });

    doc.save("detalle_adendas.pdf");
  };

  // Get parent contract info (usually adenda 0 or first item)
  const getParentInfo = (items: typeof contracts) => {
    return items.find(i => i.addendumId === '0') || items[0];
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
          return (
            <Card key={group.contractId}>
              {/* Contract Parent Header */}
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

                  {/* Description */}
                  {parent?.description && (
                    <p className="text-sm text-foreground">{parent.description}</p>
                  )}
                  {parent?.chineseDescription && (
                    <p className="text-sm text-muted-foreground">{parent.chineseDescription}</p>
                  )}

                  {/* Metadata row */}
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
                </div>
              </CardHeader>

              {/* Addendums Table */}
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[120px]">Adenda</TableHead>
                        <TableHead className="text-right">Monto Contrato</TableHead>
                        <TableHead className="text-right text-green-600">Pagos</TableHead>
                        <TableHead className="text-right">Provisiones</TableHead>
                        <TableHead className="text-right">O. Servicio</TableHead>
                        <TableHead className="text-right">O. Cambio</TableHead>
                        <TableHead className="text-right">Garantías</TableHead>
                        <TableHead className="text-right font-bold text-primary">Saldo</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((row) => (
                        <TableRow key={row.key} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium font-mono text-xs">{row.addendumId}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {row.amount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-green-700/80 font-medium">
                            {row.payments.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {row.provisions.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {row.serviceOrders.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {row.changeOrders.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {row.guarantees.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                            {row.balance.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                          </TableCell>
                          <TableCell>
                            {row.comments.length > 0 && (
                               <TooltipProvider>
                                 <Tooltip>
                                   <TooltipTrigger>
                                     <Info className="h-4 w-4 text-blue-400" />
                                   </TooltipTrigger>
                                   <TooltipContent>
                                     <div className="text-xs">
                                       {row.comments.map((c, i) => <div key={i}>{c}</div>)}
                                     </div>
                                   </TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
