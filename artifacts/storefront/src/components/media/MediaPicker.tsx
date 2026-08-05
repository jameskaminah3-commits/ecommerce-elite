import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Upload, LibraryBig, X, Trash2 } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface MediaItem {
  name: string;
  url: string;
}

async function uploadImage(file: File): Promise<string> {
  const res = await fetch(`${API_BASE}/api/media/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.url as string;
}

async function listMedia(): Promise<MediaItem[]> {
  const res = await fetch(`${API_BASE}/api/media`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as MediaItem[];
}

async function deleteMedia(name: string): Promise<void> {
  await fetch(`${API_BASE}/api/media`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function MediaPicker({
  value,
  onChange,
  label = 'Image',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast({ title: 'Image uploaded' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
          )}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> {busy ? 'Uploading…' : 'Upload'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setLibOpen(true)}>
              <LibraryBig className="w-3.5 h-3.5 mr-1.5" /> Library
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange('')}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Remove
              </Button>
            )}
          </div>
          <Input
            placeholder="or paste an image URL"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <MediaLibraryDialog
        open={libOpen}
        onOpenChange={setLibOpen}
        onSelect={(url) => {
          onChange(url);
          setLibOpen(false);
        }}
      />
    </div>
  );
}

function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listMedia());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadImage(file);
      await refresh();
      toast({ title: 'Image uploaded' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm('Delete this image from your media library?')) return;
    try {
      await deleteMedia(name);
      setItems((prev) => prev.filter((i) => i.name !== name));
    } catch {
      toast({ title: 'Failed to delete image', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Media Library</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-1">
          <p className="text-sm text-muted-foreground">Choose an image or upload a new one.</p>
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>

        <div className="overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No images yet. Upload one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-1">
              {items.map((item) => (
                <div key={item.name} className="group relative aspect-square rounded-lg border overflow-hidden bg-muted">
                  <button
                    type="button"
                    onClick={() => onSelect(item.url)}
                    className="absolute inset-0 w-full h-full"
                    title="Use this image"
                  >
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.name)}
                    className="absolute top-1 right-1 p-1 rounded bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
