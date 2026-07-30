import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Grid, 
  AlertTriangle,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { classNames } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user || user.role !== 'admin') {
    return null; // Will be redirected by AuthGuard
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Categories', href: '/admin/categories', icon: Grid },
    { name: 'Inventory Alerts', href: '/admin/inventory', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r flex flex-col hidden md:flex sticky top-0 h-[100dvh]">
        <div className="h-16 flex items-center px-6 border-b bg-sidebar-primary text-sidebar-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white text-sidebar-primary rounded flex items-center justify-center font-bold text-sm">H</div>
            <span className="font-bold text-lg tracking-tight">Admin Console</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== '/admin' && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={classNames(
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors'
                )}
              >
                <item.icon className={classNames("w-4 h-4", isActive ? "text-primary" : "")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t bg-sidebar">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-sidebar-foreground" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
          <div className="md:hidden flex items-center gap-4">
             {/* Mobile menu trigger could go here */}
             <span className="font-bold text-lg">Admin</span>
          </div>
          <div className="flex-1" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="text-muted-foreground flex items-center">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Store
            </Link>
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
