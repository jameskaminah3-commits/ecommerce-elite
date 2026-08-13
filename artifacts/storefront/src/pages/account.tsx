import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLoginUser, useRegisterUser, useListOrders } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ShoppingBag, Package, UserCircle, LogOut, Mail } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export default function AccountPage() {
  const { user, logout, setUser } = useAuth();
  
  if (user) {
    return <DashboardView />;
  }

  return <AuthView setUser={setUser} />;
}

function DashboardView() {
  const { user, logout } = useAuth();
  const { data: ordersData, isLoading } = useListOrders();

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-card border rounded-xl p-6 shadow-sm mb-4 text-center">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                {user?.name.charAt(0)}
              </div>
              <h2 className="font-bold text-lg">{user?.name}</h2>
              <p className="text-muted-foreground text-sm mb-4">{user?.email}</p>
              {user?.role === 'admin' && (
                <Button asChild variant="outline" className="w-full mb-2 text-primary border-primary/20 hover:bg-primary/5">
                  <Link href="/admin">Admin Console</Link>
                </Button>
              )}
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" /> Order History
            </h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card border rounded-xl animate-pulse" />)}
              </div>
            ) : !ordersData?.items || ordersData.items.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 border border-dashed rounded-xl">
                <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-bold text-lg">No orders yet</h3>
                <p className="text-muted-foreground mt-1 mb-6">Looks like you haven't made any purchases yet.</p>
                <Button asChild>
                  <Link href="/products">Start Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersData.items.map(order => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="block">
                    <div className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-lg">#{order.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-extrabold text-xl text-primary">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                          {order.paymentStatus}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

function AuthView({ setUser }: { setUser: any }) {
  const [activeTab, setActiveTab] = useState('login');
  const loginMutation = useLoginUser();
  const registerMutation = useRegisterUser();
  const { toast } = useToast();

  // Surface any error handed back by the Google OAuth redirect.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      toast({
        title: "Google sign-in failed",
        description: "We couldn't sign you in with Google. Please try again or use email.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ── Passwordless email OTP ────────────────────────────────────────────
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const requestOtp = async () => {
    if (!otpEmail.trim()) {
      toast({ title: "Enter your email", description: "We'll send a one-time code to it.", variant: "destructive" });
      return;
    }
    setOtpBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: otpEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send code.');
      setOtpSent(true);
      toast({
        title: "Check your email",
        description: data.devCode
          ? `Dev mode: your code is ${data.devCode}`
          : "We sent a 6-digit sign-in code to your email.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't send code", description: err?.message || 'Please try again.', variant: "destructive" });
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    setOtpBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: otpEmail.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code.');
      setUser(data.user);
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || 'Please try again.', variant: "destructive" });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await loginMutation.mutateAsync({
        data: {
          email: fd.get('email') as string,
          password: fd.get('password') as string,
        }
      });
      setUser(res.user);
    } catch (err) {
      toast({ title: "Login Failed", description: "Invalid credentials.", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await registerMutation.mutateAsync({
        data: {
          name: fd.get('name') as string,
          email: fd.get('email') as string,
          phone: fd.get('phone') as string,
          password: fd.get('password') as string,
        }
      });
      setUser(res.user);
    } catch (err) {
      toast({ title: "Registration Failed", description: "Could not create account.", variant: "destructive" });
    }
  };

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">My Account</h1>
            <p className="text-muted-foreground mt-2">Manage orders and access wholesale pricing.</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 p-1 bg-muted/50">
              <TabsTrigger value="login" className="font-bold text-sm">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="font-bold text-sm">Create Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-xl shadow-black/5">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email-login">Email Address</Label>
                    <Input id="email-login" name="email" type="email" required className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password-login">Password</Label>
                      <a href="#" className="text-xs text-primary font-medium hover:underline">Forgot password?</a>
                    </div>
                    <Input id="password-login" name="password" type="password" required className="h-12" />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 mt-4" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="register">
              <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-xl shadow-black/5">
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name / Business Name</Label>
                    <Input id="name" name="name" required className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-reg">Email Address</Label>
                    <Input id="email-reg" name="email" type="email" required className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" required className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-reg">Password</Label>
                    <Input id="password-reg" name="password" type="password" required minLength={6} className="h-12" />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 mt-4" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>

          {/* Alternative sign-in methods */}
          <div className="mt-6">
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-border" />
              <span className="mx-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-border" />
            </div>

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 font-semibold"
              onClick={() => { window.location.href = `${API_BASE}/api/auth/google`; }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continue with Google
            </Button>

            {/* Email OTP */}
            <div className="mt-4 bg-card border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Sign in with an email code</h3>
              </div>
              {!otpSent ? (
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    className="h-11"
                  />
                  <Button type="button" variant="secondary" className="w-full h-11 font-semibold" disabled={otpBusy} onClick={requestOtp}>
                    {otpBusy ? "Sending..." : "Email me a code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to <span className="font-semibold">{otpEmail}</span>.</p>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="h-11 tracking-[0.5em] text-center font-bold text-lg"
                  />
                  <Button type="button" className="w-full h-11 font-semibold" disabled={otpBusy || otpCode.length !== 6} onClick={verifyOtp}>
                    {otpBusy ? "Verifying..." : "Verify & sign in"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setOtpSent(false); setOtpCode(''); }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
