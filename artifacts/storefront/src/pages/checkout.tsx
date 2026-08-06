import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOrder, useInitiateMpesaPayment, useGetPaymentStatus } from '@workspace/api-client-react';
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
import { ShoppingBag, CreditCard, Smartphone, CheckCircle2, AlertCircle, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

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
  const initiateMpesa = useInitiateMpesaPayment();
  
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    shippingAddress: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'pesapal' | 'cash_on_delivery'>('mpesa');
  const [deliveryLocationId, setDeliveryLocationId] = useState<string>('');

  const { data: deliveryLocations } = useQuery({
    queryKey: ['delivery-locations'],
    queryFn: fetchDeliveryLocations,
  });
  const activeLocations = (deliveryLocations ?? []).filter((l) => l.active);
  const selectedLocation = activeLocations.find((l) => String(l.id) === deliveryLocationId) ?? null;
  
  // Payment state
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Poll for payment status if we have a pending order
  const { data: paymentStatus, isSuccess: hasPaymentStatus } = useGetPaymentStatus(pendingOrderId || 0, {
    query: {
      queryKey: ['/api/payments', pendingOrderId, 'status'],
      enabled: !!pendingOrderId,
      refetchInterval: (query: any) => (query.state.data?.paymentStatus === 'pending' ? 5000 : false),
    } as any,
  });

  // Handle successful payment
  React.useEffect(() => {
    if (hasPaymentStatus && paymentStatus?.paymentStatus === 'paid') {
      setShowMpesaModal(false);
      clear();
      setLocation(`/orders/${pendingOrderId}`);
      toast({
        title: "Payment Successful",
        description: "Your order has been confirmed.",
      });
    } else if (hasPaymentStatus && paymentStatus?.paymentStatus === 'failed') {
      setPaymentError("Payment failed or was cancelled. Please try again.");
    }
  }, [paymentStatus, hasPaymentStatus, pendingOrderId, setLocation, clear, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart?.items || cart.items.length === 0) return;
    if (!selectedLocation) {
      toast({ title: "Select a delivery town", description: "Please choose where your order should be delivered.", variant: "destructive" });
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        data: {
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          shippingAddress: formData.shippingAddress,
          paymentMethod,
          deliveryLocationId: selectedLocation.id,
        }
      });
      
      setPendingOrderId(order.id);
      
      if (paymentMethod === 'mpesa') {
        try {
          await initiateMpesa.mutateAsync({
            data: {
              orderId: order.id,
              phoneNumber: formData.customerPhone,
            }
          });
          setShowMpesaModal(true);
        } catch (err) {
          toast({
            title: "M-Pesa Initiation Failed",
            description: "Could not send STK push to your phone.",
            variant: "destructive"
          });
        }
      } else {
        // Other methods (COD, pesapal redirect)
        clear();
        setLocation(`/orders/${order.id}`);
      }
    } catch (err) {
      toast({
        title: "Order Failed",
        description: "There was a problem creating your order.",
        variant: "destructive"
      });
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
                  <Label htmlFor="customerEmail">Email Address</Label>
                  <Input id="customerEmail" name="customerEmail" type="email" value={formData.customerEmail} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">Phone Number (M-Pesa) *</Label>
                  <Input id="customerPhone" name="customerPhone" placeholder="07XX XXX XXX" required value={formData.customerPhone} onChange={handleInputChange} />
                  <p className="text-xs text-muted-foreground mt-1">This number will receive the STK push if paying via M-Pesa.</p>
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
                <div className={classNames("flex items-start space-x-3 p-4 border rounded-lg transition-colors cursor-pointer", paymentMethod === 'mpesa' ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                  <RadioGroupItem value="mpesa" id="mpesa" className="mt-1 text-primary" />
                  <div className="grid gap-1.5 flex-1 cursor-pointer" onClick={() => setPaymentMethod('mpesa')}>
                    <Label htmlFor="mpesa" className="font-bold flex items-center gap-2 text-base cursor-pointer">
                      <Smartphone className="w-5 h-5 text-emerald-600" />
                      M-Pesa (STK Push)
                    </Label>
                    <p className="text-sm text-muted-foreground">Pay instantly via your mobile phone. A prompt will be sent to {formData.customerPhone || 'your number'}.</p>
                  </div>
                </div>
                <div className={classNames("flex items-start space-x-3 p-4 border rounded-lg transition-colors cursor-pointer", paymentMethod === 'pesapal' ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                  <RadioGroupItem value="pesapal" id="pesapal" className="mt-1 text-primary" />
                  <div className="grid gap-1.5 flex-1 cursor-pointer" onClick={() => setPaymentMethod('pesapal')}>
                    <Label htmlFor="pesapal" className="font-bold flex items-center gap-2 text-base cursor-pointer">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      Card Payment (Pesapal)
                    </Label>
                    <p className="text-sm text-muted-foreground">Pay securely with Visa, Mastercard or other cards.</p>
                  </div>
                </div>
                <div className={classNames("flex items-start space-x-3 p-4 border rounded-lg transition-colors cursor-pointer", paymentMethod === 'cash_on_delivery' ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                  <RadioGroupItem value="cash_on_delivery" id="cod" className="mt-1 text-primary" />
                  <div className="grid gap-1.5 flex-1 cursor-pointer" onClick={() => setPaymentMethod('cash_on_delivery')}>
                    <Label htmlFor="cod" className="font-bold flex items-center gap-2 text-base cursor-pointer">
                      <Truck className="w-5 h-5 text-amber-600" />
                      Cash on Delivery
                    </Label>
                    <p className="text-sm text-muted-foreground">Pay when your order arrives. Note: Verification call required.</p>
                  </div>
                </div>
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
                disabled={createOrder.isPending || initiateMpesa.isPending}
              >
                {createOrder.isPending ? "Processing..." : "Place Order"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* M-Pesa Waiting Modal */}
      <Dialog open={showMpesaModal} onOpenChange={setShowMpesaModal}>
        <DialogContent className="sm:max-w-md text-center p-8" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2">Check Your Phone</DialogTitle>
          <DialogDescription className="text-base text-foreground mb-6">
            An M-Pesa prompt has been sent to <span className="font-bold">{formData.customerPhone}</span>.
            <br/><br/>
            Please enter your PIN to complete the payment of <strong>{formatCurrency(finalTotal)}</strong>.
          </DialogDescription>
          
          {paymentError ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3 text-left text-sm mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{paymentError}</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-6">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              Waiting for confirmation...
            </div>
          )}
          
          <Button variant="outline" className="w-full" onClick={() => setShowMpesaModal(false)}>
            Close and check order status later
          </Button>
        </DialogContent>
      </Dialog>
    </StorefrontLayout>
  );
}
