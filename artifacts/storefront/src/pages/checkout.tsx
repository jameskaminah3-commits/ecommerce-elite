import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOrder, useGetPaymentStatus } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { classNames, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, CreditCard, Smartphone, AlertCircle, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const STK_COUNTDOWN = 30; // seconds
const FALLBACK_MSG =
  'Your mobile money prompt could not be completed. Please try again or pay securely using an alternative channel below.';

type PaymentMethod = 'mpesa' | 'airtel' | 'card' | 'cash_on_delivery';

interface DeliveryLocation {
  id: number;
  name: string;
  cost: number;
  active: boolean;
}

async function fetchDeliveryLocations(): Promise<DeliveryLocation[]> {
  const res = await fetch(`${API_BASE}/api/delivery-locations`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export default function CheckoutPage() {
  const { cart, isLoading: isCartLoading, clear } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createOrder = useCreateOrder();

  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    shippingAddress: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [deliveryLocationId, setDeliveryLocationId] = useState<string>('');

  const { data: deliveryLocations } = useQuery({
    queryKey: ['delivery-locations'],
    queryFn: fetchDeliveryLocations,
  });
  const activeLocations = (deliveryLocations ?? []).filter((l) => l.active);
  const selectedLocation = activeLocations.find((l) => String(l.id) === deliveryLocationId) ?? null;

  // Payment state
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileChannel, setMobileChannel] = useState<'mpesa' | 'airtel'>('mpesa');
  const [paymentError, setPaymentError] = useState('');
  const [countdown, setCountdown] = useState(STK_COUNTDOWN);
  const [busy, setBusy] = useState(false); // charging / redirecting — blocks double submits

  // Poll the order's payment status while a mobile-money prompt is outstanding.
  // The server confirms via the Paystack webhook — the browser only reflects it.
  const { data: paymentStatus, isSuccess: hasPaymentStatus } = useGetPaymentStatus(pendingOrderId || 0, {
    query: {
      queryKey: ['/api/payments', pendingOrderId, 'status'],
      enabled: !!pendingOrderId && showMobileModal,
      refetchInterval: (query: any) => (query.state.data?.paymentStatus === 'pending' ? 4000 : false),
    } as any,
  });

  // React to the confirmed payment status.
  React.useEffect(() => {
    if (!hasPaymentStatus) return;
    if (paymentStatus?.paymentStatus === 'paid') {
      setShowMobileModal(false);
      clear();
      setLocation(`/orders/${pendingOrderId}`);
      toast({ title: 'Payment successful', description: 'Your order has been confirmed.' });
    } else if (paymentStatus?.paymentStatus === 'failed') {
      setPaymentError(FALLBACK_MSG);
    }
  }, [paymentStatus, hasPaymentStatus, pendingOrderId, setLocation, clear, toast]);

  // 30s countdown while the STK prompt is out. On timeout, surface the fallback
  // (but keep polling — a slow prompt may still succeed via the webhook).
  React.useEffect(() => {
    if (!showMobileModal || paymentError) return;
    if (countdown <= 0) {
      setPaymentError(FALLBACK_MSG);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showMobileModal, paymentError, countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Card / bank: create the Paystack transaction and hand off to the hosted
  // window (Visa/Mastercard/Pesalink). Reused by the mobile-money fallback.
  const startCardPayment = async (orderId: number) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, email: formData.customerEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) throw new Error(data.error || 'Could not start card payment.');
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      toast({ title: 'Card payment failed', description: err?.message || 'Please try again.', variant: 'destructive' });
      setBusy(false);
    }
  };

  // M-Pesa / Airtel: fire the mobile-money prompt and open the waiting overlay.
  const startMobileMoney = async (orderId: number, channel: 'mpesa' | 'airtel') => {
    setMobileChannel(channel);
    setPaymentError('');
    setCountdown(STK_COUNTDOWN);
    setShowMobileModal(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments/paystack/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId, channel, phone: formData.customerPhone, email: formData.customerEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'prompt failed');
      // Success path is handled by the status poll + webhook.
    } catch (err) {
      setPaymentError(FALLBACK_MSG);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart?.items || cart.items.length === 0) return;
    if (!selectedLocation) {
      toast({ title: 'Select a delivery town', description: 'Please choose where your order should be delivered.', variant: 'destructive' });
      return;
    }
    // Every electronic channel routes through Paystack, which requires an email.
    if (paymentMethod !== 'cash_on_delivery' && !formData.customerEmail.trim()) {
      toast({ title: 'Email required', description: 'Enter your email address to pay online.', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      const order = await createOrder.mutateAsync({
        data: {
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          shippingAddress: formData.shippingAddress,
          paymentMethod,
          deliveryLocationId: selectedLocation.id,
        },
      });
      setPendingOrderId(order.id);

      if (paymentMethod === 'mpesa' || paymentMethod === 'airtel') {
        await startMobileMoney(order.id, paymentMethod);
        setBusy(false);
      } else if (paymentMethod === 'card') {
        await startCardPayment(order.id); // redirects on success
      } else {
        // Cash on delivery — nothing to charge now.
        clear();
        setLocation(`/orders/${order.id}`);
      }
    } catch (err) {
      toast({ title: 'Order failed', description: 'There was a problem creating your order.', variant: 'destructive' });
      setBusy(false);
    }
  };

  if (isCartLoading) return <div className="p-20 text-center">Loading checkout...</div>;

  if (!cart?.items || cart.items.length === 0) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-8">Add items to your cart before proceeding to checkout.</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </StorefrontLayout>
    );
  }

  const deliveryFee = selectedLocation?.cost ?? 0;
  const finalTotal = cart.total + deliveryFee;

  const PAYMENT_OPTIONS: { value: PaymentMethod; icon: React.ElementType; iconClass: string; title: string; sub: string }[] = [
    { value: 'mpesa', icon: Smartphone, iconClass: 'text-emerald-600', title: 'M-Pesa (STK Push)', sub: 'Pay instantly via a Safaricom M-Pesa SIM PIN prompt.' },
    { value: 'airtel', icon: Smartphone, iconClass: 'text-red-600', title: 'Airtel Money', sub: 'Pay instantly via an Airtel SIM prompt.' },
    { value: 'card', icon: CreditCard, iconClass: 'text-blue-600', title: 'Card / Bank Transfer', sub: 'Pay via Visa, Mastercard, or Equity Bank (Pesalink).' },
    { value: 'cash_on_delivery', icon: Truck, iconClass: 'text-amber-600', title: 'Cash on Delivery', sub: 'Pay when your order arrives. Note: Verification call required.' },
  ];

  return (
    <StorefrontLayout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-10">
          {/* Left Column: Form */}
          <div className="flex-1 space-y-8">
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6 pb-4 border-b">Customer Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="customerName">Full Name *</Label>
                  <Input id="customerName" name="customerName" required value={formData.customerName} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email Address{paymentMethod !== 'cash_on_delivery' ? ' *' : ''}</Label>
                  <Input id="customerEmail" name="customerEmail" type="email" value={formData.customerEmail} onChange={handleInputChange} />
                  <p className="text-xs text-muted-foreground">Used to send your receipt and confirm online payments.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone Number *</Label>
                  <Input id="customerPhone" name="customerPhone" placeholder="07XX XXX XXX" required value={formData.customerPhone} onChange={handleInputChange} />
                  <p className="text-xs text-muted-foreground">This number receives the prompt for M-Pesa / Airtel payments.</p>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6 pb-4 border-b">Delivery Details</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Delivery Town *</Label>
                  <Select value={deliveryLocationId} onValueChange={setDeliveryLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your town" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLocations.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No delivery towns configured yet.</div>
                      ) : (
                        activeLocations.map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {loc.name} — {formatCurrency(loc.cost)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Delivery cost depends on your town.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingAddress">Full Delivery Address *</Label>
                  <Textarea
                    id="shippingAddress"
                    name="shippingAddress"
                    placeholder="Enter building name, street, floor, area..."
                    required
                    value={formData.shippingAddress}
                    onChange={handleInputChange}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6 pb-4 border-b">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="space-y-4">
                {PAYMENT_OPTIONS.map(({ value, icon: Icon, iconClass, title, sub }) => (
                  <div
                    key={value}
                    className={classNames(
                      'flex items-start space-x-3 p-4 border rounded-lg transition-colors cursor-pointer',
                      paymentMethod === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <RadioGroupItem value={value} id={value} className="mt-1 text-primary" />
                    <div className="grid gap-1.5 flex-1 cursor-pointer" onClick={() => setPaymentMethod(value)}>
                      <Label htmlFor={value} className="font-bold flex items-center gap-2 text-base cursor-pointer">
                        <Icon className={classNames('w-5 h-5', iconClass)} />
                        {title}
                      </Label>
                      <p className="text-sm text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="bg-muted/40 border rounded-xl p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6 pr-2 max-h-[300px] overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className="w-16 h-16 bg-background border rounded-md overflow-hidden shrink-0">
                      {item.productImageUrl ? (
                        <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 m-5 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium line-clamp-2">{item.productName}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Qty: {item.quantity} {item.variantSize ? `| ${item.variantSize}` : ''}</p>
                    </div>
                    <div className="font-bold text-right shrink-0">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cart.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery{selectedLocation ? ` (${selectedLocation.name})` : ''}</span>
                  <span>{selectedLocation ? formatCurrency(deliveryFee) : '—'}</span>
                </div>
                <div className="flex justify-between font-extrabold text-lg pt-3 border-t text-foreground">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-8 h-14 text-base font-bold shadow-lg shadow-primary/20"
                disabled={createOrder.isPending || busy}
              >
                {createOrder.isPending || busy ? 'Processing...' : 'Place Order'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Mobile-money waiting overlay (M-Pesa / Airtel) */}
      <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
        <DialogContent className="sm:max-w-md text-center p-8" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">
            {paymentError ? 'Prompt not completed' : 'Check your phone'}
          </DialogTitle>

          {!paymentError ? (
            <>
              <DialogDescription className="text-base text-foreground mb-6">
                Please check your phone screen for an instant PIN prompt to complete your payment of{' '}
                <strong>{formatCurrency(finalTotal)}</strong> via {mobileChannel === 'airtel' ? 'Airtel Money' : 'M-Pesa'}.
              </DialogDescription>
              <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-6">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Waiting for confirmation… <span className="font-bold text-foreground tabular-nums">{countdown}s</span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowMobileModal(false)}>
                Close and check order status later
              </Button>
            </>
          ) : (
            <>
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3 text-left text-sm mb-6">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{FALLBACK_MSG}</p>
              </div>
              <Button
                size="lg"
                className="w-full h-12 font-bold shadow-lg shadow-primary/20 mb-3"
                disabled={busy}
                onClick={() => pendingOrderId && startCardPayment(pendingOrderId)}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Try Card or Alternative Bank Methods
              </Button>
              <Button
                variant="outline"
                className="w-full mb-2"
                disabled={busy}
                onClick={() => pendingOrderId && startMobileMoney(pendingOrderId, mobileChannel)}
              >
                Resend {mobileChannel === 'airtel' ? 'Airtel' : 'M-Pesa'} prompt
              </Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowMobileModal(false)}>
                Close and check order status later
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </StorefrontLayout>
  );
}
