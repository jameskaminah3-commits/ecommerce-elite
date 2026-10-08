import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOrder, useGetPaymentStatus, getGetCartQueryKey } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { classNames, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, CreditCard, Smartphone, AlertCircle, Gift } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const STK_COUNTDOWN = 30; // seconds
const FALLBACK_MSG =
  'Your mobile money prompt could not be completed. Please try again, pay via M-Pesa manually, or use a card below.';

type PaymentMethod = 'mpesa' | 'airtel' | 'card';

interface SiteSettings {
  mpesaPaybill?: string;
  mpesaTill?: string;
  mpesaAccountName?: string;
  mpesaSendPhone?: string;
  mpesaInstructions?: string;
  referralEnabled?: boolean;
  referralDiscountPercent?: number;
}

function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function fetchSiteSettings(): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/site-settings`);
  if (!res.ok) return {};
  return res.json();
}

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
  const queryClient = useQueryClient();

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

  // Site settings carry the manual M-Pesa details + referral discount.
  const { data: settings } = useQuery({ queryKey: ['site-settings'], queryFn: fetchSiteSettings });

  // Validate a referral code captured from a share link, to show the discount.
  const [referral, setReferral] = useState<{ discountPercent: number; referrerName?: string } | null>(null);
  React.useEffect(() => {
    const code = getCookie('ref') || localStorage.getItem('referralCode') || '';
    if (!code) return;
    fetch(`${API_BASE}/api/referral/validate?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.valid && d.discountPercent > 0) setReferral({ discountPercent: d.discountPercent, referrerName: d.referrerName });
      })
      .catch(() => {});
  }, []);

  // Manual M-Pesa (STK fallback): the code the customer pastes after paying.
  const [mpesaRef, setMpesaRef] = useState('');
  const [mpesaRefBusy, setMpesaRefBusy] = useState(false);

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

  // Manual M-Pesa (STK fallback): record the confirmation code the customer
  // pastes after paying to the Paybill/Till. Admin verifies and marks it paid.
  const submitMpesaReference = async () => {
    if (!pendingOrderId || !mpesaRef.trim()) return;
    setMpesaRefBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${pendingOrderId}/payment-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reference: mpesaRef.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not submit the code.');
      }
      setShowMobileModal(false);
      clear();
      setLocation(`/orders/${pendingOrderId}`);
      toast({ title: 'Payment code received', description: "We'll confirm your M-Pesa payment shortly." });
    } catch (err: any) {
      toast({ title: 'Could not submit code', description: err?.message, variant: 'destructive' });
    } finally {
      setMpesaRefBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart?.items || cart.items.length === 0) return;
    if (!selectedLocation) {
      toast({ title: 'Select a delivery town', description: 'Please choose where your order should be delivered.', variant: 'destructive' });
      return;
    }
    // Every channel routes through Paystack, which requires an email.
    if (!formData.customerEmail.trim()) {
      toast({ title: 'Email required', description: 'Enter your email address to pay online.', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      // Promotions are time-boxed, so prices can change while someone is mid-checkout
      // (a campaign ending, or starting). Re-confirm the cart with the server first;
      // if the total moved, show the new price and let the shopper decide — never
      // charge an amount they haven't seen.
      const fresh = await fetch(`${API_BASE}/api/cart`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (fresh && Math.abs((fresh.total ?? 0) - cart.total) > 0.5) {
        queryClient.setQueryData(getGetCartQueryKey(), fresh);
        toast({
          title: 'A price just changed',
          description: `Your items now total ${formatCurrency(fresh.total)}. Please review your order, then place it again.`,
        });
        setBusy(false);
        return;
      }

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
      } else {
        await startCardPayment(order.id); // card — redirects on success
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
  const referralDiscount = referral ? Math.round(cart.total * (referral.discountPercent / 100) * 100) / 100 : 0;
  const finalTotal = Math.max(0, cart.total + deliveryFee - referralDiscount);

  const PAYMENT_OPTIONS: { value: PaymentMethod; icon: React.ElementType; iconClass: string; title: string; sub: string }[] = [
    { value: 'mpesa', icon: Smartphone, iconClass: 'text-emerald-600', title: 'M-Pesa (STK Push)', sub: 'Pay instantly via a Safaricom M-Pesa SIM PIN prompt.' },
    { value: 'airtel', icon: Smartphone, iconClass: 'text-red-600', title: 'Airtel Money', sub: 'Pay instantly via an Airtel SIM prompt.' },
    { value: 'card', icon: CreditCard, iconClass: 'text-blue-600', title: 'Card / Bank Transfer', sub: 'Pay via Visa, Mastercard, or Equity Bank (Pesalink).' },
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
                  <Label htmlFor="customerEmail">Email Address *</Label>
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
                {referralDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Referral ({referral?.discountPercent}% off)</span>
                    <span>−{formatCurrency(referralDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-lg pt-3 border-t text-foreground">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              {((cart as any)?.savings ?? 0) > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-emerald-800">
                  <span className="text-xs font-semibold">Wholesale savings vs retail</span>
                  <span className="text-sm font-bold">{formatCurrency((cart as any).savings)}</span>
                </div>
              )}

              {referral && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  <Gift className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {referral.referrerName ? `${referral.referrerName} referred you — ` : ''}
                    you get <strong>{referral.discountPercent}% off</strong> your first order. Applied automatically.
                  </span>
                </div>
              )}

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

              {(settings?.mpesaPaybill || settings?.mpesaTill || settings?.mpesaSendPhone) && (
                <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-4 mb-4 text-left">
                  <p className="font-bold text-sm text-emerald-800 flex items-center gap-1.5 mb-2">
                    <Smartphone className="w-4 h-4" /> Pay via M-Pesa manually
                  </p>
                  <div className="space-y-1.5 text-sm text-foreground">
                    {settings?.mpesaPaybill && (
                      <p>Lipa na M-Pesa → <strong>Pay Bill</strong><br />Business no: <strong className="tabular-nums">{settings.mpesaPaybill}</strong>
                        {settings?.mpesaAccountName && <> · Account: <strong>{settings.mpesaAccountName}</strong></>}
                      </p>
                    )}
                    {settings?.mpesaTill && (
                      <p><strong>Buy Goods</strong> → Till no: <strong className="tabular-nums">{settings.mpesaTill}</strong></p>
                    )}
                    {settings?.mpesaSendPhone && (
                      <p><strong>Send Money</strong> to <strong className="tabular-nums">{settings.mpesaSendPhone}</strong>
                        {settings?.mpesaAccountName && <> ({settings.mpesaAccountName})</>}
                      </p>
                    )}
                    <p className="pt-1">Amount: <strong>{formatCurrency(finalTotal)}</strong>{pendingOrderId ? <> · Ref: <strong>Order #{pendingOrderId}</strong></> : null}</p>
                    {settings?.mpesaInstructions && <p className="text-xs text-muted-foreground pt-1">{settings.mpesaInstructions}</p>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      value={mpesaRef}
                      onChange={(e) => setMpesaRef(e.target.value)}
                      placeholder="M-Pesa code e.g. SGH7XK9QptM"
                      className="h-10 bg-background"
                    />
                    <Button type="button" className="h-10 shrink-0" disabled={mpesaRefBusy || !mpesaRef.trim()} onClick={submitMpesaReference}>
                      {mpesaRefBusy ? 'Sending…' : "I've paid"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Enter the confirmation code from the M-Pesa SMS. We'll verify and confirm your order.</p>
                </div>
              )}

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
