import React from 'react';
import { useCart } from '@/contexts/CartContext';
import { useListProducts } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'wouter';
import { Minus, Plus, Trash2, ShoppingBag, Truck, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FREE_DELIVERY_THRESHOLD = 5000; // KES

export function CartDrawer() {
  const { cart, isCartDrawerOpen, setCartDrawerOpen, updateItem, removeItem, addItem } = useCart();

  const cartTotal = cart?.total || 0;
  const progress = Math.min((cartTotal / FREE_DELIVERY_THRESHOLD) * 100, 100);
  const remaining = Math.max(FREE_DELIVERY_THRESHOLD - cartTotal, 0);
  const unlocked = cartTotal >= FREE_DELIVERY_THRESHOLD;

  // Cross-sell: fetch a few products for "You may also like"
  const { data: crossSellData } = useListProducts(
    { limit: 6 },
    { query: { queryKey: ['cross-sell'], enabled: isCartDrawerOpen } as any },
  );
  const crossSell = crossSellData?.items?.slice(0, 6) || [];

  return (
    <Sheet open={isCartDrawerOpen} onOpenChange={setCartDrawerOpen}>
      <SheetContent
        className="flex flex-col w-full sm:max-w-[440px] border-l p-0"
        data-testid="cart-drawer"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <SheetTitle className="text-base font-extrabold flex items-center gap-2.5 tracking-tight">
            <ShoppingBag className="w-4.5 h-4.5" />
            Your Cart
            {cart?.itemCount ? (
              <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
              </span>
            ) : null}
          </SheetTitle>
          <SheetDescription className="sr-only">Your shopping cart items</SheetDescription>
        </SheetHeader>

        {/* Free delivery progress bar */}
        <div className={`mx-5 mt-4 mb-1 rounded-lg px-4 py-3 ${unlocked ? 'bg-primary/10 border border-primary/20' : 'bg-muted/60 border border-border/50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Truck className={`w-4 h-4 shrink-0 ${unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-xs font-semibold">
              {unlocked ? (
                <span className="text-primary font-bold">Free delivery unlocked across Kenya!</span>
              ) : (
                <>
                  Add{' '}
                  <span className="font-bold text-foreground">{formatCurrency(remaining)}</span>{' '}
                  more for free nationwide delivery
                </>
              )}
            </p>
          </div>
          <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: unlocked
                  ? 'hsl(var(--primary))'
                  : 'linear-gradient(90deg, hsl(var(--primary)/0.6), hsl(var(--primary)))',
              }}
            />
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!cart?.items || cart.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                <Package className="w-9 h-9 opacity-40" />
              </div>
              <div>
                <p className="font-bold text-foreground">Your cart is empty</p>
                <p className="text-sm mt-1">Add items to get started.</p>
              </div>
              <Button
                asChild
                variant="outline"
                className="mt-4"
                onClick={() => setCartDrawerOpen(false)}
              >
                <Link href="/products">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3.5 py-3.5 border-b border-border/50 last:border-0"
                  data-testid={`cart-item-${item.id}`}
                >
                  {/* Image */}
                  <div className="w-[72px] h-[72px] bg-muted rounded-lg overflow-hidden shrink-0 border border-border/40">
                    {item.productImageUrl ? (
                      <img
                        src={item.productImageUrl}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/5">
                        <ShoppingBag className="w-6 h-6 text-secondary/30" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[13px] leading-tight line-clamp-2">{item.productName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.variantColor && (
                            <span className="text-[11px] text-muted-foreground">{item.variantColor}</span>
                          )}
                          {item.variantSize && (
                            <span className="text-[11px] text-muted-foreground">/ {item.variantSize}</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/8 transition-colors shrink-0"
                        onClick={() => removeItem(item.id)}
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-border/60 rounded-md h-7">
                        <button
                          className="px-2 text-muted-foreground hover:text-foreground disabled:opacity-40 h-full"
                          onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          className="px-2 text-muted-foreground hover:text-foreground h-full"
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="font-bold text-[13px] text-primary tracking-tight">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with totals + cross-sell */}
        {cart?.items && cart.items.length > 0 && (
          <div className="border-t bg-background shrink-0">
            {/* Cross-sell carousel */}
            {crossSell.length > 0 && (
              <div className="px-5 py-4 border-b">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">
                  You may also like
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                  {crossSell.map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-col shrink-0 w-[100px] group cursor-pointer"
                      onClick={() => {
                        // Add first variant if we can, otherwise navigate
                        setCartDrawerOpen(false);
                      }}
                    >
                      <Link
                        href={`/products/${product.id}`}
                        onClick={() => setCartDrawerOpen(false)}
                        className="block"
                      >
                        <div className="w-full h-[84px] bg-muted rounded-lg overflow-hidden border border-border/40 mb-1.5">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-5 h-5 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                          {product.name}
                        </p>
                        <p className="text-[11px] font-bold text-primary mt-0.5">
                          {formatCurrency(product.basePrice)}
                        </p>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-xl font-extrabold text-primary tracking-tight">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              {!unlocked && (
                <p className="text-[11px] text-muted-foreground">
                  Shipping calculated at checkout.
                </p>
              )}
              <Button
                asChild
                className="w-full h-12 font-bold text-base"
                onClick={() => setCartDrawerOpen(false)}
              >
                <Link href="/checkout">
                  Proceed to Checkout
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full h-9 text-sm"
                onClick={() => setCartDrawerOpen(false)}
              >
                <Link href="/products">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
