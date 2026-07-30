import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  useGetCart,
  useAddCartItem,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  Cart,
  CartItem
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCartQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cart: Cart | undefined;
  isLoading: boolean;
  isCartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addItem: (variantId: number, quantity: number) => void;
  updateItem: (itemId: number, quantity: number) => void;
  removeItem: (itemId: number) => void;
  clear: () => void;
  isAdding: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [isCartDrawerOpen, setCartDrawerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serverCart, isLoading } = useGetCart();
  const addMutation = useAddCartItem();
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const clearMutation = useClearCart();

  const addItem = (variantId: number, quantity: number) => {
    addMutation.mutate(
      { data: { variantId, quantity } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey(), newCart);
          setCartDrawerOpen(true);
          toast({
            title: "Added to cart",
            description: "Item has been added to your cart.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to add item to cart.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const updateItem = (itemId: number, quantity: number) => {
    updateMutation.mutate(
      { id: itemId, data: { quantity } },
      {
        onSuccess: (newCart) => {
          queryClient.setQueryData(getGetCartQueryKey(), newCart);
        }
      }
    );
  };

  const removeItem = (itemId: number) => {
    removeMutation.mutate(
      { id: itemId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        }
      }
    );
  };

  const clear = () => {
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      }
    });
  };

  return (
    <CartContext.Provider
      value={{
        cart: serverCart,
        isLoading,
        isCartDrawerOpen,
        setCartDrawerOpen,
        addItem,
        updateItem,
        removeItem,
        clear,
        isAdding: addMutation.isPending,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
