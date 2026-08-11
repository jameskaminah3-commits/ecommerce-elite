const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  author: string;
  tags: string[];
  status: 'draft' | 'published';
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPosts(params: { page?: number; limit?: number; tag?: string } = {}): Promise<{ items: BlogPost[]; total: number; page: number; limit: number }> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.tag) q.set('tag', params.tag);
  const res = await fetch(`${API_BASE}/api/blog-posts?${q.toString()}`);
  if (!res.ok) return { items: [], total: 0, page: 1, limit: params.limit ?? 9 };
  return res.json();
}

export async function fetchPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${API_BASE}/api/blog-posts/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return res.json();
}

export function formatPostDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
}
