// URL-safe slug: lowercase words joined by hyphens. Product URLs are
// /products/<id>-<slug>, so the slug is what puts the product's keywords in the URL.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// The public path of a product page. The id keeps links stable if the name changes;
// the slug adds the product's keywords to the URL for search engines and shared links.
export function productPath(p: { id: number; slug?: string | null; name?: string | null }): string {
  const tail = slugify(p.slug || p.name || "");
  return tail ? `/products/${p.id}-${tail}` : `/products/${p.id}`;
}
