import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useGetOrder } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { formatCurrency, classNames } from '@/lib/utils';
import { CheckCircle2, Clock, Truck, PackageCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderPage() {
  const { id } = useParams();
  const orderId = parseInt(id || '0', 10);
  
  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { queryKey: ['/api/orders', orderId], enabled: !!orderId } as any,
  });

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
      case 'pending': return <Clock className="w-12 h-12 text-amber-500" />;
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

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="p-8 border-b text-center bg-muted/20">
            <div className="flex justify-center mb-4">{getStatusIcon()}</div>
            <h1 className="text-3xl font-extrabold mb-2">
              {isCancelled ? 'Order Cancelled' : 'Order Confirmed!'}
            </h1>
            <p className="text-muted-foreground">Order #{order.id} • Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
          </div>

          {!isCancelled && (
            <div className="p-8 border-b bg-background">
              <h3 className="font-bold text-lg mb-6">Tracking Status</h3>
              <div className="relative">
                <div className="absolute top-5 left-4 right-4 h-1 bg-muted rounded-full">
                  <div 
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }}
                  />
                </div>
                <div className="relative flex justify-between">
                  {steps.map((step, i) => {
                    const active = i <= currentIndex;
                    return (
                      <div key={step} className="flex flex-col items-center w-24 text-center">
                        <div className={classNames(
                          "w-10 h-10 rounded-full flex items-center justify-center border-4 mb-2 z-10 transition-colors",
                          active ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card border-muted text-muted-foreground"
                        )}>
                          {active ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />}
                        </div>
                        <span className={classNames("text-xs font-bold uppercase tracking-wider", active ? "text-foreground" : "text-muted-foreground")}>
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
            <div className="p-8">
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
            <div className="p-8">
              <h3 className="font-bold text-lg mb-4 text-primary">Payment Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Method</span>
                  <span className="font-medium capitalize text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">{order.paymentMethod?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Status</span>
                  <span className={classNames("font-bold uppercase tracking-wider", order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-500')}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-muted/10">
            <h3 className="font-bold text-lg mb-6 text-primary">Order Items</h3>
            <div className="space-y-4">
              {order.items?.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 bg-background border rounded-lg shadow-sm">
                  <div className="w-16 h-16 bg-muted rounded overflow-hidden shrink-0 border">
                    {item.productImageUrl && <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-bold leading-tight">{item.productName}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.variantSize && `Size: ${item.variantSize} | `} 
                        {item.variantColor && `Color: ${item.variantColor}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(item.price)}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t flex justify-end">
              <div className="w-64 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-medium">{formatCurrency(order.total - (order.deliveryFee ?? 0))}</span>
                </div>
                <div className="flex justify-between pb-3 border-b">
                  <span className="text-muted-foreground">Delivery{order.deliveryLocation ? ` (${order.deliveryLocation})` : ''}</span>
                  <span className="font-medium">{formatCurrency(order.deliveryFee ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg text-foreground">Total Paid</span>
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
