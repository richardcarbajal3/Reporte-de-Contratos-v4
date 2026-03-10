import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, PieChart, Upload } from "lucide-react";
import { useAppStore } from "@/store";

export function Sidebar() {
  const [location] = useLocation();
  const hasData = useAppStore(s => s.contracts.length > 0);

  const navItems = [
    { href: "/", icon: Upload, label: "Cargar Datos", disabled: false },
    { href: "/executive", icon: PieChart, label: "Reporte Ejecutivo", disabled: !hasData },
    { href: "/consolidated", icon: LayoutDashboard, label: "Consolidado", disabled: !hasData },
    { href: "/detail", icon: FileText, label: "Detalle Adendas", disabled: !hasData },
  ];

  return (
    <div className="h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 print:hidden">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          ContractFlow
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Gestión de Contratos</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.disabled ? "#" : item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200",
                location === item.href
                  ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="bg-card p-3 rounded-lg border shadow-sm">
          <p className="text-xs font-medium text-foreground">Estado del Sistema</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`h-2 w-2 rounded-full ${hasData ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-muted-foreground">
              {hasData ? 'Datos Cargados' : 'Esperando Datos'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64 min-h-screen transition-all duration-300 ease-in-out print:pl-0">
        <div className="container mx-auto p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
