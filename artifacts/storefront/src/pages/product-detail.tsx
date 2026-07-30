import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useGetProduct, ProductVariant } from '@workspace/api-client-react';
import { useCart } from '@/contexts/CartContext';
import { useParams } from 'wouter';
import { formatCurrency, classNames } from '@/lib/utils';
import { Star, Truck, ShieldCheck, ChevronRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const productId = parseInt(id || '0', 10);
  
  const { data: product, isLoading } = useGetProduct(productId, { 
    query: { enabled: !!productId } 
  });
  
  const { addItem, isAdding } = useCart();
  const { toast } = useToast();
  
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Initialize selected variant when data loads
  React.useEffect(() => {
    if (product?.variants?.length && !selectedVariant) {
      setSelectedVariant(product.variants[0]);
    }
    if (product?.imageUrl && !activeImage) {
      setActiveImage(product.imageUrl);
    }
  }, [product, selectedVariant, activeImage]);

  const handleAddToCart = () => {
    if (!selectedVariant) {
      toast({
        title: "Please select an option",
        description: "You must select a size/color variant before adding to cart.",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedVariant.stock < quantity) {
       toast({
        title: "Out of stock",
        description: `Only ${selectedVariant.stock} left in stock.`,
        variant: "destructive"
      });
      return;
    }

    addItem(selectedVariant.id, quantity);
  };

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </StorefrontLayout>
    );
  }

  if (!product) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Product not found</h2>
        </div>
      </StorefrontLayout>
    );
  }

  // Get unique options
  const colors = Array.from(new Set(product.variants.map(v => v.color).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(product.variants.map(v => v.size).filter(Boolean))) as string[];

  // Current display price
  const displayPrice = selectedVariant?.price || product.basePrice;

  return (
    <StorefrontLayout>
      {/* Breadcrumbs */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>{product.categoryName || 'Products'}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium truncate max-w-xs">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-16">
          {/* Images */}
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <div className="aspect-square bg-muted rounded-2xl overflow-hidden border">
              {activeImage ? (
                <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ShoppingBag className="w-20 h-20 opacity-20" />
                </div>
              )}
            </div>
            
            {/* Gallery Thumbnails */}
            {product.images && product.images.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[product.imageUrl, ...product.images].filter(Boolean).map((img, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveImage(img as string)}
                    className={classNames(
                      "w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                      activeImage === img ? "border-primary ring-2 ring-primary/20 ring-offset-1" : "border-transparent hover:border-primary/50"
                    )}
                  >
                    <img src={img as string} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="w-full md:w-1/2 flex flex-col">
            {product.categoryName && (
              <div className="text-sm font-bold tracking-wider text-primary uppercase mb-2">
                {product.categoryName}
              </div>
            )}
            
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4">
              {product.name}
            </h1>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={classNames(
                      "w-4 h-4", 
                      star <= (product.rating || 0) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
                    )} 
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-2 font-medium">
                  {product.rating?.toFixed(1) || '0.0'} ({product.reviewCount || 0} reviews)
                </span>
              </div>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-sm font-medium text-emerald-600">
                {product.status === 'active' ? 'In Stock' : 'Unavailable'}
              </span>
            </div>
            
            <div className="flex items-end gap-3 mb-8">
              <span className="text-4xl font-extrabold text-foreground tracking-tight">
                {formatCurrency(displayPrice)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                <span className="text-lg text-muted-foreground line-through mb-1">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>
            
            {/* Variants Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-6 mb-8">
                {colors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Color</h3>
                    <div className="flex flex-wrap gap-2">
                      {colors.map(color => {
                        // Find a variant with this color to see if it's available
                        const isAvailable = product.variants.some(v => v.color === color && v.stock > 0);
                        const isSelected = selectedVariant?.color === color;
                        
                        return (
                          <button
                            key={color}
                            disabled={!isAvailable}
                            onClick={() => {
                              // Auto-select a variant matching this color and current size
                              const v = product.variants.find(v => v.color === color && v.size === selectedVariant?.size) || 
                                        product.variants.find(v => v.color === color);
                              if (v) setSelectedVariant(v);
                            }}
                            className={classNames(
                              "px-4 py-2 border rounded-md text-sm font-medium transition-all",
                              isSelected 
                                ? "border-primary bg-primary text-primary-foreground shadow-md" 
                                : "hover:border-foreground",
                              !isAvailable && "opacity-50 cursor-not-allowed line-through"
                            )}
                          >
                            {color}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {sizes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Size</h3>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map(size => {
                        const isAvailable = product.variants.some(v => v.size === size && v.stock > 0);
                        const isSelected = selectedVariant?.size === size;
                        
                        return (
                          <button
                            key={size}
                            disabled={!isAvailable}
                            onClick={() => {
                              const v = product.variants.find(v => v.size === size && v.color === selectedVariant?.color) || 
                                        product.variants.find(v => v.size === size);
                              if (v) setSelectedVariant(v);
                            }}
                            className={classNames(
                              "min-w-[3rem] h-10 px-3 border rounded-md text-sm font-bold transition-all flex items-center justify-center",
                              isSelected 
                                ? "border-primary ring-2 ring-primary ring-offset-1 bg-card" 
                                : "hover:border-foreground bg-card",
                              !isAvailable && "opacity-50 cursor-not-allowed bg-muted"
                            )}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Action Area */}
            <div className="bg-muted/40 p-6 rounded-xl border border-muted-foreground/10 mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-sm">Quantity</span>
                {selectedVariant && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {selectedVariant.stock} available
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center border border-input bg-background rounded-md h-14 w-full sm:w-32 shrink-0">
                  <button 
                    className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center font-bold">{quantity}</div>
                  <button 
                    className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={!!selectedVariant && quantity >= selectedVariant.stock}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <Button 
                  size="lg" 
                  className="flex-1 h-14 text-base font-bold shadow-lg shadow-primary/20"
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || selectedVariant.stock === 0 || isAdding}
                >
                  {isAdding ? "Adding..." : (!selectedVariant ? "Select Options" : (selectedVariant.stock === 0 ? "Out of Stock" : "Add to Cart"))}
                </Button>
              </div>
            </div>
            
            {/* Value props */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold">Fast Delivery</p>
                  <p className="text-muted-foreground text-xs">Across Kenya</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold">Authentic</p>
                  <p className="text-muted-foreground text-xs">100% Guaranteed</p>
                </div>
              </div>
            </div>
            
            {/* Description */}
            {product.description && (
              <div className="mt-4">
                <h3 className="font-bold text-lg mb-3">Product Details</h3>
                <div className="prose prose-sm prose-slate max-w-none text-muted-foreground leading-relaxed" 
                     dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br/>') }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
