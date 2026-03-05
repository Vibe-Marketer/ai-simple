<reference>

## Bento Grid Compositions

Five proven bento layouts extracted from the AI Simple website. Each one uses CSS Grid with specific col-span patterns. Copy the grid structure, swap the content. All compositions support both Dark Ops and Light Ops modes via `[MODE-*]` token substitution.

**Mode Token Quick Reference:**
- Dark Ops: `bg-black`, `border-zinc-800`, `border-white/10`, `bg-zinc-900/40`, `text-white`, `text-zinc-500`
- Light Ops: `bg-white`, `border-zinc-300`, `border-zinc-200`, `bg-zinc-50`, `text-zinc-900`, `text-zinc-500`

---

### Composition 01: 6-Column Service Grid

**Use for:** Service showcases, feature grids, capability overviews

**Grid:** `grid grid-cols-1 lg:grid-cols-6 gap-6`

**Layout:**
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ col-span-2│ │ col-span-2│ │ col-span-2│  ← 3 equal service cards
└──────────┘ └──────────┘ └──────────┘
┌────────────────┐ ┌────────────────┐
│   col-span-3   │ │   col-span-3   │      ← 2 wide proof/data cards
└────────────────┘ └────────────────┘
```

**Card styles:**
- Top row: Alternating `border-dashed [MODE-SURFACE-CARD] [MODE-BORDER]` and `[MODE-SURFACE-1] [MODE-BORDER-SUBTLE]`
- Bottom row: Same alternating pattern
- Each card contains an animated demo element (bar chart, terminal, UI mockup)
- All cards: `overflow-hidden rounded-none p-8 relative backdrop-blur-sm`

**Tailwind:**
```html
<div class="grid grid-cols-1 lg:grid-cols-6 gap-6">
  <!-- Row 1: Three equal cards -->
  <div class="bento-card lg:col-span-2 border-dashed [MODE-SURFACE-CARD] border [MODE-BORDER] rounded-none p-8 relative overflow-hidden">...</div>
  <div class="bento-card lg:col-span-2 [MODE-SURFACE-1] border [MODE-BORDER-SUBTLE] rounded-none p-8 relative overflow-hidden">...</div>
  <div class="bento-card lg:col-span-2 [MODE-SURFACE-1] border [MODE-BORDER-SUBTLE] rounded-none p-8 relative overflow-hidden">...</div>
  <!-- Row 2: Two wide cards -->
  <div class="bento-card lg:col-span-3 border-dashed [MODE-SURFACE-CARD] border [MODE-BORDER] rounded-none p-8 relative overflow-hidden">...</div>
  <div class="bento-card lg:col-span-3 [MODE-SURFACE-1] border [MODE-BORDER-SUBTLE] rounded-none p-8 relative overflow-hidden">...</div>
</div>
```

**Internal animation patterns for demo areas:**
- `brandLoop`: 8s cycling animation for brand identity elements
- `frameUp`: 7s browser wireframe animation
- `cursor-path`: 5s animated cursor moving across a UI mockup
- `barGrow`: Staggered bar chart with `transform: scaleY(0)` → `scaleY(1)`
- `scanline`: Terminal scan line sweeping top to bottom

---

### Composition 02: About Page Bento (3-Column Asymmetric)

**Use for:** About pages, team intros, company overviews

**Grid:** `grid grid-cols-1 lg:grid-cols-3 gap-6`

**Layout:**
```
┌────────────────────┐ ┌────────┐
│                    │ │ Stats  │
│    col-span-2      │ │ card   │
│   (Hero card)      │ ├────────┤
│                    │ │ Image  │
└────────────────────┘ │ card   │
                       └────────┘
┌────────┐ ┌────────────────────┐
│ Value  │ │                    │
│ prop   │ │   col-span-2       │
│ card   │ │  (Feature split)   │
└────────┘ └────────────────────┘
```

**Key details:**
- Hero card (col-span-2): `border-dashed [MODE-SURFACE-CARD] [MODE-BORDER] lg:p-12` with red glow orb (`w-96 h-96 bg-[#ef233c]/5 blur-[100px]`)
- Right column: `grid grid-rows-2 gap-6` containing stat card + image card
- Stat card: Giant number with `text-6xl font-manrope` + red accent (`text-[#ef233c]`)
- Bottom feature card (col-span-2): Internal `grid grid-cols-2` with content left, visual right separated by dashed border

**Tailwind:**
```html
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <!-- Hero: col-span-2 -->
  <div class="bento-card lg:col-span-2 border-dashed [MODE-SURFACE-CARD] border [MODE-BORDER] lg:p-12 p-10 relative overflow-hidden">
    <div class="absolute right-0 top-0 w-96 h-96 bg-[#ef233c]/5 rounded-full blur-[100px] pointer-events-none"></div>
    <!-- Content here -->
  </div>
  <!-- Right stack -->
  <div class="lg:col-span-1 grid grid-rows-2 gap-6">
    <div class="bento-card [MODE-SURFACE-1] border [MODE-BORDER-SUBTLE] p-8 text-center"><!-- Stat --></div>
    <div class="bento-card border [MODE-BORDER] border-dashed overflow-hidden min-h-[200px]"><!-- Image --></div>
  </div>
  <!-- Bottom left value card -->
  <div class="bento-card lg:col-span-1 [MODE-SURFACE-CARD] border [MODE-BORDER] border-dashed p-8"><!-- Value prop --></div>
  <!-- Bottom right wide feature -->
  <div class="bento-card lg:col-span-2 grid grid-cols-1 md:grid-cols-2 [MODE-SURFACE-1] border [MODE-BORDER] border-dashed overflow-hidden">
    <div class="p-8 md:p-10"><!-- Text content --></div>
    <div class="border-l [MODE-BORDER] border-dashed min-h-[240px]"><!-- Visual --></div>
  </div>
</div>
```

---

### Composition 03: 5-Column Stats Strip + Brand Marquee

**Use for:** Social proof sections, metrics showcases, trust bars

**Grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-0`

**Layout:**
```
┌────────┬────────┬────────┬────────┬────────┐
│ Stat 1 │ Stat 2 │ Stat 3 │ Stat 4 │ Stat 5 │  ← Zero-gap, shared borders
└────────┴────────┴────────┴────────┴────────┘
┌────────────────────────────────────────────┐
│         ← Infinite scroll marquee →        │  ← Brand logos scrolling
└────────────────────────────────────────────┘
```

**Key details:**
- Outer wrapper: `[MODE-SURFACE-CARD] w-full border [MODE-BORDER-SUBTLE]` (single border around all cards)
- Each stat cell: `p-8 border-r [MODE-BORDER-SUBTLE]` (no gap, shared internal borders)
- No external card borders — the grid itself IS the card
- Pulse dot + mono label + big number + description per cell
- Marquee below: `overflow-hidden py-8` with CSS mask for fade edges
- Marquee scroll: duplicate content, `animation: infinite-scroll 30s linear infinite`

**Tailwind:**
```html
<!-- Stats Strip -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-0 [MODE-SURFACE-CARD] w-full border [MODE-BORDER-SUBTLE]">
  <div class="bento-card p-8 border-r [MODE-BORDER-SUBTLE] group hover:[MODE-SURFACE-1] transition-colors">
    <div class="flex items-center gap-2 mb-4">
      <span class="w-1.5 h-1.5 rounded-full bg-[#ef233c]" style="animation: pulse-dot 2s infinite;"></span>
      <span class="text-[10px] font-mono [MODE-TEXT-MUTED] uppercase tracking-widest">Label</span>
    </div>
    <span class="text-4xl font-manrope font-medium [MODE-TEXT-PRIMARY] tracking-tighter block mb-1">$72M+</span>
    <p class="[MODE-TEXT-MUTED] text-xs">Description</p>
  </div>
  <!-- Repeat for each stat... last cell has no border-r -->
</div>

<!-- Brand Marquee -->
<div class="border-x border-b [MODE-BORDER-SUBTLE] overflow-hidden py-8" style="mask-image: linear-gradient(to right, transparent 0, black 128px, black calc(100% - 128px), transparent 100%);">
  <div class="flex items-center w-max" style="animation: infinite-scroll 30s linear infinite;">
    <div class="flex items-center gap-16 px-8">
      <span class="text-xl font-manrope font-bold [MODE-TEXT-PRIMARY] opacity-30 tracking-tight">Brand Name</span>
      <!-- Repeat brands... -->
    </div>
    <!-- Duplicate entire set for seamless loop -->
  </div>
</div>
```

---

### Composition 04: 12-Column Process + Capabilities Grid

**Use for:** How-it-works sections, methodology breakdowns, service catalogs

**Grid:** Two sub-grids — `grid lg:grid-cols-12` for the 5/7 asymmetric split

**Layout:**
```
Part A — Process (5/7 split):
┌───────────┐ ┌──────┬──────┐
│ col-span-5 │ │ Step │ Step │
│ (Section   │ │  01  │  02  │  ← col-span-7 containing 2x2 grid
│  title)    │ ├──────┼──────┤
│            │ │ Step │ Step │
└───────────┘ │  03  │  04  │
              └──────┴──────┘

Part B — Capabilities (5/7 split inside single border):
┌───────────┬──────────────────┐
│ col-span-5 │   col-span-7    │
│ (Logo wall │ (3x2 capability │
│  + tags)   │  icon grid)     │
└───────────┴──────────────────┘
```

**Key details:**
- Process section: `grid lg:grid-cols-12 gap-16 items-start`
- Left title block (col-span-5): Pulse dot, mono label, heading with accent word, description
- Right steps (col-span-7): Internal `grid grid-cols-1 md:grid-cols-2 gap-10` with 4 process cards
- Each step card: `border [MODE-BORDER] border-dashed p-6` with numbered icon box (`w-10 h-10 bg-[#ef233c]/10 text-[#ef233c] rounded-none`)
- Capabilities grid: Single `border [MODE-BORDER] border-dashed` container with internal 5/7 split
- Left panel: Logo + tag cloud (`px-3 py-1.5 bg-[MODE-RED-SUBTLE] border [MODE-BORDER-SUBTLE] rounded-none text-[10px] font-mono`)
- Right panel: `grid grid-cols-2 md:grid-cols-3 gap-10` capability items with icon + title + description

**Tailwind:**
```html
<!-- Process Grid -->
<div class="grid lg:grid-cols-12 gap-16 items-start mb-16">
  <div class="lg:col-span-5 pt-4"><!-- Section title --></div>
  <div class="lg:col-span-7">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
      <!-- 4 step cards -->
    </div>
  </div>
</div>

<!-- Capabilities Grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 border [MODE-BORDER] border-dashed">
  <div class="lg:col-span-5 p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-dashed [MODE-BORDER]">
    <!-- Logo + description + tag cloud -->
  </div>
  <div class="lg:col-span-7 p-8 md:p-12 [MODE-SURFACE-CARD]">
    <div class="grid grid-cols-2 md:grid-cols-3 gap-10">
      <!-- 6 capability items with hover icons -->
    </div>
  </div>
</div>
```

---

### Composition 05: 3-Column Scrolling Testimonials + Masonry Cases

**Use for:** Social proof sections, testimonial walls, case study galleries

**Grid:** Two sections — scrolling `grid-cols-3` + masonry `grid-cols-3`

**Layout:**
```
Part A — Scrolling Testimonials:
┌────────┐ ┌────────┐ ┌────────┐
│   ↑    │ │   ↓    │ │   ↑    │  ← 3 columns scrolling at different speeds
│ Cards  │ │ Cards  │ │ Cards  │     with CSS mask fade at top/bottom
│   ↑    │ │   ↓    │ │   ↑    │
└────────┘ └────────┘ └────────┘

Part B — Masonry Case Studies:
┌────────┐ ┌────────┐ ┌────────┐
│ h-56   │ │ h-64   │ │ h-72   │  ← Varying heights create masonry effect
├────────┤ ├────────┤ ├────────┤
│ h-72   │ │ h-56   │ │ h-48   │
└────────┘ └────────┘ └────────┘
```

**Key details:**
- Testimonial container: `h-[500px] overflow-hidden relative` with CSS mask gradient for fade
- CSS mask: `mask-image: linear-gradient(180deg, transparent, black 10%, black 90%, transparent)`
- Columns scroll via JS with `data-speed` and `data-direction` attributes (25/20/30s, up/down/up)
- Testimonial cards: `[MODE-SURFACE-1] border [MODE-BORDER] p-6 rounded-none`
- Avatar: `w-8 h-8 rounded-full bg-gradient-to-br from-[color]-500 to-[color]-800` (each person gets unique gradient)
- Masonry grid: `grid grid-cols-1 md:grid-cols-3 gap-6` with flexbox columns inside
- Case study cards: Varying heights (h-48, h-56, h-64, h-72) with gradient overlay + bottom info strip

**Testimonial card template:**
```html
<div class="bento-card [MODE-SURFACE-1] border [MODE-BORDER] p-6 rounded-none">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#ef233c] to-red-800 flex items-center justify-center text-white text-xs font-bold">AB</div>
    <div>
      <p class="[MODE-TEXT-PRIMARY] text-sm font-medium">Name</p>
      <p class="[MODE-TEXT-MUTED] text-xs">Title</p>
    </div>
  </div>
  <p class="[MODE-TEXT-SECONDARY] text-sm leading-relaxed">"Quote text with impact."</p>
</div>
```

**Case study card template:**
```html
<div class="bento-card group overflow-hidden border [MODE-BORDER] relative h-56 bg-gradient-to-br [MODE-SURFACE-1] to-[MODE-SURFACE-CARD]">
  <div class="bento-glow"></div>
  <div class="absolute inset-0 bg-gradient-to-t from-[MODE-BG]/80 to-transparent z-10"></div>
  <div class="absolute bottom-0 left-0 right-0 p-5 z-20">
    <p class="text-xs [MODE-TEXT-MUTED] font-mono uppercase tracking-wider">Industry • Type</p>
    <div class="mt-1 flex items-center justify-between">
      <h4 class="text-base tracking-tight font-medium [MODE-TEXT-PRIMARY] font-manrope">Result Metric</h4>
      <span class="inline-flex h-8 w-8 items-center justify-center [MODE-SURFACE-CARD] [MODE-TEXT-PRIMARY]">→</span>
    </div>
  </div>
</div>
```

---

## Hover Glow System (Applies to ALL compositions)

Every `.bento-card` tracks mouse position and applies a red radial glow on hover:

Corner marks use `::before` and `::after` on `.bento-card`, so hover glow uses a dedicated child element:

```css
.bento-card { position: relative; transition: all 0.5s ease; }
.bento-glow {
  position: absolute; inset: 0; opacity: 0; transition: opacity 0.5s;
  background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(239,35,60, var(--glow-opacity, 0.06)), transparent 40%);
  pointer-events: none; z-index: 1;
}
.bento-card:hover .bento-glow { opacity: 1; }
.bento-card:hover { border-color: rgba(239,35,60,0.3) !important; }
```

Every `.bento-card` must include `<div class="bento-glow"></div>` as a direct child.

**Mode-specific glow opacity:**
- Dark Ops: `--glow-opacity: 0.06`
- Light Ops: `--glow-opacity: 0.04`

**JavaScript for mouse tracking:**
```javascript
document.querySelectorAll('.bento-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    card.style.setProperty('--mouse-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
  });
});
```

## Gradient Border Pseudo-Element (For nav and special cards)

```css
[style*="--border-gradient"]::before {
  content: ""; position: absolute; inset: 0; padding: 1px;
  border-radius: var(--border-radius-before, inherit);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  background: var(--border-gradient); pointer-events: none;
}
```

Usage: `style="--border-gradient: linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0), rgba(255,255,255,0.2)); --border-radius-before: 0"`

</reference>
