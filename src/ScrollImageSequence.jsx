import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

// Stop the rAF loop once render is this close to target (in virtual scroll-pixels).
const REST = 0.05;

// Normalize wheel deltaY across browsers and input modes.
const normalizeDelta = (e) => {
  if (e.deltaMode === 1) return e.deltaY * 40;
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
};

/**
 * Scroll-driven image sequence — professional edition.
 *
 * Props:
 *   frames      – array of preloaded HTMLImageElement objects
 *   frameHeight – virtual scroll-pixels per frame (default 80)
 *   lerpFactor  – how fast render chases target, frame-rate independent (default 0.075)
 *   mobileZoom  – scale multiplier on portrait screens (default 0.82, pulls camera back)
 *   controlled  – if true, disables internal wheel/touch input (App drives via ref)
 *   onProgress  – (progress: 0–1, frameIndex: number) => void
 *
 * Ref methods:
 *   seekTo(progress)    – jump instantly (no lerp)
 *   animateTo(progress) – lerp smoothly to position; starts from current render pos
 */
const ScrollImageSequence = forwardRef(function ScrollImageSequence(
  {
    frames      = [],
    frameHeight = 80,
    lerpFactor  = 0.075,
    mobileZoom  = 0.82,
    controlled  = false,
    onProgress,
  },
  ref,
) {
  const containerRef  = useRef(null);
  const canvasRef     = useRef(null);
  const ctxRef        = useRef(null);   // cached 2d context — never call getContext in a loop
  const targetRef     = useRef(0);      // where user / caller wants to scroll to
  const renderRef     = useRef(0);      // smoothed position the canvas draws from
  const rafRef        = useRef(null);
  const lastTimeRef   = useRef(0);
  const touchHistory  = useRef([]);
  const prevTouchY    = useRef(0);
  const currentIdxRef = useRef(0);

  const count     = frames.length;
  const maxScroll = Math.max(0, count - 1) * frameHeight;

  // ── Sub-frame cross-fade between adjacent frames ──────────────────────────
  const drawBlended = useCallback((scrollPos) => {
    const ctx    = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || !frames.length) return;

    const cw    = canvas.width;
    const ch    = canvas.height;
    const exact = Math.max(0, Math.min(count - 1, scrollPos / frameHeight));
    const idxA  = Math.floor(exact);
    const idxB  = Math.min(count - 1, idxA + 1);
    const blend = exact - idxA;

    // Fallback: walk backward for the last loaded frame if A isn't ready.
    let imgA = frames[idxA];
    if (!imgA?.complete || !imgA.naturalWidth) {
      for (let i = idxA - 1; i >= 0; i--) {
        if (frames[i]?.complete && frames[i].naturalWidth) { imgA = frames[i]; break; }
      }
    }

    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, cw, ch);
    if (!imgA?.complete || !imgA.naturalWidth) return;

    const portrait = ch > cw;
    const scaleFor = (img) => {
      const base = portrait
        ? Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * mobileZoom
        : Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      return base;
    };

    const sA = scaleFor(imgA);
    ctx.globalAlpha = 1;
    ctx.drawImage(imgA,
      (cw - imgA.naturalWidth  * sA) / 2,
      (ch - imgA.naturalHeight * sA) / 2,
      imgA.naturalWidth  * sA,
      imgA.naturalHeight * sA,
    );

    if (blend > 0) {
      const imgB = frames[idxB];
      if (imgB?.complete && imgB.naturalWidth) {
        const sB = scaleFor(imgB);
        ctx.globalAlpha = blend;
        ctx.drawImage(imgB,
          (cw - imgB.naturalWidth  * sB) / 2,
          (ch - imgB.naturalHeight * sB) / 2,
          imgB.naturalWidth  * sB,
          imgB.naturalHeight * sB,
        );
      }
    }
    ctx.globalAlpha = 1;

    const idx = Math.round(exact);
    if (idx !== currentIdxRef.current) {
      currentIdxRef.current = idx;
      onProgress?.(maxScroll > 0 ? Math.min(1, scrollPos / maxScroll) : 0, idx);
    }
  }, [frames, count, frameHeight, maxScroll, mobileZoom, onProgress]);

  // ── rAF loop: render lerps toward target, dt-normalized ──────────────────
  // dt normalization: identical feel at 60 / 90 / 120 / 144 Hz.
  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = 0;

    const loop = (now) => {
      const dt     = lastTimeRef.current
        ? Math.min((now - lastTimeRef.current) / (1000 / 60), 4)
        : 1;
      lastTimeRef.current = now;

      const factor = 1 - Math.pow(1 - lerpFactor, dt);
      renderRef.current  += (targetRef.current - renderRef.current) * factor;

      drawBlended(renderRef.current);

      if (Math.abs(targetRef.current - renderRef.current) > REST) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        renderRef.current   = targetRef.current;
        lastTimeRef.current = 0;
        drawBlended(renderRef.current);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [drawBlended, lerpFactor]);

  // ── Imperative API ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    // Jump instantly — no lerp.
    seekTo(progress) {
      const pos = Math.max(0, Math.min(maxScroll, progress * maxScroll));
      targetRef.current   = pos;
      renderRef.current   = pos;
      lastTimeRef.current = 0;
      cancelAnimationFrame(rafRef.current);
      drawBlended(pos);
    },
    // Animate smoothly — lerp from current render position to target.
    animateTo(progress) {
      targetRef.current = Math.max(0, Math.min(maxScroll, progress * maxScroll));
      startLoop();
    },
  }), [drawBlended, maxScroll, startLoop]);

  // ── Canvas sizing + context cache ─────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sync = () => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctxRef.current = ctx;
      drawBlended(renderRef.current);
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawBlended]);

  // ── Draw first frame when frames arrive ───────────────────────────────────
  useEffect(() => {
    if (frames.length > 0) drawBlended(0);
  }, [frames, drawBlended]);

  // ── Wheel (only when not controlled) ─────────────────────────────────────
  useEffect(() => {
    if (controlled) return;
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      targetRef.current = Math.max(0, Math.min(maxScroll, targetRef.current + normalizeDelta(e) * 0.4));
      startLoop();
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(rafRef.current);
    };
  }, [startLoop, maxScroll, controlled]);

  // ── Touch (only when not controlled) ─────────────────────────────────────
  useEffect(() => {
    if (controlled) return;
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e) => {
      prevTouchY.current   = e.touches[0].clientY;
      touchHistory.current = [];
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current  = 0;
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      const y     = e.touches[0].clientY;
      const delta = prevTouchY.current - y;
      prevTouchY.current = y;
      targetRef.current  = Math.max(0, Math.min(maxScroll, targetRef.current + delta));
      renderRef.current  = targetRef.current;
      drawBlended(renderRef.current);
      touchHistory.current.push({ y, t: performance.now() });
      if (touchHistory.current.length > 8) touchHistory.current.shift();
    };

    const onTouchEnd = () => {
      const history = touchHistory.current;
      const cutoff  = performance.now() - 80;
      const recent  = history.filter(h => h.t >= cutoff);
      if (recent.length >= 2) {
        const first  = recent[0];
        const last   = recent[recent.length - 1];
        const dt     = Math.max(1, last.t - first.t);
        const carry  = ((first.y - last.y) / dt) * (1000 / 60) * 5;
        targetRef.current = Math.max(0, Math.min(maxScroll, targetRef.current + carry));
        startLoop();
      }
      touchHistory.current = [];
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove',  onTouchMove,  { passive: false });
    container.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove',  onTouchMove);
      container.removeEventListener('touchend',   onTouchEnd);
    };
  }, [startLoop, maxScroll, drawBlended, controlled]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  );
});

export default ScrollImageSequence;
