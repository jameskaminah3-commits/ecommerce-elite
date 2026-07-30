import React from 'react';
import { useCart } from '@/contexts/CartContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'wouter';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CartDrawer() {
  const { cart, isCartDrawerOpen, setCartDrawerOpen, updateItem, removeItem } = useCart();

  return (
    <Sheet open={isCartDrawerOpen} onOpenChange={setCartDrawerOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md border-l-0" data-testid="cart-drawer">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Your Cart ({cart?.itemCount || 0})
          </SheetTitle>
          <SheetDescription className="sr-only">Your shopping cart items</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {!cart?.items || cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                <ShoppingBag className="w-10 h-10 opacity-50" />
              </div>
              <div>
                <p className="font-medium text-foreground">Your cart is empty</p>
                <p className="text-sm mt-1">Looks like you haven't added anything yet.</p>
              </div>
              <Button asChild variant="outline" className="mt-4" onClick={() => setCartDrawerOpen(false)}>
                <Link href="/products">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-4 pr-2">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-3 bg-card border rounded-lg shadow-sm" data-testid={`cart-item-${item.id}`}>
                  <div className="w-20 h-20 bg-muted rounded-md overflow-hidden shrink-0">
                    {item.productImageUrl ? (
                      <img src={item.productImageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-secondary/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-semibold text-sm line-clamp-2">{item.productName}</h4>
                        <div className="text-xs text-muted-foreground mt-0.5 space-x-2 flex items-center">
                          {item.variantSize && <span>Size: {item.variantSize}</span>}
                          {item.variantColor && <span>Color: {item.variantColor}</span>}
                        </div>
                      </div>
                      <p className="font-bold text-sm text-right whitespace-nowrap">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-md">
                        <button 
                          className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button 
                          className="px-2 py-1 text-muted-foreground hover:text-foreground"
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button 
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                        onClick={() => removeItem(item.id)}
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart?.items && cart.items.length > 0 && (
          <div className="border-t pt-4 space-y-4 bg-background">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Subtotal</span>
              <span className="text-primary">{formatCurrency(cart.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">Shipping and taxes calculated at checkout.</p>
            <Button asChild className="w-full size-lg text-lg h-12" onClick={() => setCartDrawerOpen(false)}>
              <Link href="/checkout">Proceed to Checkout</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
