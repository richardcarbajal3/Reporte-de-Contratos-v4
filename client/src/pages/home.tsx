import { Layout } from "@/components/layout";
import { FileUpload } from "@/components/file-upload";

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
        <div className="text-center mb-8 space-y-2">
          <h2 className="text-4xl font-heading font-bold text-foreground">Bienvenido a ContractFlow</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            La plataforma centralizada para el control financiero y seguimiento de contratos.
          </p>
        </div>
        <FileUpload />
      </div>
    </Layout>
  );
}
