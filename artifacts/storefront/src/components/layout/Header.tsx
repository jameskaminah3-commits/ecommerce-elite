import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ShoppingBag, Search, Menu, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, logout } = useAuth();
  const { cart, setCartDrawerOpen } = useCart();
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-xl tracking-tighter">
              H
            </div>
            <span className="font-extrabold text-xl tracking-tight hidden sm:inline-block">Happyfine</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-medium">
            <Link href="/products" className={location.startsWith('/products') ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}>
              Shop
            </Link>
            <Link href="/products?category=electronics" className="text-muted-foreground hover:text-foreground transition-colors">
              Electronics
            </Link>
            <Link href="/products?category=home" className="text-muted-foreground hover:text-foreground transition-colors">
              Home & Living
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center relative">
            <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
            <input 
              type="search" 
              placeholder="Search products..." 
              className="h-9 w-64 rounded-md border border-input bg-muted/50 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            />
          </div>

          <Button variant="ghost" size="icon" className="sm:hidden">
            <Search className="h-5 w-5" />
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-xs uppercase">
                    {user.name.charAt(0)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.name && <p className="font-medium">{user.name}</p>}
                    {user.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="w-full cursor-pointer">
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="w-full cursor-pointer">
                    Order History
                  </Link>
                </DropdownMenuItem>
                {user.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="w-full cursor-pointer text-primary font-medium">
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
              <Link href="/account">Sign In</Link>
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => setCartDrawerOpen(true)}
            data-testid="button-open-cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {cart?.itemCount ? (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
                {cart.itemCount}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </header>
  );
}
