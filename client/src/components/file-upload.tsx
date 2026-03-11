import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { processExcelFile } from '@/lib/excel-processor';
import { useAppStore } from '@/store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function FileUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const setData = useAppStore(s => s.setData);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const result = await processExcelFile(file);
      
      if (result.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Error en el archivo",
          description: result.errors.join('\n'),
        });
      } else {
        setData(result.contracts, result.consolidated, result.specializedSheetLogs);
        toast({
          title: "Importación exitosa",
          description: `Se procesaron ${result.contracts.length} registros.`,
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error crítico",
        description: "No se pudo procesar el archivo. Verifique el formato.",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [setData, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  return (
    <div className="w-full max-w-xl mx-auto mt-10">
      <div 
        {...getRootProps()} 
        className={`
          relative overflow-hidden rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300
          ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
        `}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-lg font-medium text-foreground">Procesando datos...</p>
              <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
            </motion.div>
          ) : (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="p-4 rounded-full bg-primary/10 text-primary">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold mb-2">Cargar Reporte Excel</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Arrastra tu archivo aquí o haz clic para seleccionar. Acepta formato interno (Contratos, SAP, Pago...) o estándar. Las tablas se detectan automáticamente.
                </p>
              </div>
              <Button variant="outline" className="mt-2">
                Seleccionar Archivo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium text-sm">Hojas Requeridas</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Contratos (obligatoria)</li>
            <li>Pago / pagos</li>
            <li>SAP / programacion</li>
            <li>Av&Provision / provisiones</li>
          </ul>
        </div>
        <div className="p-4 rounded-lg border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium text-sm">Estructura</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Llave: CONTRATO + ADENDA</li>
            <li>Detección automática de tablas</li>
            <li>Garantia, C_Ent_Fin, OS.r.SAP, Con.SAP</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
