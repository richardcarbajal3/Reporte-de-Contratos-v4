import { useAppStore } from "@/store";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ConsolidatedView() {
  const consolidated = useAppStore(s => s.consolidated);

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.text("Reporte Consolidado por Contrato", 14, 15);
    
    const tableData = consolidated.map(c => [
      c.contractId,
      c.totalAmount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.totalExecuted.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      c.totalPaid.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }),
      `${(c.progressPercent).toFixed(1)}%`,
      c.totalBalance.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })
    ]);

    autoTable(doc, {
      head: [['Contrato', 'Monto Total', 'Ejecutado', 'Pagado', '% Avance', 'Saldo']],
      body: tableData,
      startY: 20,
    });

    doc.save("consolidado_contratos.pdf");
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-heading font-bold text-foreground">Consolidado por Contrato</h2>
          <p className="text-muted-foreground mt-1">Vista agrupada de contratos y sus adendas</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen General</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Contrato</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
                <TableHead className="text-right">Ejecutado</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-center">% Avance</TableHead>
                <TableHead className="text-right">Saldo Total</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidated.map((row) => (
                <TableRow key={row.contractId}>
                  <TableCell className="font-medium">{row.contractId}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.totalAmount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {row.totalExecuted.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {row.totalPaid.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${Math.min(row.progressPercent, 100)}%` }} 
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{row.progressPercent.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {row.totalBalance.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={row.progressPercent >= 100 ? "default" : "secondary"}>
                      {row.progressPercent >= 100 ? "Completado" : "En Proceso"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}
