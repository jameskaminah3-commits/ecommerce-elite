const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface DeliveryClass {
  id: number;
  name: string;
  active: boolean;
}
export interface DeliveryRate {
  locationId: number;
  classId: number;
  cost: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
  return res.json();
}

export async function fetchDeliveryClasses(): Promise<DeliveryClass[]> {
  const res = await fetch(`${API_BASE}/api/delivery-classes`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function createDeliveryClass(name: string): Promise<DeliveryClass> {
  return json(
    await fetch(`${API_BASE}/api/delivery-classes`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }),
  );
}

export async function deleteDeliveryClass(id: number): Promise<void> {
  await fetch(`${API_BASE}/api/delivery-classes/${id}`, { method: 'DELETE', credentials: 'include' });
}

export async function fetchDeliveryRates(): Promise<DeliveryRate[]> {
  const res = await fetch(`${API_BASE}/api/delivery-rates`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

// cost === null clears the override so the town's base cost applies again.
export async function putDeliveryRate(locationId: number, classId: number, cost: number | null): Promise<void> {
  await fetch(`${API_BASE}/api/delivery-rates`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId, classId, cost }),
  });
}
