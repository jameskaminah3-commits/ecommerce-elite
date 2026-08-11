import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { fetchPosts, formatPostDate } from '@/lib/blog';

// Latest published posts on the homepage. Renders nothing until there are posts,
// so it stays invisible on a fresh store.
export function FromTheJournal() {
  const { data } = useQuery({ queryKey: ['blog-posts', 'home'], queryFn: () => fetchPosts({ limit: 3 }) });
  const posts = data?.items ?? [];
  if (posts.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-10 md:mb-14">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2.5">Journal</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">From the <span className="serif-accent">journal</span></h2>
          </div>
          <Link href="/blog" className="hidden md:flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group flex flex-col">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-muted/50 ring-1 ring-border/50">
                {post.coverImageUrl ? (
                  <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-secondary/20 font-serif italic text-3xl">HF</div>
                )}
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground/80 mb-1.5">{formatPostDate(post.publishedAt || post.createdAt)}</p>
                <h3 className="text-lg font-semibold tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                {post.excerpt && <p className="text-muted-foreground mt-2 text-sm line-clamp-2">{post.excerpt}</p>}
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-3 group-hover:gap-2 transition-all">
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
