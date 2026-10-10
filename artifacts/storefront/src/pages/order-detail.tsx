import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useGetOrder } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, classNames } from '@/lib/utils';
import { CheckCircle2, Clock, Truck, PackageCheck, AlertTriangle, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManualMpesaPanel, ConfirmByCallPanel, hasMpesaDetails, type MpesaDetails } from '@/components/checkout/ManualMpesaPanel';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// Friendly, customer-facing names for the stored payment-method codes — the
// same wording shown at checkout (never the raw enum like "cash_on_delivery").
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa',
  mpesa_manual: 'Lipa na M-PESA',
  airtel: 'Airtel Money',
  card: 'Card / Bank Transfer',
  cash_on_delivery: 'Cash on Delivery',
};

function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—';
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

async function fetchPayDetails(): Promise<MpesaDetails> {
  const res = await fetch(`${API_BASE}/api/site-settings`);
  return res.ok ? res.json() : {};
}

export default function OrderPage() {
  const { id } = useParams();
  const orderId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { queryKey: ['/api/orders', orderId], enabled: !!orderId } as any,
  });

  const { data: payDetails } = useQuery({ queryKey: ['site-settings'], queryFn: fetchPayDetails });

  // When Paystack redirects back here it appends ?reference=…&trxref=…. Confirm
  // the payment server-side, then refresh the order so the status reflects it.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    (async () => {
      try {
        await fetch(`${API_BASE}/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`, {
          credentials: 'include',
        });
      } catch {
        /* webhook remains the source of truth */
      } finally {
        queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] });
        // Clean the query string so a refresh doesn't re-verify.
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();
  }, [orderId, queryClient]);

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </StorefrontLayout>
    );
  }

  if (!order) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Order not found</h2>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </StorefrontLayout>
    );
  }

  const getStatusIcon = () => {
    switch (order.status) {
      // Received is good news — the payment step is explained just below.
      case 'pending': return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      case 'confirmed': return <CheckCircle2 className="w-12 h-12 text-emerald-500" />;
      case 'processing': return <PackageCheck className="w-12 h-12 text-blue-500" />;
      case 'shipped': return <Truck className="w-12 h-12 text-purple-500" />;
      case 'delivered': return <CheckCircle2 className="w-12 h-12 text-primary" />;
      case 'cancelled': return <AlertTriangle className="w-12 h-12 text-destructive" />;
      default: return <Clock className="w-12 h-12" />;
    }
  };

  const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const currentIndex = steps.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const paymentReference = (order as any).paymentReference as string | null | undefined;
  const isMpesaOrder = !order.paymentMethod || order.paymentMethod === 'mpesa' || order.paymentMethod === 'mpesa_manual';
  // Still owes an M-Pesa payment and hasn't told us the code yet → show how to pay.
  const awaitingMpesa = !isCancelled && order.paymentStatus !== 'paid' && !paymentReference && isMpesaOrder;
  const needsManualPayment = awaitingMpesa && hasMpesaDetails(payDetails);
  // Manual order placed before any payment number was published: the team confirms by phone.
  const confirmByCall = awaitingMpesa && !needsManualPayment && order.paymentMethod === 'mpesa_manual' && !!payDetails;

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="p-8 border-b text-center bg-muted/20">
            <div className="flex justify-center mb-4">{getStatusIcon()}</div>
            <h1 className="text-3xl font-extrabold mb-2">
              {isCancelled ? 'Order Cancelled' : order.paymentStatus === 'paid' ? 'Order Confirmed!' : 'Order Received'}
            </h1>
            <p className="text-muted-foreground">Order #{order.id} • Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
            {!isCancelled && order.paymentStatus !== 'paid' && (
              <p className="mt-4 mx-auto max-w-md text-sm text-muted-foreground">
                {paymentReference
                  ? <>We've received your M-PESA code <strong className="font-mono text-foreground">{paymentReference}</strong> and are confirming it. You'll get a confirmation shortly.</>
                  : needsManualPayment
                    ? 'One last step — pay with M-PESA below, then enter the code from your SMS.'
                    : confirmByCall
                      ? "Thank you! We'll call you shortly to confirm your order."
                      : 'Your order is confirmed as soon as payment is received.'}
              </p>
            )}
          </div>

          {confirmByCall && (
            <div className="p-4 sm:p-8 border-b bg-background">
              <ConfirmByCallPanel settings={payDetails} orderId={order.id} amount={order.total} customerPhone={order.customerPhone} />
            </div>
          )}

          {needsManualPayment && (
            <div className="p-4 sm:p-8 border-b bg-background">
              <ManualMpesaPanel
                settings={payDetails}
                orderId={order.id}
                amount={order.total}
                onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId] })}
              />
            </div>
          )}

          {!isCancelled && (
            <div className="p-5 sm:p-8 border-b bg-background">
              <h3 className="font-bold text-lg mb-6">Tracking Status</h3>
              <div className="relative">
                <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-muted rounded-full">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000"
                    style={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {steps.map((step, i) => {
                    const active = i <= currentIndex;
                    return (
                      <div key={step} className="flex flex-col items-center flex-1 min-w-0 px-0.5 text-center">
                        <div className={classNames(
                          "w-10 h-10 rounded-full flex items-center justify-center border-4 mb-2 z-10 transition-colors",
                          active ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card border-muted text-muted-foreground"
                        )}>
                          {active ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />}
                        </div>
                        <span className={classNames("text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b">
            <div className="p-5 sm:p-8">
              <h3 className="font-bold text-lg mb-4 text-primary">Delivery Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Name</span>
                  <span className="font-medium">{order.customerName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone</span>
                  <span className="font-medium">{order.customerPhone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Address</span>
                  <span className="font-medium block whitespace-pre-wrap">{order.shippingAddress || 'Not provided'}</span>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-8">
              <h3 className="font-bold text-lg mb-4 text-primary">Payment Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Method</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">{paymentMethodLabel(order.paymentMethod)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Status</span>
                  <span className={classNames("font-semibold", order.paymentStatus === 'paid' ? 'text-emerald-600' : order.paymentStatus === 'failed' ? 'text-destructive' : 'text-foreground')}>
                    {order.paymentStatus === 'paid'
                      ? 'Paid'
                      : order.paymentStatus === 'failed'
                        ? 'Payment failed'
                        : paymentReference
                          ? 'Being confirmed'
                          : confirmByCall
                            ? 'Pay on confirmation'
                            : 'Awaiting payment'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 bg-muted/10">
            <h3 className="font-bold text-lg mb-6 text-primary">Order Items</h3>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-background border rounded-lg shadow-sm">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-muted rounded overflow-hidden shrink-0 border">
                    {item.productImageUrl && <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="font-bold leading-snug line-clamp-3">{item.productName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.variantSize && `Size: ${item.variantSize} | `} 
                        {item.variantColor && `Color: ${item.variantColor}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base sm:text-lg whitespace-nowrap">{formatCurrency(item.price)}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    {(order.paymentStatus === 'paid' || order.status === 'delivered') && (item as any).productId && (
                      <Link
                        href={`/products/${(item as any).productId}#reviews`}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rate this product
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t flex justify-end">
              <div className="w-64 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-medium">{formatCurrency(order.total - (order.deliveryFee ?? 0) + ((order as any).referralDiscount ?? 0) + ((order as any).discountAmount ?? 0))}</span>
                </div>
                <div className="flex justify-between pb-3 border-b">
                  <span className="text-muted-foreground">Delivery{order.deliveryLocation ? ` (${order.deliveryLocation})` : ''}</span>
                  <span className="font-medium">{formatCurrency(order.deliveryFee ?? 0)}</span>
                </div>
                {((order as any).discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between pb-3 border-b text-emerald-600">
                    <span>Discount{(order as any).discountCode ? ` (${(order as any).discountCode})` : ''}</span>
                    <span className="font-medium">−{formatCurrency((order as any).discountAmount)}</span>
                  </div>
                )}
                {((order as any).referralDiscount ?? 0) > 0 && (
                  <div className="flex justify-between pb-3 border-b text-emerald-600">
                    <span>Referral discount</span>
                    <span className="font-medium">−{formatCurrency((order as any).referralDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg text-foreground">{order.paymentStatus === 'paid' ? 'Total Paid' : 'Total Due'}</span>
                  <span className="font-extrabold text-2xl text-primary">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
