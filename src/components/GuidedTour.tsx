import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, X } from "lucide-react";

export interface TourStep {
  tab: "studio" | "practice" | "photo-lab" | "lens-lab" | "presets" | "gallery" | "analysis" | "academy" | "settings";
  selector: string;
  title: string;
  description: string;
  action: string;
}

interface GuidedTourProps {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function GuidedTour({ step, index, total, onNext, onSkip }: GuidedTourProps) {
  const [target, setTarget] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cardSize, setCardSize] = useState({ width: 352, height: 230 });
  const cardRef = useRef<HTMLElement>(null);
  const onSkipRef = useRef(onSkip);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);

  useEffect(() => {
    let frame = 0;
    const locate = (ensureVisible = false) => {
      const element = document.querySelector<HTMLElement>(step.selector);
      if (!element) { setTarget(null); return; }
      if (ensureVisible) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-motion");
        element.scrollIntoView({ block: window.innerHeight < 860 ? "start" : "center", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const visible = rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        setTarget(visible ? rect : null);
      });
    };
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      locate(true);
    };
    const onScroll = () => locate(false);
    const timer = window.setTimeout(() => locate(true), 80);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", onScroll, true);
    const observer = typeof ResizeObserver !== "undefined" && cardRef.current
      ? new ResizeObserver(([entry]) => {
          if (entry) setCardSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        })
      : null;
    if (observer && cardRef.current) observer.observe(cardRef.current);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [step]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      const buttons = cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      buttons?.[buttons.length - 1]?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkipRef.current();
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusIsOutside = !cardRef.current.contains(document.activeElement);
      if (focusIsOutside) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [index]);

  const margin = 16;
  const tooltipWidth = Math.min(360, Math.max(260, viewport.width - margin * 2));
  const measuredHeight = Math.max(210, Math.min(cardSize.height + 32, viewport.height - margin * 2));
  const tooltipLeft = target
    ? clamp(target.left + target.width / 2 - tooltipWidth / 2, margin, Math.max(margin, viewport.width - tooltipWidth - margin))
    : clamp((viewport.width - tooltipWidth) / 2, margin, Math.max(margin, viewport.width - tooltipWidth - margin));
  const spaceBelow = target ? viewport.height - target.bottom - 22 - margin : viewport.height;
  const spaceAbove = target ? target.top - 22 - margin : viewport.height;
  const showBelow = !target || spaceBelow >= measuredHeight || spaceBelow >= spaceAbove;
  const proposedTop = target ? (showBelow ? target.bottom + 22 : target.top - measuredHeight - 22) : (viewport.height - measuredHeight) / 2;
  const tooltipTop = clamp(proposedTop, margin, Math.max(margin, viewport.height - measuredHeight - margin));
  const arrowTop = target ? (showBelow ? target.bottom + 1 : target.top - 28) : 0;
  const arrowLeft = target ? clamp(target.left + target.width / 2 - 10, 18, viewport.width - 38) : 0;
  const arrowVisible = Boolean(target && arrowTop >= margin && arrowTop + 24 <= viewport.height - margin);

  return (
    <div className="tour-layer" role="presentation">
      <div className="tour-dim" aria-hidden="true">
        {target ? <>
          <div className="tour-dim-panel" style={{ left: 0, top: 0, width: viewport.width, height: Math.max(0, target.top - 9) }} />
          <div className="tour-dim-panel" style={{ left: 0, top: target.top - 9, width: Math.max(0, target.left - 9), height: target.height + 18 }} />
          <div className="tour-dim-panel" style={{ left: target.right + 9, top: target.top - 9, width: Math.max(0, viewport.width - target.right - 9), height: target.height + 18 }} />
          <div className="tour-dim-panel" style={{ left: 0, top: target.bottom + 9, width: viewport.width, height: Math.max(0, viewport.height - target.bottom - 9) }} />
        </> : <div className="tour-dim-panel tour-dim-full" />}
      </div>
      {target && <>
        <div className="tour-spotlight" aria-hidden="true" style={{ left: target.left - 9, top: target.top - 9, width: target.width + 18, height: target.height + 18 }} />
        {arrowVisible && <div className={`tour-direction ${showBelow ? "down" : "up"}`} aria-hidden="true" style={{ left: arrowLeft, top: arrowTop }}><ArrowDown size={20}/></div>}
      </>}
      <section ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" style={{ left: tooltipLeft, top: tooltipTop, width: tooltipWidth, maxHeight: viewport.height - margin * 2 }}>
        <div className="tour-card-top"><span>FIRST-RUN VISUAL GUIDE · {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</span><button onClick={onSkip} aria-label="Close visual guide"><X size={16}/></button></div>
        <div className="tour-progress" aria-label={`Step ${index + 1} of ${total}`}><span style={{ width: `${((index + 1) / total) * 100}%` }}/></div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-description">{step.description}</p>
        <div className="tour-action-hint"><ArrowRight size={14}/>{step.action}</div>
        <div className="tour-card-bottom"><button className="tour-skip" onClick={onSkip}>SKIP GUIDE</button><button className="primary-button" onClick={onNext}>{index === total - 1 ? "FINISH GUIDE" : "NEXT"}{index === total - 1 ? <Check size={15}/> : <ArrowRight size={15}/>}</button></div>
      </section>
    </div>
  );
}
