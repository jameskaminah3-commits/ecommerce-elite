---
name: Expanse Design System
description: UI/UX spec applied to Happyfine storefront — layout rules, component decisions, and parallax caveats.
---

# Expanse Design Spec Implementation

## Source spec
`attached_assets/Pasted-2b-Exact-UI-UX-Visual-Language-Layout-Specs-The-Expanse_1785375126210.txt`

## Key layout rules
- **Hero**: `grid-cols-3` — left 2/3 lifestyle image with gradient, right 1/3 split into two stacked editorial promo blocks.
- **Product grid**: `interleavedGrid()` in `pages/index.tsx` injects a `<PromoTile>` after every 4th product card. Grid is `lg:grid-cols-5` to accommodate the mix.
- **Parallax story banners**: CSS `background-attachment: fixed` + `backgroundPosition/Size`. Works on desktop; on mobile Tailwind must not clip with `overflow-hidden` on a parent or it breaks.
- **Mega menu**: State managed with `activeMega` + 120ms debounce timer in `Header.tsx`. Data is hardcoded in `MEGA_MENU` constant — sub-categories don't exist in the DB.
- **Predictive search**: `useListProducts` fires when `searchQuery.length >= 2`. Shows trending/collections left pane + live product tiles right pane.
- **Cart drawer**: Free delivery threshold = KES 5,000. Progress bar uses `Math.min((total/5000)*100, 100)`. Cross-sell uses `useListProducts` with `enabled: isCartDrawerOpen`.
- **Backdrop blur**: Modified `SheetOverlay` in `ui/sheet.tsx` to use `bg-black/50 backdrop-blur-sm` instead of `bg-black/80`.

**Why:** Spec required editorial, high-density layout (Expanse theme). These are structural decisions that must be maintained when adding new pages/components.

**How to apply:** Any new homepage section should follow the `py-14 md:py-20` + container pattern. New promo tile variants go in `PromoTile.tsx` PROMOS object.
