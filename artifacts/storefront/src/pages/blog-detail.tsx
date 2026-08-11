import React from 'react';
import { Link, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { fetchPost, formatPostDate } from '@/lib/blog';
import { renderMarkdown } from '@/lib/markdown';
import { useSeo } from '@/hooks/useSeo';
import { ChevronRight, ArrowLeft } from 'lucide-react';

export default function BlogDetailPage() {
  const params = useParams();
  const slug = String(params.slug ?? '');
  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => fetchPost(slug),
    enabled: !!slug,
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const dateIso = post?.publishedAt || post?.createdAt || null;

  useSeo(
    post
      ? {
          title: `${post.metaTitle || post.title} — Happyfine Journal`,
          description: post.metaDescription || post.excerpt || post.title,
          canonicalPath: `/blog/${post.slug}`,
          image: post.coverImageUrl || undefined,
          type: 'article',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.metaDescription || post.excerpt || '',
              image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
              datePublished: dateIso,
              dateModified: post.updatedAt,
              author: { '@type': 'Organization', name: post.author },
              publisher: { '@type': 'Organization', name: 'Happyfine Wholesalers' },
              mainEntityOfPage: `${origin}/blog/${post.slug}`,
              keywords: post.tags.join(', '),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
                { '@type': 'ListItem', position: 2, name: 'Journal', item: `${origin}/blog` },
                { '@type': 'ListItem', position: 3, name: post.title, item: `${origin}/blog/${post.slug}` },
              ],
            },
          ],
        }
      : { title: 'Journal — Happyfine Wholesalers' },
  );

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-16 max-w-3xl animate-pulse">
          <div className="h-4 w-40 bg-muted rounded mb-6" />
          <div className="h-10 w-3/4 bg-muted rounded mb-4" />
          <div className="aspect-[16/9] bg-muted rounded-3xl mb-8" />
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-muted rounded" />)}</div>
        </div>
      </StorefrontLayout>
    );
  }

  if (!post) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Post not found</h1>
          <Link href="/blog" className="text-primary font-semibold mt-4 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to the journal
          </Link>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <article className="container mx-auto px-4 py-10 md:py-16">
        {/* Breadcrumbs */}
        <nav className="text-sm text-muted-foreground flex items-center gap-1.5 mb-8 max-w-3xl mx-auto">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/blog" className="hover:text-foreground">Journal</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground truncate">{post.title}</span>
        </nav>

        <header className="max-w-3xl mx-auto text-center mb-8 md:mb-10">
          {post.tags[0] && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">{post.tags[0]}</p>
          )}
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.08]">{post.title}</h1>
          <p className="text-muted-foreground mt-5 text-sm">
            {formatPostDate(dateIso)} · By {post.author}
          </p>
        </header>

        {post.coverImageUrl && (
          <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden ring-1 ring-border/50 mb-10 md:mb-12">
            <img src={post.coverImageUrl} alt={post.title} className="w-full aspect-[16/9] object-cover" />
          </div>
        )}

        <div
          className="prose prose-neutral md:prose-lg max-w-2xl mx-auto prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-2xl"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        {post.tags.length > 0 && (
          <div className="max-w-2xl mx-auto mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="text-xs font-medium bg-muted text-muted-foreground rounded-full px-3 py-1.5">{t}</span>
            ))}
          </div>
        )}

        <div className="max-w-2xl mx-auto mt-12 pt-8 border-t">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <ArrowLeft className="w-4 h-4" /> Back to the journal
          </Link>
        </div>
      </article>
    </StorefrontLayout>
  );
}
