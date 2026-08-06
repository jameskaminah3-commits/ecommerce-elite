import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, MapPin, Layers } from 'lucide-react';
import {
  fetchDeliveryClasses,
  createDeliveryClass,
  deleteDeliveryClass,
  fetchDeliveryRates,
  putDeliveryRate,
  type DeliveryClass,
  type DeliveryRate,
} from '@/lib/deliveryApi';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface DeliveryLocation {
  id: number;
  name: string;
  cost: number;
  active: boolean;
}

async function listLocations(): Promise<DeliveryLocation[]> {
  const res = await fetch(`${API_BASE}/api/delivery-locations`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}
async function createLocation(body: { name: string; cost: number }) {
  const res = await fetch(`${API_BASE}/api/delivery-locations`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to add location');
  return res.json();
}
async function updateLocation(id: number, body: Partial<{ name: string; cost: number; active: boolean }>) {
  const res = await fetch(`${API_BASE}/api/delivery-locations/${id}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update location');
  return res.json();
}
async function deleteLocation(id: number) {
  await fetch(`${API_BASE}/api/delivery-locations/${id}`, { method: 'DELETE', credentials: 'include' });
}

export default function AdminDelivery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: locations, isLoading } = useQuery({ queryKey: ['delivery-locations'], queryFn: listLocations });

  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['delivery-locations'] });

  const add = async () => {
    const costNum = Number(cost);
    if (!name.trim() || Number.isNaN(costNum) || costNum < 0) {
      toast({ title: 'Enter a town name and a valid cost.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      await createLocation({ name: name.trim(), cost: costNum });
      setName(''); setCost('');
      refresh();
      toast({ title: 'Location added' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Delivery Locations</h1>
          <p className="text-muted-foreground mt-1">Towns you deliver to and their charges. Customers pick one at checkout.</p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b bg-muted/10 grid grid-cols-[1fr_140px_90px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="town" className="text-xs">Town / Location</Label>
              <Input id="town" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nyeri" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost" className="text-xs">Cost (KES)</Label>
              <Input id="cost" type="number" min="0" step="1" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
            <div />
            <Button onClick={add} disabled={adding} className="font-bold">
              <Plus className="w-4 h-4 mr-1.5" /> Add
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold">Town</th>
                  <th className="px-6 py-4 font-bold">Delivery cost</th>
                  <th className="px-6 py-4 font-bold">Active</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center">Loading…</td></tr>
                ) : !locations || locations.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    No delivery locations yet. Add your first town above.
                  </td></tr>
                ) : (
                  locations.map((loc) => (
                    <LocationRow key={loc.id} location={loc} onChanged={refresh} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DeliveryClassesCard />
        <RateMatrixCard locations={locations ?? []} />
      </AdminLayout>
    </AuthGuard>
  );
}

function DeliveryClassesCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: classes } = useQuery({ queryKey: ['delivery-classes'], queryFn: fetchDeliveryClasses });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['delivery-classes'] });

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createDeliveryClass(name.trim());
      setName('');
      refresh();
      toast({ title: 'Class added' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: DeliveryClass) => {
    if (!confirm(`Delete class "${c.name}"? Products using it fall back to the town base rate.`)) return;
    await deleteDeliveryClass(c.id);
    refresh();
    queryClient.invalidateQueries({ queryKey: ['delivery-rates'] });
  };

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b bg-muted/10 flex items-center gap-2">
        <Layers className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-bold">Delivery Classes</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Group products by how they ship (e.g. Standard, Bulky). Set each class's cost per town in the matrix below.
          Products with no class use the town's base cost.
        </p>
        <div className="flex flex-wrap gap-2">
          {(classes ?? []).map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-muted text-sm font-medium">
              {c.name}
              <button className="p-0.5 rounded-full hover:bg-destructive/10 text-destructive" onClick={() => remove(c)} title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New class name" />
          <Button onClick={add} disabled={busy}><Plus className="w-4 h-4 mr-1.5" /> Add</Button>
        </div>
      </div>
    </div>
  );
}

function RateMatrixCard({ locations }: { locations: DeliveryLocation[] }) {
  const { data: classes } = useQuery({ queryKey: ['delivery-classes'], queryFn: fetchDeliveryClasses });
  const { data: rates } = useQuery({ queryKey: ['delivery-rates'], queryFn: fetchDeliveryRates });
  const queryClient = useQueryClient();

  const rateFor = (locationId: number, classId: number): DeliveryRate | undefined =>
    (rates ?? []).find((r) => r.locationId === locationId && r.classId === classId);

  const save = async (locationId: number, classId: number, raw: string) => {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) return;
    await putDeliveryRate(locationId, classId, value);
    queryClient.invalidateQueries({ queryKey: ['delivery-rates'] });
  };

  if (!classes || classes.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/10">
        <h2 className="font-bold">Class rates by town</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Leave a cell blank to use the town's base cost. Checkout charges the highest class in the cart.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
            <tr>
              <th className="px-4 py-3 font-bold">Town</th>
              <th className="px-4 py-3 font-bold">Base</th>
              {classes.map((c) => (
                <th key={c.id} className="px-4 py-3 font-bold">{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {locations.map((loc) => (
              <tr key={loc.id}>
                <td className="px-4 py-3 font-medium">{loc.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatCurrency(loc.cost)}</td>
                {classes.map((c) => {
                  const rate = rateFor(loc.id, c.id);
                  return (
                    <td key={c.id} className="px-4 py-2">
                      <Input
                        key={`${loc.id}-${c.id}-${rate ? rate.cost : 'base'}`}
                        className="h-9 w-24"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={rate ? String(rate.cost) : ''}
                        placeholder={String(loc.cost)}
                        onBlur={(e) => save(loc.id, c.id, e.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationRow({ location, onChanged }: { location: DeliveryLocation; onChanged: () => void }) {
  const { toast } = useToast();
  const [cost, setCost] = useState(String(location.cost));
  const [busy, setBusy] = useState(false);
  const dirty = cost !== String(location.cost);

  const save = async () => {
    const costNum = Number(cost);
    if (Number.isNaN(costNum) || costNum < 0) {
      toast({ title: 'Invalid cost', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await updateLocation(location.id, { cost: costNum });
      onChanged();
      toast({ title: 'Cost updated' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (active: boolean) => {
    setBusy(true);
    try {
      await updateLocation(location.id, { active });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${location.name}?`)) return;
    setBusy(true);
    try {
      await deleteLocation(location.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="hover:bg-muted/10 transition-colors">
      <td className="px-6 py-4 font-medium">{location.name}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Input className="h-9 w-32" type="number" min="0" step="1" value={cost} onChange={(e) => setCost(e.target.value)} />
          {dirty && (
            <Button size="icon" className="h-9 w-9" onClick={save} disabled={busy} title="Save">
              <Save className="w-4 h-4" />
            </Button>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <Switch checked={location.active} onCheckedChange={toggle} disabled={busy} />
      </td>
      <td className="px-6 py-4 text-right">
        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={remove} disabled={busy} title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}
