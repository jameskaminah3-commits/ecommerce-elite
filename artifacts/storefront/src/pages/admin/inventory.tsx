import React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useGetLowStockVariants } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, PackageCheck } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function AdminInventory() {
  const { data: variants, isLoading } = useGetLowStockVariants({ threshold: 10 });

  const outOfStock = variants?.filter((v) => v.stock <= 0).length ?? 0;
  const lowStock = variants?.filter((v) => v.stock > 0).length ?? 0;

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Inventory Alerts</h1>
          <p className="text-muted-foreground mt-1">Variants at or below the low-stock threshold (10 units).</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-extrabold">{outOfStock}</p>
              <p className="text-sm text-muted-foreground">Out of stock</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-100 text-amber-700"><PackageCheck className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-extrabold">{lowStock}</p>
              <p className="text-sm text-muted-foreground">Running low</p>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/10">
            <h2 className="font-bold">Low Stock Variants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold">Product</th>
                  <th className="px-6 py-4 font-bold">Variant</th>
                  <th className="px-6 py-4 font-bold">SKU</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold">Stock</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center">Loading inventory...</td></tr>
                ) : !variants || variants.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    All variants are well stocked.
                  </td></tr>
                ) : (
                  variants.map((v) => {
                    const variantLabel = [v.size, v.color].filter(Boolean).join(' / ') || '—';
                    return (
                      <tr key={v.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-medium">{v.productName}</td>
                        <td className="px-6 py-4 text-muted-foreground">{variantLabel}</td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{v.sku}</td>
                        <td className="px-6 py-4 font-bold">{v.price != null ? formatCurrency(v.price) : '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            v.stock <= 0 ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {v.stock <= 0 ? 'Out of stock' : `${v.stock} left`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/admin/products">Restock</Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
