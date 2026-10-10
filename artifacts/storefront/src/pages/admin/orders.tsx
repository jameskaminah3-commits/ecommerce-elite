import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useListOrders, useUpdateOrderStatus, OrderStatusPatchStatus } from '@workspace/api-client-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, MoreHorizontal, Eye, Truck, CheckCircle, XCircle, Smartphone, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListOrdersQueryKey } from '@workspace/api-client-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link } from 'wouter';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

type Filter = 'all' | 'verify' | 'unpaid' | 'fulfil' | 'shipped' | 'delivered' | 'cancelled';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verify', label: 'Verify payment' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'fulfil', label: 'To fulfil' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa (STK)',
  mpesa_manual: 'M-Pesa (manual)',
  airtel: 'Airtel Money',
  card: 'Card',
  paystack: 'Card',
  pesapal: 'Pesapal',
  cash_on_delivery: 'Cash on delivery',
};

// Order shape as returned by the API (the generated type predates the newer fields).
type Row = {
  id: number;
  status: string;
  total: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  paymentReference?: string | null;
  referralDiscount?: number;
  discountCode?: string | null;
  discountAmount?: number;
  createdAt: string;
};

const matches = (o: Row, f: Filter): boolean => {
  switch (f) {
    case 'verify': return o.paymentStatus !== 'paid' && !!o.paymentReference && o.status !== 'cancelled';
    case 'unpaid': return o.paymentStatus !== 'paid' && o.status !== 'cancelled';
    case 'fulfil': return o.paymentStatus === 'paid' && (o.status === 'confirmed' || o.status === 'processing');
    case 'shipped': return o.status === 'shipped';
    case 'delivered': return o.status === 'delivered';
    case 'cancelled': return o.status === 'cancelled';
    default: return true;
  }
};

const statusClass = (s: string) =>
  s === 'delivered' ? 'bg-emerald-100 text-emerald-700'
  : s === 'shipped' ? 'bg-blue-100 text-blue-700'
  : s === 'processing' ? 'bg-purple-100 text-purple-700'
  : s === 'confirmed' ? 'bg-sky-100 text-sky-700'
  : s === 'cancelled' ? 'bg-red-100 text-red-700'
  : 'bg-amber-100 text-amber-700';

export default function AdminOrders() {
  const initialFilter = (new URLSearchParams(window.location.search).get('filter') as Filter) || 'all';
  const [filter, setFilter] = useState<Filter>(FILTERS.some((f) => f.key === initialFilter) ? initialFilter : 'all');
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ordersData, isLoading } = useListOrders(
    { limit: 200 } as any,
    { query: { queryKey: ['admin', 'orders'] } as any },
  );
  const orders = ((ordersData?.items ?? []) as unknown) as Row[];

  const updateStatus = useUpdateOrderStatus();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'admin' });
  };

  const handleUpdateStatus = async (id: number, status: OrderStatusPatchStatus) => {
    if (status === 'cancelled' && !confirm(`Cancel order #${id}? This can't be undone.`)) return;
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      refresh();
      toast({ title: `Order #${id} marked ${status}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  // Confirm a manually-paid order (e.g. M-Pesa paid to the Paybill/Till).
  const markPaid = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${id}/mark-paid`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      refresh();
      toast({ title: `Order #${id} marked paid`, description: 'Payment confirmed and stock deducted.' });
    } catch {
      toast({ title: 'Failed to mark paid', variant: 'destructive' });
    }
  };

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const f of FILTERS) c[f.key] = orders.filter((o) => matches(o, f.key)).length;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    return orders.filter((o) => {
      if (!matches(o, filter)) return false;
      if (!q) return true;
      return (
        String(o.id) === q ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) ||
        (o.customerEmail ?? '').toLowerCase().includes(q) ||
        (o.paymentReference ?? '').toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  const ActionsMenu = ({ order }: { order: Row }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Actions for order ${order.id}`}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/orders/${order.id}`} className="w-full flex items-center"><Eye className="w-4 h-4 mr-2" /> View details</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {order.paymentStatus !== 'paid' && (
          <DropdownMenuItem className="cursor-pointer text-emerald-700 focus:text-emerald-700" onClick={() => markPaid(order.id)}>
            <CheckCircle className="w-4 h-4 mr-2" /> Mark as paid
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer" onClick={() => handleUpdateStatus(order.id, 'processing')}>Mark as processing</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => handleUpdateStatus(order.id, 'shipped')}>
          <Truck className="w-4 h-4 mr-2" /> Mark as shipped
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => handleUpdateStatus(order.id, 'delivered')}>
          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" /> Mark as delivered
        </DropdownMenuItem>
        {order.status !== 'cancelled' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => handleUpdateStatus(order.id, 'cancelled')}>
              <XCircle className="w-4 h-4 mr-2" /> Cancel order
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const PaymentBadge = ({ order }: { order: Row }) => (
    <div>
      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
        {order.paymentStatus}
      </span>
      <span className="ml-2 text-xs text-muted-foreground">{PAYMENT_LABELS[order.paymentMethod ?? ''] ?? ''}</span>
      {order.paymentReference && (
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Smartphone className="w-3 h-3" /> Code: <span className="font-mono font-semibold text-foreground">{order.paymentReference}</span>
        </div>
      )}
      {order.discountCode && (
        <div className="text-[11px] text-emerald-700 mt-1">
          Discount {order.discountCode}{order.discountAmount ? ` · −KES ${Math.round(order.discountAmount).toLocaleString('en-KE')}` : ''}
        </div>
      )}
    </div>
  );

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Verify payments and fulfil orders.</p>
        </div>

        {/* Search + quick filters */}
        <div className="space-y-3 mb-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order #, name, phone, M-Pesa code…"
              className="pl-9 bg-background h-11"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 h-9 px-3.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
                  filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50',
                )}
              >
                {f.label}
                {counts[f.key] > 0 && f.key !== 'all' && (
                  <span className={cn('text-[11px] font-bold rounded-full px-1.5 min-w-[18px] text-center', filter === f.key ? 'bg-white/25' : 'bg-muted')}>
                    {counts[f.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading orders…</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground bg-card border border-dashed rounded-xl">No orders match.</div>
        ) : (
          <>
            {/* Phone: one card per order, with the key action within thumb reach */}
            <div className="md:hidden space-y-3">
              {visible.map((order) => (
                <div key={order.id} className="bg-card border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">#{order.id}</span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', statusClass(order.status))}>{order.status}</span>
                      </div>
                      <p className="font-medium mt-1 truncate">{order.customerName}</p>
                      <a href={`tel:${order.customerPhone}`} className="text-xs text-primary">{order.customerPhone}</a>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold">{formatCurrency(order.total)}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3">
                    <PaymentBadge order={order} />
                    <div className="flex items-center gap-2 shrink-0">
                      {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                        <Button size="sm" className="h-9 font-semibold" onClick={() => markPaid(order.id)}>Mark paid</Button>
                      )}
                      <ActionsMenu order={order} />
                    </div>
                  </div>
                  {(order.referralDiscount ?? 0) > 0 && (
                    <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1"><Gift className="w-3 h-3" /> Referral discount {formatCurrency(order.referralDiscount!)}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden md:block bg-card border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">Order</th>
                    <th className="px-5 py-3.5 font-bold">Customer</th>
                    <th className="px-5 py-3.5 font-bold">Date</th>
                    <th className="px-5 py-3.5 font-bold">Total</th>
                    <th className="px-5 py-3.5 font-bold">Payment</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visible.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5 font-bold">#{order.id}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 font-bold">{formatCurrency(order.total)}</td>
                      <td className="px-5 py-3.5"><PaymentBadge order={order} /></td>
                      <td className="px-5 py-3.5">
                        <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider', statusClass(order.status))}>{order.status}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                            <Button size="sm" variant={order.paymentReference ? 'default' : 'outline'} className="h-8" onClick={() => markPaid(order.id)}>Mark paid</Button>
                          )}
                          <ActionsMenu order={order} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Showing {visible.length} of {orders.length} most recent orders.</p>
          </>
        )}
      </AdminLayout>
    </AuthGuard>
  );
}
