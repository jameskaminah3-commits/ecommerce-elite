import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  blogPostsTable,
  categoriesTable,
  db,
  deliveryLocationsTable,
  deliveryClassesTable,
  homepageBlocksTable,
  pool,
  productsTable,
  productVariantsTable,
  usersTable,
} from "@workspace/db";

// Mirrors hashPassword() in artifacts/api-server/src/routes/auth.ts so the
// seeded accounts can log in locally. (Swap both for bcrypt in production.)
function hashPassword(pwd: string): string {
  return crypto.createHash("sha256").update(pwd + "happyfine_salt").digest("hex");
}

const seedUsers = [
  { name: "Happyfine Admin", email: "admin@happyfine.co.ke", phone: "0700000000", role: "admin" as const, password: "password" },
  { name: "Jane Customer", email: "jane@example.com", phone: "0711111111", role: "customer" as const, password: "password" },
];

// Expanse-style top-of-homepage: a rotating hero (image + video slides) over a
// grid of tiles (6+6) and a three-across category row (4+4+4).
const sampleBlogPosts = [
  {
    title: "How to stock your shop for less: a wholesale buying guide",
    slug: "wholesale-buying-guide",
    excerpt: "Five practical ways Kenyan retailers cut costs buying in bulk — from bundle pricing to delivery classes.",
    coverImageUrl: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1400&auto=format&fit=crop&q=80",
    author: "Happyfine",
    tags: "Guides,Wholesale",
    status: "published" as const,
    metaTitle: "Wholesale Buying Guide for Kenyan Retailers | Happyfine",
    metaDescription: "Practical tips to buy stock in bulk and save — bundle pricing, delivery planning and choosing the right suppliers in Kenya.",
    publishedAt: new Date("2026-07-02T09:00:00Z"),
    content: `Buying wholesale is the fastest way to grow margins — if you do it well.\n\n## 1. Buy in the right quantities\nBulk pricing rewards volume, but overbuying ties up cash. Track your best sellers and reorder those first.\n\n## 2. Bundle complementary products\nPair a cookware set with utensils, or a TV with a wall mount. Bundles lift your average order value.\n\n## 3. Plan delivery by town\nDelivery cost varies by destination. Group orders to the same town to spread the cost.\n\n> Tip: our checkout shows the exact delivery fee per town before you pay.\n\n## 4. Watch for automatic discounts\nMany lines drop in price at 10+ units — no code needed.\n\n## 5. Build a relationship with your supplier\nConsistent orders unlock better terms over time.`,
  },
  {
    title: "Product spotlight: building a home coffee corner",
    slug: "home-coffee-corner",
    excerpt: "The essentials that turn a countertop into a café — and why they sell so well.",
    coverImageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1400&auto=format&fit=crop&q=80",
    author: "Happyfine",
    tags: "Spotlight,Kitchen",
    status: "published" as const,
    metaTitle: "Build a Home Coffee Corner — Product Spotlight | Happyfine",
    metaDescription: "The best-selling essentials for a home coffee setup, and tips for retailers stocking them.",
    publishedAt: new Date("2026-07-20T09:00:00Z"),
    content: `A great cup starts with a few well-chosen tools.\n\n## The essentials\n- A reliable **kettle** with temperature control\n- A **grinder** for fresh beans\n- A **brewer** — pour-over, moka pot or press\n- Good **mugs** that keep heat\n\n## Why it sells\nCoffee gear is an easy add-on and repeats well as customers upgrade. Display pieces together so shoppers picture the whole set.`,
  },
  {
    title: "New stock every week: what just landed",
    slug: "new-stock-this-week",
    excerpt: "A quick look at fresh arrivals across electronics, home and fitness.",
    coverImageUrl: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1400&auto=format&fit=crop&q=80",
    author: "Happyfine",
    tags: "News",
    status: "published" as const,
    metaTitle: "New Stock This Week | Happyfine Wholesalers",
    metaDescription: "See the latest wholesale arrivals across electronics, home & living, beauty and fitness.",
    publishedAt: new Date("2026-08-01T09:00:00Z"),
    content: `Fresh stock lands at our Nairobi warehouse every week.\n\nThis week we added new **audio**, **kitchen** and **fitness** lines. Browse the [full catalogue](/products) to see what's in.`,
  },
];

const sampleHomepageBlocks = [
  // ── HERO slideshow (auto-rotates) ──
  {
    placement: "hero" as const, kind: "image" as const, columnSpan: 12, aspectRatio: "21/9", overlayOpacity: 45,
    imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&auto=format&fit=crop&q=80",
    heading: "Wholesale prices. Delivered across Kenya.",
    subheading: "Home, electronics, beauty and fitness — quality stock in bulk.",
    ctaLabel: "Shop all products", ctaHref: "/products",
    textAlign: "center-center", textColor: "#ffffff", sortOrder: 0,
  },
  {
    placement: "hero" as const, kind: "video" as const, columnSpan: 12, aspectRatio: "21/9", overlayOpacity: 40,
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    imageUrl: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1600&auto=format&fit=crop&q=80",
    heading: "New stock every week",
    subheading: "Straight from our Nairobi warehouse to your shelves.",
    ctaLabel: "See what's new", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 1,
  },
  // ── GRID blocks — a bento arrangement ──
  // A tall 8-col × 8-row feature tile sits beside two stacked 4-col × 4-row
  // tiles (rowSpan is explicit here), then a 6+6 row flows underneath. Because
  // the grid's row unit equals one column width, every tile aligns exactly.
  {
    placement: "grid" as const, kind: "image" as const, columnSpan: 8, rowSpan: 8, aspectRatio: "1/1", overlayOpacity: 38,
    parallax: true,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
    heading: "Electronics", subheading: "Audio, smart devices & accessories.",
    ctaLabel: "Browse", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 1,
  },
  {
    placement: "grid" as const, kind: "color" as const, columnSpan: 4, rowSpan: 4, aspectRatio: "1/1", overlayOpacity: 0,
    backgroundColor: "#0f5132",
    heading: "Buy 10+, save 15%", subheading: "Automatic bulk pricing — no code needed.",
    ctaLabel: "Shop in bulk", ctaHref: "/products",
    textAlign: "center-left", textColor: "#ffffff", sortOrder: 2,
  },
  {
    placement: "grid" as const, kind: "image" as const, columnSpan: 4, rowSpan: 4, aspectRatio: "1/1", overlayOpacity: 30,
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80",
    heading: "Home & Living", ctaLabel: "Shop", ctaHref: "/products",
    textAlign: "bottom-center", textColor: "#ffffff", sortOrder: 3,
  },
  {
    placement: "grid" as const, kind: "image" as const, columnSpan: 6, rowSpan: 4, aspectRatio: "3/2", overlayOpacity: 30,
    imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80",
    heading: "Beauty", ctaLabel: "Shop", ctaHref: "/products",
    textAlign: "bottom-center", textColor: "#ffffff", sortOrder: 4,
  },
  {
    placement: "grid" as const, kind: "image" as const, columnSpan: 6, rowSpan: 4, aspectRatio: "3/2", overlayOpacity: 30,
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
    heading: "Gym & Fitness", ctaLabel: "Shop", ctaHref: "/products",
    textAlign: "bottom-center", textColor: "#ffffff", sortOrder: 5,
  },
  // Pastel discount tiles — soft background, dark copy, a product image floats.
  {
    placement: "grid" as const, kind: "color" as const, columnSpan: 6, rowSpan: 4, aspectRatio: "3/2", overlayOpacity: 0,
    backgroundColor: "#e2ece3",
    imageUrl: "https://images.unsplash.com/photo-1608354580875-30bd4168b351?w=700&auto=format&fit=crop&q=80",
    heading: "Up to –20%", subheading: "Small kitchen appliances.",
    ctaLabel: "Shop the sale", ctaHref: "/products",
    textAlign: "center-left", textColor: "#14281f", sortOrder: 6,
  },
  {
    placement: "grid" as const, kind: "color" as const, columnSpan: 6, rowSpan: 4, aspectRatio: "3/2", overlayOpacity: 0,
    backgroundColor: "#f3e7e6",
    imageUrl: "https://images.unsplash.com/photo-1602874801006-e26c4c5b5f6a?w=700&auto=format&fit=crop&q=80",
    heading: "Up to –15%", subheading: "Selected home & décor.",
    ctaLabel: "Explore deals", ctaHref: "/products",
    textAlign: "center-left", textColor: "#3a2222", sortOrder: 7,
  },
  // ── PINNED split — the first block pins while the rest scroll past it ──
  {
    placement: "pinned" as const, kind: "image" as const, columnSpan: 6, aspectRatio: "4/5", overlayOpacity: 50,
    imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1000&auto=format&fit=crop&q=80",
    heading: "Built for Kenyan business", subheading: "Wholesale stock, fair prices, delivered nationwide — no middlemen.",
    ctaLabel: "Our story", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 10,
  },
  {
    placement: "pinned" as const, kind: "image" as const, columnSpan: 6, aspectRatio: "4/3", overlayOpacity: 35,
    parallax: true,
    imageUrl: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1000&auto=format&fit=crop&q=80",
    heading: "Fast nationwide delivery", subheading: "From our Nairobi warehouse to your shelves.",
    ctaLabel: "See delivery", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 11,
  },
  {
    placement: "pinned" as const, kind: "image" as const, columnSpan: 6, aspectRatio: "4/3", overlayOpacity: 35,
    parallax: true,
    imageUrl: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=1000&auto=format&fit=crop&q=80",
    heading: "Quality you can trust", subheading: "Authentic products, guaranteed.",
    ctaLabel: "Browse catalogue", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 12,
  },
  {
    placement: "pinned" as const, kind: "image" as const, columnSpan: 6, aspectRatio: "4/3", overlayOpacity: 35,
    parallax: true,
    imageUrl: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1000&auto=format&fit=crop&q=80",
    heading: "Buy more, save more", subheading: "Automatic bulk pricing on every order.",
    ctaLabel: "Shop in bulk", ctaHref: "/products",
    textAlign: "bottom-left", textColor: "#ffffff", sortOrder: 13,
  },
];

const seedDeliveryLocations = [
  { name: "Nairobi", cost: "300.00" },
  { name: "Mombasa", cost: "650.00" },
  { name: "Kisumu", cost: "600.00" },
  { name: "Nakuru", cost: "450.00" },
  { name: "Eldoret", cost: "550.00" },
  { name: "Thika", cost: "350.00" },
];

const categories = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Smart devices, audio gear, and useful accessories.",
    imageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Home & Living",
    slug: "home-living",
    description: "Kitchen, furniture, storage, and daily home essentials.",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Beauty",
    slug: "beauty",
    description: "Skincare, haircare, and personal care products.",
    imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Gym & Fitness",
    slug: "gym-fitness",
    description: "Workout gear and home fitness equipment.",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
  },
];

const products = [
  {
    categorySlug: "electronics",
    name: "NovaBass Wireless Headphones",
    slug: "novabass-wireless-headphones",
    description: "Comfortable over-ear headphones with deep bass and long battery life.",
    basePrice: "4200.00",
    compareAtPrice: "5200.00",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&auto=format&fit=crop&q=80",
    ],
    featured: true,
    rating: "4.70",
    reviewCount: 38,
    variants: [
      { sku: "ELEC-NBH-BLK", color: "Black", price: "4200.00", stock: 24 },
      { sku: "ELEC-NBH-SLV", color: "Silver", price: "4200.00", stock: 12 },
    ],
  },
  {
    categorySlug: "electronics",
    name: "Amani 4K Smart TV 43 Inch",
    slug: "amani-4k-smart-tv-43",
    description: "Crisp 4K display with streaming apps and slim bezels.",
    basePrice: "31500.00",
    compareAtPrice: "34900.00",
    imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: true,
    rating: "4.50",
    reviewCount: 21,
    variants: [
      { sku: "ELEC-TV43-STD", size: "43 inch", color: "Black", price: "31500.00", stock: 7 },
    ],
  },
  {
    categorySlug: "home-living",
    name: "ChefPro Non-Stick Cookware Set",
    slug: "chefpro-non-stick-cookware-set",
    description: "Durable non-stick pots and pans for daily home or restaurant use.",
    basePrice: "6800.00",
    compareAtPrice: "7900.00",
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1585515320310-259814833e62?w=900&auto=format&fit=crop&q=80",
    ],
    featured: true,
    rating: "4.80",
    reviewCount: 44,
    variants: [
      { sku: "HOME-COOK-5PC", size: "5 piece", color: "Black", price: "6800.00", stock: 18 },
      { sku: "HOME-COOK-8PC", size: "8 piece", color: "Black", price: "9800.00", stock: 10 },
    ],
  },
  {
    categorySlug: "home-living",
    name: "ErgoFlex Office Chair",
    slug: "ergoflex-office-chair",
    description: "Breathable ergonomic office chair with adjustable height and tilt.",
    basePrice: "9500.00",
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: false,
    rating: "4.40",
    reviewCount: 17,
    variants: [
      { sku: "HOME-CHAIR-BLK", color: "Black", price: "9500.00", stock: 15 },
      { sku: "HOME-CHAIR-GRY", color: "Grey", price: "9500.00", stock: 8 },
    ],
  },
  {
    categorySlug: "beauty",
    name: "GlowCare Vitamin C Serum",
    slug: "glowcare-vitamin-c-serum",
    description: "Brightening face serum with vitamin C for daily skincare routines.",
    basePrice: "1350.00",
    compareAtPrice: "1700.00",
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: true,
    rating: "4.60",
    reviewCount: 59,
    variants: [
      { sku: "BEAUTY-VITC-30", size: "30ml", price: "1350.00", stock: 36 },
      { sku: "BEAUTY-VITC-50", size: "50ml", price: "1900.00", stock: 20 },
    ],
  },
  {
    categorySlug: "gym-fitness",
    name: "PowerGrip Yoga Mat",
    slug: "powergrip-yoga-mat",
    description: "Non-slip mat for yoga, stretching, pilates, and home workouts.",
    basePrice: "2200.00",
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1601925228008-22d2a5090f0c?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: false,
    rating: "4.30",
    reviewCount: 26,
    variants: [
      { sku: "GYM-MAT-BLU", color: "Blue", price: "2200.00", stock: 22 },
      { sku: "GYM-MAT-PNK", color: "Pink", price: "2200.00", stock: 13 },
    ],
  },
];

async function upsertCategory(category: (typeof categories)[number]) {
  const [row] = await db
    .insert(categoriesTable)
    .values(category)
    .onConflictDoUpdate({
      target: categoriesTable.slug,
      set: {
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
      },
    })
    .returning();

  return row;
}

async function main(): Promise<void> {
  for (const user of seedUsers) {
    await db
      .insert(usersTable)
      .values({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        passwordHash: hashPassword(user.password),
      })
      .onConflictDoUpdate({
        target: usersTable.email,
        set: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          passwordHash: hashPassword(user.password),
        },
      });
  }

  for (const loc of seedDeliveryLocations) {
    await db
      .insert(deliveryLocationsTable)
      .values({ name: loc.name, cost: loc.cost, active: true })
      .onConflictDoUpdate({ target: deliveryLocationsTable.name, set: { cost: loc.cost } });
  }

  for (const name of ["Standard", "Bulky"]) {
    await db
      .insert(deliveryClassesTable)
      .values({ name })
      .onConflictDoNothing({ target: deliveryClassesTable.name });
  }

  const existingBlocks = await db.select().from(homepageBlocksTable);
  if (existingBlocks.length === 0) {
    await db.insert(homepageBlocksTable).values(sampleHomepageBlocks);
  }

  const existingPosts = await db.select().from(blogPostsTable);
  if (existingPosts.length === 0) {
    await db.insert(blogPostsTable).values(sampleBlogPosts);
  }

  const categoryBySlug = new Map<string, number>();

  for (const category of categories) {
    const row = await upsertCategory(category);
    categoryBySlug.set(category.slug, row.id);
  }

  for (const product of products) {
    const categoryId = categoryBySlug.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing category "${product.categorySlug}"`);
    }

    const [productRow] = await db
      .insert(productsTable)
      .values({
        name: product.name,
        slug: product.slug,
        description: product.description,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        categoryId,
        imageUrl: product.imageUrl,
        images: product.images,
        status: "active",
        featured: product.featured,
        rating: product.rating,
        reviewCount: product.reviewCount,
      })
      .onConflictDoUpdate({
        target: productsTable.slug,
        set: {
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          categoryId,
          imageUrl: product.imageUrl,
          images: product.images,
          status: "active",
          featured: product.featured,
          rating: product.rating,
          reviewCount: product.reviewCount,
        },
      })
      .returning();

    for (const variant of product.variants) {
      await db
        .insert(productVariantsTable)
        .values({
          productId: productRow.id,
          sku: variant.sku,
          size: "size" in variant ? variant.size ?? null : null,
          color: "color" in variant ? variant.color ?? null : null,
          price: variant.price,
          stock: variant.stock,
        })
        .onConflictDoUpdate({
          target: productVariantsTable.sku,
          set: {
            productId: productRow.id,
            size: "size" in variant ? variant.size ?? null : null,
            color: "color" in variant ? variant.color ?? null : null,
            price: variant.price,
            stock: variant.stock,
          },
        });
    }
  }

  console.log(
    `Seeded ${seedUsers.length} users, ${categories.length} categories and ${products.length} products.`,
  );
  console.log('Admin login: admin@happyfine.co.ke / password');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
