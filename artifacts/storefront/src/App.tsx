import React, { Suspense, lazy } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';

// Core shopping hot path — eagerly imported so the landing, catalogue and
// product pages paint without an extra chunk round-trip.
import Home from '@/pages/index';
import ProductsPage from '@/pages/products';
import ProductDetail from '@/pages/product-detail';

// Secondary + admin pages are code-split: shoppers rarely hit these, and the
// admin bundle (charts, media picker, variant dialogs) shouldn't weigh down the
// storefront's first paint on a slow connection.
const CheckoutPage = lazy(() => import('@/pages/checkout'));
const OrderPage = lazy(() => import('@/pages/order-detail'));
const AccountPage = lazy(() => import('@/pages/account'));
const BlogPage = lazy(() => import('@/pages/blog'));
const BlogDetailPage = lazy(() => import('@/pages/blog-detail'));

// Footer / info pages
const AboutPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.FaqPage })));
const ContactPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.ContactPage })));
const ShippingPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.ShippingPage })));
const ReturnsPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.ReturnsPage })));
const TermsPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/static').then((m) => ({ default: m.PrivacyPage })));

const AdminDashboard = lazy(() => import('@/pages/admin/dashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/products'));
const AdminOrders = lazy(() => import('@/pages/admin/orders'));
const AdminCategories = lazy(() => import('@/pages/admin/categories'));
const AdminInventory = lazy(() => import('@/pages/admin/inventory'));
const AdminOffers = lazy(() => import('@/pages/admin/offers'));
const AdminDelivery = lazy(() => import('@/pages/admin/delivery'));
const AdminHomepage = lazy(() => import('@/pages/admin/homepage'));
const AdminBlog = lazy(() => import('@/pages/admin/blog'));
const AdminFooter = lazy(() => import('@/pages/admin/footer'));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products/:id" component={ProductDetail} />
      <Route path="/products" component={ProductsPage} />
      <Route path="/blog/:slug" component={BlogDetailPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/orders/:id" component={OrderPage} />
      <Route path="/account" component={AccountPage} />

      {/* Footer / info pages */}
      <Route path="/about" component={AboutPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/shipping" component={ShippingPage} />
      <Route path="/returns" component={ReturnsPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* Admin routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/offers" component={AdminOffers} />
      <Route path="/admin/delivery" component={AdminDelivery} />
      <Route path="/admin/homepage" component={AdminHomepage} />
      <Route path="/admin/blog" component={AdminBlog} />
      <Route path="/admin/footer" component={AdminFooter} />
      <Route path="/admin/inventory" component={AdminInventory} />
      
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
