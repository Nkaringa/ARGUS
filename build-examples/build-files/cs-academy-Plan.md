# Plan — CS Academy: Interactive System Design & Data Structures Learning Platform

## Goal
Build a single-page web application that teaches **System Design** and **Data Structures** fundamentals through rich, animated, interactive lessons. Each topic combines a clear written explanation with a hand-crafted visual animation — e.g. nodes sliding into a linked list, requests bouncing between a load balancer and servers, a hash bucket filling up. The app is content-first (not a course shell) and prioritizes smooth, high-end motion design to make abstract concepts feel tangible. Target audience: CS students and junior-to-mid engineers preparing for technical interviews.

## Architecture

**Stack:**
- **Vite 5 + React 18 + TypeScript** — fast dev loop, strict typing for topic/lesson data models, ecosystem maturity for the animation libs below. Preferred over Next.js because the app is fully client-side (no SSR/auth/data layer needed) and we want minimal framework overhead.
- **Tailwind CSS 3** + **CSS variables for theme tokens** — rapid styling without leaving markup; CSS vars enable a dark/light toggle without re-compiling utilities.
- **Framer Motion 11** — the primary animation engine: layout animations, shared element transitions, `AnimatePresence` for enter/exit, spring physics for natural motion. Used for every interactive diagram.
- **Lenis** (smooth scroll) + **Framer Motion's `useScroll`** — scroll-linked hero and section reveals.
- **React Router 6** — topic routing (`/data-structures/linked-list`, `/system-design/load-balancing`, etc.).
- **Lucide React** — consistent icon set.
- **clsx + tailwind-merge** — conditional class composition.

No backend. No database. All lesson content lives as typed TS modules so it's refactor-safe and the build stays fully static (deployable to any CDN).

**Directory Structure:**
```
cs-academy/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── index.css              # Tailwind directives + CSS vars (theme tokens)
│   ├── types.ts               # Topic, Lesson, Category types
│   ├── content/
│   │   ├── index.ts           # aggregates and exports all topics
│   │   ├── data-structures/
│   │   │   ├── array.ts
│   │   │   ├── linked-list.ts
│   │   │   ├── stack.ts
│   │   │   ├── queue.ts
│   │   │   ├── hash-table.ts
│   │   │   ├── binary-tree.ts
│   │   │   └── graph.ts
│   │   └── system-design/
│   │       ├── load-balancing.ts
│   │       ├── caching.ts
│   │       ├── database-sharding.ts
│   │       ├── cap-theorem.ts
│   │       ├── message-queues.ts
│   │       └── cdn.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx     # topic nav on lesson pages
│   │   │   └── Footer.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── home/
│   │   │   ├── Hero.tsx         # animated headline + floating nodes background
│   │   │   ├── CategoryGrid.tsx
│   │   │   └── FeaturedTopics.tsx
│   │   ├── lesson/
│   │   │   ├── LessonLayout.tsx # shared page chrome: title, meta, prev/next
│   │   │   ├── Section.tsx      # scroll-reveal wrapper
│   │   │   └── Complexity.tsx   # Big-O table
│   │   └── animations/          # one file per interactive visualizer
│   │       ├── ArrayAnim.tsx
│   │       ├── LinkedListAnim.tsx
│   │       ├── StackAnim.tsx
│   │       ├── QueueAnim.tsx
│   │       ├── HashTableAnim.tsx
│   │       ├── BinaryTreeAnim.tsx
│   │       ├── GraphAnim.tsx
│   │       ├── LoadBalancerAnim.tsx
│   │       ├── CacheAnim.tsx
│   │       ├── ShardingAnim.tsx
│   │       ├── CapTheoremAnim.tsx
│   │       ├── MessageQueueAnim.tsx
│   │       └── CdnAnim.tsx
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── CategoryPage.tsx     # lists topics in a category
│   │   ├── LessonPage.tsx       # renders a lesson by slug
│   │   └── NotFoundPage.tsx
│   ├── hooks/
│   │   ├── useTheme.ts
│   │   ├── useReducedMotion.ts  # honors prefers-reduced-motion
│   │   └── useLessonBySlug.ts
│   └── lib/
│       ├── cn.ts                # clsx + tailwind-merge helper
│       └── motion.ts            # shared easings, variants, spring presets
```

**Cross-Cutting Concerns:**
- **Theme tokens (CSS vars in `index.css`):** `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent` (indigo 500/400 pair), `--accent-2` (cyan), `--success`, `--warn`, `--danger`. Dark mode flips these at `:root[data-theme="dark"]`. Tailwind reads them via `theme.extend.colors`.
- **Motion presets (`lib/motion.ts`):** export named easings (`EASE_OUT_EXPO`, `EASE_SPRING_SOFT`), reusable `fadeUp`, `fadeIn`, `scaleIn` variants, and a `staggerChildren` helper. Every animation component imports from here so timing feels cohesive.
- **Lesson data shape (`types.ts`):**
  ```ts
  type Lesson = {
    slug: string;
    title: string;
    category: 'data-structures' | 'system-design';
    tagline: string;          // one-sentence hook
    readingMinutes: number;
    sections: LessonSection[]; // rich prose blocks
    complexity?: ComplexityTable; // for data structures
    animationKey: string;     // maps to a component in animations/
    relatedSlugs: string[];
  };
  ```
  Each lesson module exports a typed `Lesson` object; `content/index.ts` assembles them into a single registry. `LessonPage` looks up by slug and renders.
- **Animation contract:** every `*Anim.tsx` component is self-contained, responsive (fills its container, min-height ~360px), respects `prefers-reduced-motion` (shows a static labeled diagram instead), and exposes interactive controls where it aids understanding (e.g. "Insert node", "Push request", "Evict cache"). No external canvas libraries — pure Framer Motion + SVG.
- **Naming:** PascalCase for components, kebab-case for file slugs and content ids, camelCase for variables. Animation components end in `Anim`. Lesson content files are named by topic slug.
- **Accessibility:** semantic landmarks (`<nav>`, `<main>`, `<article>`), visible focus rings on all interactives, aria-labels on icon-only buttons, color contrast AA minimum, reduced-motion fallbacks.

**Rejected Alternatives:**
- **Next.js** — SSR/RSC overhead is unjustified for a fully static content site; Vite ships faster and simpler.
- **GSAP** — powerful but heavier license/footprint; Framer Motion fits React idioms and covers every animation here.
- **MDX for lesson content** — considered, but typed TS modules give better refactor safety and let sections compose React components (animation slots) without MDX build plumbing.
- **D3** — great for data-heavy viz, overkill for hand-authored didactic diagrams where SVG + Framer Motion is more controllable and lighter.

## Files to Touch

**Project config**
- `cs-academy/package.json` — dependencies (react, react-dom, react-router-dom, framer-motion, tailwindcss, postcss, autoprefixer, lucide-react, clsx, tailwind-merge, @lenis/react or lenis, typescript, vite, @vitejs/plugin-react, @types/react, @types/react-dom) and scripts (`dev`, `build`, `preview`, `typecheck`).
- `cs-academy/index.html` — root HTML, font preloads (Inter + JetBrains Mono via Google Fonts), theme-flash prevention inline script.
- `cs-academy/vite.config.ts` — React plugin, path alias `@` → `src`.
- `cs-academy/tsconfig.json` — strict true, `@/*` path mapping.
- `cs-academy/tailwind.config.ts` — content globs, theme extension reading CSS vars, container defaults.
- `cs-academy/postcss.config.js` — tailwind + autoprefixer.

**Entry & routing**
- `cs-academy/src/main.tsx` — React root, router, theme init.
- `cs-academy/src/App.tsx` — global layout shell (Navbar + `<Outlet/>` + Footer).
- `cs-academy/src/router.tsx` — route table: `/`, `/data-structures`, `/system-design`, `/:category/:slug`, `*`.
- `cs-academy/src/index.css` — Tailwind layers, CSS variables for both themes, base typography, scrollbar styling, selection color.

**Types & helpers**
- `cs-academy/src/types.ts` — `Lesson`, `LessonSection`, `ComplexityTable`, `Category` types.
- `cs-academy/src/lib/cn.ts` — `cn()` helper.
- `cs-academy/src/lib/motion.ts` — shared variants, easings, spring configs.
- `cs-academy/src/hooks/useTheme.ts` — theme state + `localStorage` persistence.
- `cs-academy/src/hooks/useReducedMotion.ts` — wraps Framer Motion's hook plus manual media query.
- `cs-academy/src/hooks/useLessonBySlug.ts` — lookup from content registry.

**Content**
- `cs-academy/src/content/index.ts` — aggregates all lessons into a `lessons` array and `byCategory` map.
- `cs-academy/src/content/data-structures/{array,linked-list,stack,queue,hash-table,binary-tree,graph}.ts` — 7 lessons. Each has a clear "What it is", "How it works", "When to use", "Trade-offs" section plus a Big-O complexity table.
- `cs-academy/src/content/system-design/{load-balancing,caching,database-sharding,cap-theorem,message-queues,cdn}.ts` — 6 lessons. Each has "The Problem", "The Solution", "How it works in practice", "Trade-offs & gotchas".

**Layout & UI primitives**
- `cs-academy/src/components/layout/Navbar.tsx` — logo, category links, theme toggle, mobile menu with animated drawer.
- `cs-academy/src/components/layout/Sidebar.tsx` — sticky topic list on lesson pages, highlights active.
- `cs-academy/src/components/layout/Footer.tsx` — minimal credits + links.
- `cs-academy/src/components/ui/{Button,Card,Badge,CodeBlock,ThemeToggle}.tsx` — shared primitives.

**Home**
- `cs-academy/src/components/home/Hero.tsx` — animated headline (word-by-word reveal), background of slowly drifting SVG nodes/edges that form a subtle graph, primary CTA buttons.
- `cs-academy/src/components/home/CategoryGrid.tsx` — two big cards (Data Structures / System Design) with hover tilt + gradient glow.
- `cs-academy/src/components/home/FeaturedTopics.tsx` — horizontally scrolling/animated list of 4-6 featured lessons.

**Lesson scaffolding**
- `cs-academy/src/components/lesson/LessonLayout.tsx` — title block, tagline, reading time, animation slot, content sections, related topics, prev/next.
- `cs-academy/src/components/lesson/Section.tsx` — scroll-triggered fade-up wrapper using `useInView`.
- `cs-academy/src/components/lesson/Complexity.tsx` — animated Big-O table (rows slide in).

**Animations** — one interactive visualizer per lesson (13 total):
- `cs-academy/src/components/animations/ArrayAnim.tsx` — indexed cells; buttons insert/remove at index, showing O(n) shift.
- `cs-academy/src/components/animations/LinkedListAnim.tsx` — nodes with pointer arrows; insert at head/tail re-routes arrows with spring.
- `cs-academy/src/components/animations/StackAnim.tsx` — push/pop with stack-frame physics.
- `cs-academy/src/components/animations/QueueAnim.tsx` — enqueue right, dequeue left, gliding tiles.
- `cs-academy/src/components/animations/HashTableAnim.tsx` — input a key, hash highlights, bucket fills; show collision chaining.
- `cs-academy/src/components/animations/BinaryTreeAnim.tsx` — insert values into a BST; nodes animate into position; DFS/BFS toggles animate traversal path.
- `cs-academy/src/components/animations/GraphAnim.tsx` — force-placed nodes; BFS/DFS from selected source, edges light up in order.
- `cs-academy/src/components/animations/LoadBalancerAnim.tsx` — client requests fan out through a load balancer to N servers; toggle round-robin vs. least-connections; server health failover demo.
- `cs-academy/src/components/animations/CacheAnim.tsx` — request hits cache (green) or misses → origin (red); LRU eviction visualized.
- `cs-academy/src/components/animations/ShardingAnim.tsx` — rows flow into shards by key-range / hash; rebalance animation.
- `cs-academy/src/components/animations/CapTheoremAnim.tsx` — triangle with CP / AP / CA; network partition event toggles which two properties hold.
- `cs-academy/src/components/animations/MessageQueueAnim.tsx` — producers → queue → consumers; backpressure + consumer-crash-then-retry demo.
- `cs-academy/src/components/animations/CdnAnim.tsx` — world map with edge nodes; request routes to nearest edge; cache warming visualization.

**Pages**
- `cs-academy/src/pages/HomePage.tsx` — Hero + CategoryGrid + FeaturedTopics.
- `cs-academy/src/pages/CategoryPage.tsx` — filtered lesson grid.
- `cs-academy/src/pages/LessonPage.tsx` — resolves slug → renders `LessonLayout` with the matching animation component chosen via `animationKey`.
- `cs-academy/src/pages/NotFoundPage.tsx` — playful 404 with animated broken link.

## Approach

1. **Scaffold the Vite + React + TS project** inside `cs-academy/` with all config files. Install deps. Confirm `npm run dev` boots and `npm run build` produces a clean dist.
2. **Wire the design system first.** Author `index.css` with CSS var tokens for light and dark themes, plus base typography (Inter for UI, JetBrains Mono for code). Configure Tailwind to consume the vars. Build `Button`, `Card`, `Badge`, `CodeBlock`, `ThemeToggle` primitives. Get the theme toggle working end-to-end — this establishes visual cohesion before content goes in.
3. **Define types and motion presets.** `types.ts`, `lib/motion.ts`, `lib/cn.ts`, `hooks/useTheme.ts`, `hooks/useReducedMotion.ts`. These underpin everything downstream.
4. **Build the layout shell.** `App.tsx`, `Navbar` (with animated mobile drawer + theme toggle), `Footer`, router with placeholder pages. Verify routing works.
5. **Author content.** Write all 13 lesson modules as typed `Lesson` objects. Prose should be tight: ~4-8 paragraphs per lesson, concrete examples, and for data structures, a complexity table. Each lesson declares its `animationKey`.
6. **Build home page.** Hero with word-reveal headline, drifting SVG-graph background (slow sinusoidal motion on nodes, edges with animated dasharray), two CategoryGrid cards with gradient glow on hover, FeaturedTopics row. Scroll-linked parallax on the hero background.
7. **Build lesson scaffolding.** `LessonLayout` with sticky `Sidebar` (on ≥lg), title hero, animation slot, `Section` scroll-reveals, `Complexity` table, related topics, prev/next nav. `CategoryPage` for lesson indexes.
8. **Build the 13 animations.** Tackle in this order so complexity grows:
   - Array → Stack → Queue → LinkedList (linear, simple springs).
   - HashTable (hashing + chaining).
   - BinaryTree → Graph (recursive layout, traversal choreography).
   - LoadBalancer → Cache → MessageQueue (request flows with moving tokens along paths).
   - Sharding → CDN (map / partition visualizations).
   - CapTheorem (conceptual triangle + partition state machine).
   Each uses SVG + Framer Motion's `layout` and `AnimatePresence`. All include at least one user control (button/slider) to drive state. All gracefully degrade under `prefers-reduced-motion` to a static annotated diagram.
9. **Polish & interactions.** Page transitions between routes (fade + slight y-shift via `AnimatePresence`). Subtle hover/focus micro-interactions on every card and button. Smooth scroll via Lenis. Back-to-top button that appears after scroll.
10. **Accessibility + responsive pass.** Keyboard nav through every interactive, focus traps for mobile menu, aria-labels, alt text. Test at 360px, 768px, 1024px, 1440px. Animations must remain legible on mobile (scale down SVG viewBox, not content).
11. **Final polish.** Favicon, page titles per route, meta description, `<noscript>` notice. `npm run build` + `npm run preview` smoke test.

## Gotchas

- **Framer Motion layout animations need stable `layoutId` or `key` props.** For list-based animations (stack, queue, linked list), every node needs a stable id across state updates or the animation flickers.
- **SVG + `layout` animations.** Framer Motion's `layout` prop works best on HTML. For SVG, prefer animating `cx`, `cy`, `x`, `y` with `motion.circle` / `motion.g` and springs — don't mix `layout` into SVG.
- **`prefers-reduced-motion` is a hard requirement.** Any component that auto-animates on mount must check it and short-circuit to a static version. Don't just reduce duration — skip motion entirely for users who've opted out.
- **Theme flash on load.** Add an inline script in `index.html` that reads `localStorage` and sets `data-theme` on `<html>` *before* React hydrates, or the page will flash light-then-dark.
- **Content registry circular imports.** Keep `types.ts` dependency-free; lesson files import from `types.ts` only; `content/index.ts` imports from lesson files. Don't let lesson files import each other.
- **Animation components are heavy.** Dynamically import them in `LessonPage` with `React.lazy` + `Suspense` so the home page bundle stays lean.
- **Mobile sidebar layout.** `Sidebar` is sticky + visible on `lg:` only. On mobile, replace with a top-of-page collapsible topic picker so lessons aren't crowded.
- **Route transitions + scroll restoration.** React Router 6 does not auto-scroll on navigation. Add a `ScrollToTop` component that resets scroll on pathname change, coordinated with the fade transition so content doesn't jump.
- **Lenis + anchor links.** Lenis hijacks scroll; in-page anchors must be driven via Lenis's API, not native `scrollIntoView`.
- **Dynamic Tailwind classes.** Don't build class strings at runtime (`bg-${color}-500`) — Tailwind's JIT won't pick them up. Use full static class names or safelist.
- **Don't ship placeholder lesson text.** All 13 lessons must be real, accurate prose — this is the product. Short and correct beats long and vague.

## Acceptance Criteria

- `npm install && npm run build` in `cs-academy/` completes with zero errors and zero type errors (`tsc --noEmit` clean).
- `npm run dev` serves the app; `/` renders the Home page with Hero, CategoryGrid (two cards), and FeaturedTopics without console errors.
- Navbar shows links to both category pages and a working theme toggle; toggling flips CSS vars, persists across reloads via `localStorage`, and does not cause a flash on initial load.
- The app contains **at least 13 lessons total**: ≥7 Data Structures (array, linked-list, stack, queue, hash-table, binary-tree, graph) and ≥6 System Design (load-balancing, caching, database-sharding, cap-theorem, message-queues, cdn). Each is reachable via its category page and by direct URL `/:category/:slug`.
- Every lesson page renders: title, tagline, reading time, a working interactive animation component, at least 3 prose sections, related-topics links, and prev/next navigation.
- Every Data Structures lesson renders a Big-O complexity table with at least the operations: access/search, insert, delete, space.
- Each of the 13 animation components is interactive — exposes at least one user control (button/slider/toggle) that changes visible state with animated transitions.
- When the OS `prefers-reduced-motion: reduce` is set, all animation components render a labeled static diagram (no auto-motion, no large transform animations) and decorative background motion is disabled.
- The app is responsive: layout is usable and readable at 360px, 768px, and 1280px viewport widths with no horizontal overflow and no overlapping text.
- All interactive elements (buttons, links, toggles, animation controls) are keyboard-focusable with a visible focus indicator and have accessible names (either visible text or `aria-label`).
- Routing: unknown paths render the 404 page; navigating between routes scrolls to the top of the new page.
- Animation components are code-split — the Home page's JS bundle does not import the 13 animation modules at initial load (verifiable in the build output).
- Visual design uses a consistent theme token system: no hard-coded hex colors outside `index.css`; Tailwind classes reference the configured theme.
- No ESLint/TS warnings about unused imports, unused vars, or `any` types in the final build.

**Plan Status:** READY
