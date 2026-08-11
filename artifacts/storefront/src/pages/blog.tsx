import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { fetchPosts, formatPostDate, type BlogPost } from '@/lib/blog';
import { useSeo } from '@/hooks/useSeo';
import { ArrowRight } from 'lucide-react';

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col">
      <div className={`relative rounded-3xl overflow-hidden bg-muted/50 ring-1 ring-border/50 ${featured ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary/20 font-serif italic text-4xl">HF</div>
        )}
        {post.tags[0] && (
          <span className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm text-foreground/70 text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase">
            {post.tags[0]}
          </span>
        )}
      </div>
      <div className="pt-4">
        <p className="text-xs text-muted-foreground/80 mb-2">
          {formatPostDate(post.publishedAt || post.createdAt)} · {post.author}
        </p>
        <h3 className={`font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors ${featured ? 'text-2xl md:text-3xl' : 'text-lg'} leading-snug`}>
          {post.title}
        </h3>
        {post.excerpt && <p className="text-muted-foreground mt-2 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>}
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-3 group-hover:gap-2 transition-all">
          Read more <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const { data, isLoading } = useQuery({ queryKey: ['blog-posts'], queryFn: () => fetchPosts({ limit: 12 }) });
  const posts = data?.items ?? [];
  const [featured, ...rest] = posts;

  useSeo({
    title: 'The Happyfine Journal — Wholesale tips & new stock',
    description: 'Guides, product spotlights and wholesale buying tips from Happyfine Wholesalers, Kenya.',
    canonicalPath: '/blog',
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'The Happyfine Journal',
      url: (typeof window !== 'undefined' ? window.location.origin : '') + '/blog',
    },
  });

  return (
    <StorefrontLayout>
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-2xl mb-12 md:mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Journal</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            From the <span className="serif-accent">journal</span>
          </h1>
          <p className="text-muted-foreground mt-4 text-base md:text-lg">
            Buying guides, product spotlights and stories from our Nairobi warehouse.
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-3xl bg-muted" />
                <div className="h-4 bg-muted rounded mt-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-3xl border border-dashed">
            <h3 className="text-lg font-semibold">No posts yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">Check back soon — or publish your first post in the admin console.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {featured && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <PostCard post={featured} featured />
                <div className="hidden md:block">
                  {rest[0] && <PostCard post={rest[0]} />}
                </div>
              </div>
            )}
            {rest.length > (rest[0] ? 1 : 0) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {rest.slice(1).map((p) => <PostCard key={p.id} post={p} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
