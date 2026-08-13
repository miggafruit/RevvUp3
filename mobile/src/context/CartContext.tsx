import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Cart } from '../types/marketplace';
import * as cartApi from '../api/cartApi';

interface CartContextValue {
  cart: Cart;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  addItem: (itemType: 'product' | 'service', itemId: string, quantity?: number) => Promise<void>;
  updateItem: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [subtotal, setSubtotal] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await cartApi.getCart();
      setCart(data.cart);
      setSubtotal(data.subtotal);
      setDeliveryFee(data.deliveryFee);
      setTotal(data.total);
    } catch (error) {
      console.warn('Failed to refresh cart', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = useCallback(
    async (itemType: 'product' | 'service', itemId: string, quantity: number = 1) => {
      const updatedCart = await cartApi.addItemToCart(itemType, itemId, quantity);
      setCart(updatedCart);
      await refreshCart(); // re-fetch to get the accurate total
    },
    [refreshCart]
  );

  const updateItem = useCallback(
    async (cartItemId: string, quantity: number) => {
      const updatedCart = await cartApi.updateCartItem(cartItemId, quantity);
      setCart(updatedCart);
      await refreshCart(); // total lives in separate state — must re-fetch or it goes stale
    },
    [refreshCart]
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      const updatedCart = await cartApi.removeCartItem(cartItemId);
      setCart(updatedCart);
      await refreshCart(); // same as above
    },
    [refreshCart]
  );

  const clear = useCallback(async () => {
    await cartApi.clearCart();
    setCart({ items: [] });
    setTotal(0);
  }, []);

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, subtotal, deliveryFee, total, itemCount, isLoading, refreshCart, addItem, updateItem, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};