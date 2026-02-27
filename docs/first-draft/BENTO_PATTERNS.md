# Bento Board Patterns Catalog — Original Templates

## Pattern 1: Hero Split Bento (Home Page)
- `grid grid-cols-1 lg:grid-cols-2` — 2 equal columns
- Left: Phone mockup with animated bar chart, stats, and transaction list inside a realistic phone frame
- Right: 3-row stack — Profile card (title + stats), Bio + Socials (3+2 col-span), Recent Work thumbnails (2x2 grid)
- Inner grid: `grid-cols-5` (3-span bio, 2-span social buttons)

## Pattern 2: 3-Column Masonry Gallery (Work Page)
- `grid grid-cols-1 md:grid-cols-3` — 3 equal columns
- Each column is a `flex flex-col gap-5` with cards of varying heights (h-56, h-72, h-48, h-64)
- Cards: image with gradient overlay, hover scale-105, bottom-aligned text + arrow button
- Creates a Pinterest/masonry effect with staggered heights

## Pattern 3: 6-Column Service Bento (Services Page)
- `grid grid-cols-1 lg:grid-cols-6 gap-6`
- Row 1: Three `col-span-2` cards (Brand Identity, Web Design, UI/UX)
  - Each has animated demo inside: typography loop, browser wireframe, cursor simulation
- Row 2: Two `col-span-3` cards (Strategy, Development)
  - Strategy: animated bar chart with growing bars
  - Development: code editor with syntax highlighting
- Alternating borders: dashed border-zinc-800 vs solid border-white/10

## Pattern 4: About Page Bento (About Page)
- `grid grid-cols-1 lg:grid-cols-3`
- Main hero card: `col-span-2` — large text, red glow orb, CTA
- Right column: `col-span-1 grid-rows-2` — Stats card (big number "12+") + Image card (grayscale->color on hover)
- Bottom row: `col-span-1` value card + `col-span-2` split (text left, image right with red overlay)

## Pattern 5: 12-Column Pricing Grid (Services Page)
- `grid grid-cols-1 lg:grid-cols-12`
- Three `col-span-4` pricing cards
- Middle card has red glow orb + "Most Popular" badge
- Third card splits into two stacked boxes (top: pricing, bottom: testimonial quote)

## Pattern 6: 12-Column Contact Split (Book a Call Page)
- `grid lg:grid-cols-12 gap-12`
- Left: `col-span-4` — stacked info blocks (email, social links, office locations)
- Right: `col-span-8` — contact form with animated inputs

## Pattern 7: Process Steps Grid (Services Page)
- `grid lg:grid-cols-12` — split 5/7
- Left `col-span-5`: section title + description
- Right `col-span-7`: `grid grid-cols-2 gap-10` — 4 process step cards with icons

## Pattern 8: Capabilities Grid (Services Page)
- `grid grid-cols-1 lg:grid-cols-12` — split 5/7
- Left `col-span-5`: large logo grid + tagline (min-h-360px)
- Right `col-span-7`: `grid grid-cols-2 md:grid-cols-3` — 6 capability items with icons

## Pattern 9: 5-Column Stats Strip (Services Page)
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-0`
- 5 stat cards in a single row, no gap, shared border
- Each: big number + label + subtle description

## Pattern 10: Scrolling Testimonial Columns (Services Page)
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- 3 columns of testimonial cards, each column scrolls at different speeds
- Mask gradient at top and bottom for fade effect

## Key Animation Patterns Used:
- `fadeSlideIn` with staggered delays (0.2s, 0.3s, 0.4s...)
- `columnReveal` clip-path animation for grid curtain effect
- `bar-grow` for animated chart bars
- `brandIdentityLoop` for typography/color cycling
- `frameUp` + `stepFadeUp` for browser wireframe assembly
- `cursor-sim-path` for animated cursor movement
- `infinite-scroll` for marquee effects
- `border-spin` for conic-gradient CTA buttons
- Hover: `group-hover:scale-105/110`, `group-hover:opacity`, `group-hover:border-[#ef233c]`
- Red glow orbs: `bg-[#ef233c]/10 blur-[90px]`
- Gradient borders: `--border-gradient` with mask-composite
