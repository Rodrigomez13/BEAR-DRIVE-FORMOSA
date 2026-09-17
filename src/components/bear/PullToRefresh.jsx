import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, ChevronDown } from "lucide-react";

// Module-level cache for per-route scroll positions (#9 tab stack preservation)
const scrollPositions = new Map();

const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const containerRef = useRef(null);
  const location = useLocation();
  const routeKey = location.pathname;

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  // Restore scroll position on mount / route change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const saved = scrollPositions.get(routeKey) || 0;
    requestAnimationFrame(() => { el.scrollTop = saved; });
  }, [routeKey]);

  // Save scroll position continuously
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => scrollPositions.set(routeKey, el.scrollTop);
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [routeKey]);

  const handleTouchStart = (e) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const handleTouchMove = (e) => {
    if (!pulling.current || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) { pulling.current = false; setPullDistance(0); return; }
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling.current || refreshing) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try { await onRefresh(); } catch {}
      setRefreshing(false);
    }
    setPullDistance(0);
  };

  const indicatorHeight = refreshing ? THRESHOLD : pullDistance;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="h-full overflow-y-auto scrollbar-hide"
      style={{ overscrollBehavior: "none" }}
    >
      <div
        style={{
          transform: `translateY(${indicatorHeight}px)`,
          transition: pulling.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        <div
          className="flex items-end justify-center overflow-hidden"
          style={{ height: `${indicatorHeight}px` }}
        >
          {refreshing ? (
            <Loader2 className="w-6 h-6 mb-2 animate-spin text-accent" />
          ) : pullDistance > 0 ? (
            <ChevronDown className={`w-6 h-6 mb-2 text-muted-foreground transition-transform ${pullDistance >= THRESHOLD ? "rotate-180 text-accent" : ""}`} />
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}