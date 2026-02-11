# Design Components Extracted from Original Templates

## Animation Patterns Available
1. **fadeSlideIn** - blur + translateY reveal (already used)
2. **columnReveal** - clip-path column-by-column reveal (used sparingly)
3. **border-spin** - conic gradient spinning border on CTAs (shiny-cta)
4. **shimmer** - rotating gradient shimmer on buttons
5. **breathe** - pulsing scale animation
6. **Border Beam** - spinning conic-gradient border beam (from pricing/services)
7. **Infinite scroll marquee** - horizontal logo/tech scroll (from pricing)
8. **3D perspective marquee** - rotateX/Y/Z testimonial columns (already on index)
9. **Aurora background shifts** - translateX/Y with opacity (on lead magnet)

## Design Components from Original Templates NOT YET USED
1. **System Status Card** (from home.html) - live metrics with animated pulse dots, dashed borders, red corner accents
2. **Center Feature Card** (from home.html) - large image with overlay content, case study style
3. **Capabilities List Card** (from home.html) - numbered items with hover red glow
4. **Border Beam Buttons** (from services/pricing) - spinning conic-gradient border + glow layers
5. **Gradient Border Nav** (from all pages) - `--border-gradient` with pseudo-element mask
6. **Red Glow Hover Effects** - radial-gradient at bottom on hover
7. **Animated Badge** (from all pages) - pill with pulsing red dot
8. **Word-by-word opacity heading** (from all pages) - key words at opacity-100, rest at opacity-60
9. **Pricing comparison table** (from pricing) - hover row highlights
10. **Featured tag** - "Most Popular" red badge with glow shadow
11. **Background grid pattern** - subtle dot/line grid with mask
12. **Infinite scroll tech logos** - horizontal marquee with duplicated items

## Key Design Tokens
- Primary accent: #ef233c (red)
- Corner accents: 2-3px border-t/l, border-b/r in red
- Dashed borders: border-dashed border-zinc-800
- Hover state: border-[#ef233c]/50
- Glow: radial-gradient with rgba(239,35,60,0.05-0.2)
- Red blur orbs: bg-[#ef233c]/10 blur-[90px]
- Font stack: Manrope (headings), Inter (body), Geist Mono (labels)
- Mono labels: text-[10px] tracking-widest uppercase font-bold
