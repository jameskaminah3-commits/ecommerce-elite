import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useGetAnalyticsOverview, useGetRecentOrders } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'wouter';
import { 
  TrendingUp, Users, Package, ShoppingCart, ArrowUpRight, AlertTriangle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useGetAnalyticsOverview();
  const { data: recentOrders } = useGetRecentOrders({ limit: 5 });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
      </AdminLayout>
    );
  }

  const stats = [
    { name: 'Total Revenue', value: formatCurrency(analytics?.totalRevenue || 0), icon: TrendingUp, change: '+12.5%', color: 'text-emerald-600' },
    { name: 'Total Orders', value: analytics?.totalOrders || 0, icon: ShoppingCart, change: '+5.2%', color: 'text-blue-600' },
    { name: 'Products', value: analytics?.totalProducts || 0, icon: Package, change: '', color: 'text-purple-600' },
    { name: 'Customers', value: analytics?.totalCustomers || 0, icon: Users, change: '+18.1%', color: 'text-amber-600' },
  ];

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Happyfine store performance and recent activity.</p>
        </div>

        {/* Action Alerts */}
        {(analytics?.pendingOrders || 0) > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
              <p className="font-medium">You have {analytics?.pendingOrders} pending orders requiring fulfillment.</p>
            </div>
            <Button size="sm" asChild variant="outline" className="bg-white border-amber-200 hover:bg-amber-100 text-amber-900">
              <Link href="/admin/orders">View Orders</Link>
            </Button>
          </div>
        )}

        {(analytics?.lowStockCount || 0) > 0 && (
          <div className="mb-8 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="font-medium">{analytics?.lowStockCount} product variants are low on stock.</p>
            </div>
            <Button size="sm" asChild variant="outline" className="bg-white border-destructive/20 hover:bg-destructive/10 text-destructive">
              <Link href="/admin/inventory">View Inventory</Link>
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.change && (
                  <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-1" /> {stat.change}
                  </span>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">{stat.name}</p>
                <h3 className="text-2xl font-extrabold text-foreground">{stat.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Orders */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-muted/10">
              <h2 className="text-lg font-bold">Recent Orders</h2>
              <Button variant="ghost" size="sm" asChild className="text-primary font-medium">
                <Link href="/admin/orders">View All</Link>
              </Button>
            </div>
            <div className="divide-y">
              {recentOrders?.map((order) => (
                <div key={order.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {order.customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">#{order.id} • {order.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block text-right">
                      <p className="font-bold text-sm">{formatCurrency(order.total)}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded inline-block
                        ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}
                        ${order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : ''}
                        ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : ''}
                      `}>
                        {order.status}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                       <Link href={`/admin/orders`}>Manage</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions / Info */}
          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-muted/10">
              <h2 className="text-lg font-bold">Store Setup</h2>
            </div>
            <div className="p-6 space-y-4">
              <Link href="/admin/products" className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group">
                <div className="bg-primary/10 p-2 rounded text-primary"><Package className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">Add Product</p>
                  <p className="text-xs text-muted-foreground">Expand your catalogue</p>
                </div>
              </Link>
              <Link href="/admin/categories" className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors group">
                <div className="bg-primary/10 p-2 rounded text-primary"><Grid className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-sm group-hover:text-primary transition-colors">Manage Categories</p>
                  <p className="text-xs text-muted-foreground">Organize your store</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
// Needed Grid icon
import { Grid } from 'lucide-react';
