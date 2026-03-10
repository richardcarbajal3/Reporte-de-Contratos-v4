import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, PieChart, Upload, PanelLeft, PanelLeftClose } from "lucide-react";
import { useAppStore } from "@/store";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const hasData = useAppStore(s => s.contracts.length > 0);

  const navItems = [
    { href: "/", icon: Upload, label: "Cargar Datos", disabled: false },
    { href: "/executive", icon: PieChart, label: "Reporte Ejecutivo", disabled: !hasData },
    { href: "/consolidated", icon: LayoutDashboard, label: "Consolidado", disabled: !hasData },
    { href: "/detail", icon: FileText, label: "Detalle Adendas", disabled: !hasData },
  ];

  return (
    <div className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 print:hidden transition-all duration-300 ease-in-out z-30",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 h-6 w-6 rounded-full border bg-background shadow-md flex items-center justify-center hover:bg-muted transition-colors z-50 print:hidden"
      >
        {collapsed ? <PanelLeft className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
      </button>

      <div className={cn("border-b border-sidebar-border transition-all duration-300", collapsed ? "p-3" : "p-6")}>
        {collapsed ? (
          <h1 className="text-lg font-heading font-bold text-primary text-center">CF</h1>
        ) : (
          <>
            <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              ContractFlow
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Gestión de Contratos</p>
          </>
        )}
      </div>

      <nav className={cn("flex-1 space-y-2 transition-all duration-300", collapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.disabled ? "#" : item.href}>
            <div
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                location === item.href
                  ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && item.label}
            </div>
          </Link>
        ))}
      </nav>

      {!collapsed && (
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
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(prev => !prev)} />
      <main className={cn(
        "min-h-screen transition-all duration-300 ease-in-out print:pl-0",
        sidebarCollapsed ? "pl-16" : "pl-64"
      )}>
        <div className="container mx-auto p-6 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
