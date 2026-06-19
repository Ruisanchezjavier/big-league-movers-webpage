import { useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollImageSequence from './ScrollImageSequence';

gsap.registerPlugin(ScrollTrigger);

// Shared scroll state (avoids closure staleness in rAF)
const scrollState  = { y: 0 };
let   lenisInstance = null;

const TOTAL_PAGES    = 5;
const ANIMATED_PAGES = 4;

// Page scroll
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;


// ─── Static data ──────────────────────────────────────────────────────────────
const services = [
  { emoji: '🏠', title: 'Residential',   description: 'Apartments, condos, and single-family homes moved with care.' },
  { emoji: '🏢', title: 'Commercial',    description: 'Office moves handled efficiently with zero downtime.'          },
  { emoji: '📦', title: 'Packing',       description: 'Full packing service with premium materials included.'         },
  { emoji: '🚚', title: 'Long Distance', description: 'State-to-state moves across the Southeast US.'               },
];
const steps = [
  { number: '01', title: 'BOOK',      description: 'Call or text us for a free quote and fast arrival.' },
  { number: '02', title: 'WE PACK',   description: 'Our crew handles everything with premium care.'     },
  { number: '03', title: 'YOU RELAX', description: 'We deliver on time, every time in Miami.'           },
];

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const seqRef       = useRef(null);
  const snapRef      = useRef(null);
  const imagesRef    = useRef([]);
  const titleRef     = useRef(null); // fixed animated title
  const heroTitleRef = useRef(null); // invisible placeholder — used for position measurement

  const [ready,        setReady]        = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [activePage,   setActivePage]   = useState(0);

  // ── Frame paths ───────────────────────────────────────────────────────────
  const frameGroups = useMemo(() => [
    {
      folder: 'pov',
      frames: [
        2, 3, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25,
        26, 28, 29, 30, 32, 33, 34, 35, 37, 38, 39, 40, 42, 44, 45, 46, 47, 48, 49,
        50, 51, 52, 53, 54, 56, 57, 58, 59, 60, 64, 65, 66, 67, 68, 70, 71, 75, 78,
        79, 80, 81, 83, 84, 88, 89, 90, 92, 93, 94, 98, 99, 101, 102, 105, 106, 107,
        108, 110, 111, 112, 113, 116, 117, 120,
      ],
    },
    {
      folder: 'transicion',
      frames: [
        2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 18, 20, 21, 24, 25, 26, 27, 28, 29, 30,
        32, 33, 35, 41, 42, 43, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
        58, 60, 62, 65, 66, 67, 69, 70, 71, 74, 75, 76, 78, 80, 81, 83, 86, 87, 88,
        89, 91, 92, 95, 96, 97, 98, 99, 101, 103, 104, 105, 107, 108, 109, 112, 113,
        114, 115, 116, 117, 118, 119, 120,
      ],
    },
    {
      folder: 'drone',
      frames: [
        2, 3, 5, 6, 8, 9, 10, 11, 13, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27,
        29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48,
        49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 64, 68, 69, 71, 72, 74, 75,
        79, 80, 81, 82, 85, 87, 88, 89, 90, 92, 93, 97, 99, 100, 103, 104, 105, 107,
        108, 110, 112, 113, 114, 117, 118, 120,
      ],
    },
  ], []);

  const framePaths = useMemo(
    () => frameGroups.flatMap(({ folder, frames }) =>
      frames.map((n) => `/frames/${folder}/frame_${String(n).padStart(3, '0')}.jpg`)
    ),
    [frameGroups],
  );

  const FRAMES_TOTAL = framePaths.length;

  // ── Lock body scroll while loading ────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = ready ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [ready]);

  // ── Preloader ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!framePaths.length) return;
    const images  = new Array(FRAMES_TOTAL);
    let   settled = 0;

    const onSettled = () => {
      settled++;
      setLoadProgress(Math.round((settled / FRAMES_TOTAL) * 100));
      if (settled === FRAMES_TOTAL) {
        imagesRef.current = images;
        setReady(true);
      }
    };

    framePaths.forEach((path, i) => {
      const img    = new Image();
      img.decoding = 'async';
      img.src      = path;
      img.onload   = onSettled;
      img.onerror  = onSettled;
      images[i]    = img;
    });

    return () => {
      images.forEach((img) => { if (img) { img.onload = null; img.onerror = null; } });
    };
  }, [FRAMES_TOTAL, framePaths]);


  // ── Lenis + full-page snap ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    const lenis = new Lenis({
      duration:           1.2,
      easing:             easeInOutCubic,
      orientation:        'vertical',
      gestureOrientation: 'vertical',
      smoothWheel:        true,
      smoothTouch:        false,
    });
    lenisInstance = lenis;

    lenis.on('scroll', ({ scroll }) => { scrollState.y = scroll; });
    const lenisRaf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ScrollTrigger.update);

    let currentPage  = 0;
    let lastSnapTime = 0;
    // 350ms cooldown — fast enough to feel responsive, long enough to prevent double-snap.
    const COOLDOWN = 350;

    const snapToPage = (page) => {
      const now = performance.now();
      if (now - lastSnapTime < COOLDOWN) return;
      page = Math.max(0, Math.min(TOTAL_PAGES - 1, page));
      if (page === currentPage) return;

      lastSnapTime = now;
      currentPage  = page;
      setActivePage(page);

      const toProgress = Math.min(page, ANIMATED_PAGES - 1) / (ANIMATED_PAGES - 1);
      seqRef.current?.animateTo(toProgress);

      // ── Page scroll ──────────────────────────────────────────────────────
      // stop() cancels any in-progress scrollTo so the new one always fires.
      // No lock — allows clean interruption if user scrolls again quickly.
      const target = page * window.innerHeight;
      lenis.stop();
      lenis.start();
      lenis.scrollTo(target, {
        duration:   0.6,
        easing:     easeInOutCubic,
        onComplete: () => { lenis.scrollTo(target, { immediate: true }); },
      });
    };

    snapRef.current = snapToPage;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      snapToPage(currentPage + (e.deltaY > 0 ? 1 : -1));
    };

    let touchStartY = 0;
    const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const onTouchEnd   = (e) => {
      const delta = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(delta) > 30) snapToPage(currentPage + (delta > 0 ? 1 : -1));
    };

    window.addEventListener('wheel',      onWheel,      { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend',   onTouchEnd,   { passive: true });

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener('resize', onResize);

    return () => {
      lenisInstance   = null;
      snapRef.current = null;
      gsap.ticker.remove(lenisRaf);
      lenis.destroy();
      window.removeEventListener('wheel',      onWheel,      { capture: true });
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('resize',     onResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [ready]);

  // ── Title fly effect ──────────────────────────────────────────────────────
  // Cache the hero rect ONCE at ready (scrollY = 0) — reused for return animation.
  // Never re-read getBoundingClientRect() when page > 0 because the hero section
  // is above the viewport and rect.top would be negative (off-screen).
  const heroRectRef = useRef(null);

  useEffect(() => {
    if (!ready || !titleRef.current || !heroTitleRef.current) return;
    const rect     = heroTitleRef.current.getBoundingClientRect();
    const fontSize = window.getComputedStyle(heroTitleRef.current).fontSize;
    heroRectRef.current = { top: rect.top, left: rect.left, width: rect.width, fontSize };
    gsap.set(titleRef.current, { top: rect.top, left: rect.left, width: rect.width, fontSize });
  }, [ready]);

  useEffect(() => {
    if (!ready || !titleRef.current || !heroRectRef.current) return;

    if (activePage === 0) {
      const { top, left, width, fontSize } = heroRectRef.current;
      gsap.to(titleRef.current, {
        top, left, width, fontSize,
        letterSpacing: '0em',
        scale:    1,
        opacity:  1,
        duration: 0.85,
        ease:     'expo.inOut',
      });
    } else {
      gsap.to(titleRef.current, {
        top:           20,
        left:          20,
        width:         'auto',
        fontSize:      22,
        letterSpacing: '0.04em',
        scale:         1,
        opacity:       0.92,
        duration:      0.85,
        ease:          'expo.inOut',
      });
    }
  }, [activePage, ready]);

  return (
    <div className="relative w-full overflow-x-hidden text-white">

      {/* Canvas — ScrollImageSequence in controlled mode (App drives via animateTo) */}
      {ready && (
        <div className="fixed inset-0 z-0">
          <ScrollImageSequence
            ref={seqRef}
            frames={imagesRef.current}
            frameHeight={80}
            lerpFactor={0.17}
            mobileZoom={0.82}
            controlled
          />
        </div>
      )}

      {/* Radial vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)' }}
      />

      {/* Preloader */}
      {!ready && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070707]">
          <p className="mb-4 font-display text-3xl tracking-widest text-accent">BIG LEAGUE MOVERS</p>
          <p className="text-sm text-accent/70">Loading experience… {loadProgress}%</p>
          <div className="mt-6 w-64 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-[3px] rounded-full bg-accent transition-all duration-200"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      )}



      {/* Animated title — z-15 so hero label/subtitle (z-20) render on top of it */}
      {ready && (
        <h1
          ref={titleRef}
          className="font-display uppercase text-white pointer-events-none select-none"
          style={{ position: 'fixed', zIndex: 15, lineHeight: 0.85 }}
        >
          BIG LEAGUE<br />MOVERS
        </h1>
      )}

      {/* ══ Page 0 · Intro ══════════════════════════════════════════════════ */}
      <section className="relative h-screen overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/60" />
        {/* z-20 — above the fixed title (z-15) so label & subtitle are never covered */}
        <div className="relative z-20 px-5 sm:px-6 text-center">
          <p className="mb-4 sm:mb-5 text-sm sm:text-base uppercase tracking-[0.45em] sm:tracking-[0.55em] text-accent">
            Premium Moving Services · Miami
          </p>
          {/* Invisible placeholder — preserves layout, measures position for GSAP */}
          <h1
            ref={heroTitleRef}
            aria-hidden="true"
            className="font-display text-[clamp(6rem,7vw,8.5rem)] uppercase leading-[0.85] invisible"
          >
            BIG LEAGUE<br />MOVERS
          </h1>
          <p className="mx-auto mt-20 sm:mt-14 max-w-xs sm:max-w-sm text-lg sm:text-xl text-white/55">
            Residential & Commercial Moving across Miami-Dade & Broward
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-8 sm:bottom-10 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/20">
            <span className="block animate-bounce text-sm sm:text-base text-white/50">↓</span>
          </div>
          <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.55em] sm:tracking-[0.65em] text-white/30">Scroll to explore</p>
        </div>
      </section>

{/* ══ Page 2 · Services ═══════════════════════════════════════════════ */}
      <section className="relative h-screen overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-5xl px-4 sm:px-6">
          <div className="mb-5 sm:mb-8 text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] sm:tracking-[0.5em] text-accent">What we move</p>
            <h2 className="mt-2 sm:mt-3 font-display text-[clamp(2rem,6vw,4.5rem)] uppercase">
              WHAT WE MOVE
            </h2>
          </div>
          {/* 2-col on mobile so all 4 cards fit in one screen */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {services.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl sm:rounded-[28px] border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm"
              >
                <div className="mb-3 sm:mb-4 w-fit rounded-xl sm:rounded-2xl border-l-4 border-accent bg-white/5 px-2 py-1 sm:px-3 sm:py-2 text-xl sm:text-2xl">
                  {s.emoji}
                </div>
                <h3 className="font-display text-base sm:text-xl uppercase">{s.title}</h3>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-white/60 line-clamp-2 sm:line-clamp-none">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Page 3 · How It Works ═══════════════════════════════════════════ */}
      <section className="relative h-screen overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full max-w-5xl px-4 sm:px-6">
          <div className="mb-5 sm:mb-8 text-center">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] sm:tracking-[0.5em] text-accent">How it works</p>
            <h2 className="mt-2 sm:mt-3 font-display text-[clamp(1.6rem,5vw,4rem)] uppercase">
              3 STEPS TO YOUR NEW HOME
            </h2>
          </div>
          <div className="grid gap-3 sm:gap-5 md:grid-cols-3">
            {steps.map((step) => (
              /* Mobile: horizontal row (number left, text right). Desktop: vertical card */
              <div
                key={step.title}
                className="flex items-start gap-4 md:block rounded-2xl sm:rounded-[28px] border border-white/10 bg-white/5 p-4 sm:p-8 backdrop-blur-sm"
              >
                <div className="font-display text-3xl sm:text-4xl text-accent shrink-0 leading-none mt-0.5 md:mb-5">{step.number}</div>
                <div>
                  <h3 className="font-display text-lg sm:text-2xl uppercase">{step.title}</h3>
                  <p className="mt-1 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-6 text-white/60">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Page 4 · Reviews ════════════════════════════════════════════════ */}
      <section className="relative h-screen overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.45em] text-accent">
            What our clients say
          </p>
          <div className="mt-4 sm:mt-5 text-[clamp(2.5rem,8vw,5rem)] leading-none">
            ⭐⭐⭐⭐⭐
          </div>
          <h2 className="mt-4 sm:mt-5 font-display text-[clamp(2.8rem,11vw,7rem)] uppercase leading-none">
            5.0 ON GOOGLE
          </h2>
          <p className="mt-4 sm:mt-5 max-w-xs sm:max-w-sm text-sm sm:text-base text-white/55">
            Hundreds of happy families and businesses across Miami-Dade & Broward trust us with their move.
          </p>
          <a
            href="https://share.google/KydgcPhojz109hxJf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 sm:mt-10 inline-flex items-center gap-3 rounded-full border border-accent/40 bg-white/5 px-8 py-4 text-sm font-semibold uppercase tracking-widest text-accent backdrop-blur-sm transition hover:bg-accent hover:text-black hover:border-accent hover:shadow-[0_0_30px_rgba(0,212,200,0.35)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.288 14.44l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.528.146z"/>
            </svg>
            Ver reseñas en Google
          </a>
        </div>
      </section>

      {/* ══ Page 5 · Contact — solid bg covers canvas ═══════════════════════ */}
      <section className="relative h-screen overflow-hidden flex items-center justify-center bg-[#060606]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,200,0.18),transparent_40%)]" />
        <div className="relative z-10 mx-auto max-w-4xl px-5 sm:px-6 text-center">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.4em] sm:tracking-[0.5em] text-accent">Ready for the move?</p>
          <img
            src="/logo.png"
            alt="Big League Movers"
            className="mt-3 sm:mt-4 mx-auto w-[clamp(10rem,36vw,22rem)] [mix-blend-mode:screen]"
          />
          <p className="mx-auto mt-4 sm:mt-5 max-w-xs sm:max-w-xl text-sm sm:text-base text-white/60">
            Serving Miami-Dade & Broward County with premium moving services.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row">
            <a
              href="tel:+13057658852"
              className="w-full sm:w-auto rounded-full bg-accent px-10 py-4 text-sm font-semibold uppercase text-black transition hover:shadow-[0_0_30px_rgba(0,212,200,0.4)]"
            >
              CALL NOW
            </a>
            <a
              href="https://wa.me/17862661493"
              className="w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-10 py-4 text-sm font-semibold uppercase text-white transition hover:border-accent hover:text-accent"
            >
              WHATSAPP US
            </a>
          </div>
          <p className="mt-8 sm:mt-14 text-[10px] sm:text-xs uppercase tracking-[0.35em] sm:tracking-[0.4em] text-white/25">
            © 2025 Big League Movers LLC. All rights reserved.
          </p>
        </div>
      </section>

    </div>
  );
}

export default App;
