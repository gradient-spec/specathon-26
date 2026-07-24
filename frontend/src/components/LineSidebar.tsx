import React, { memo, useState, useRef, useCallback } from "react";
import "./LineSidebar.css";

export type LineSidebarProps = {
  items: string[];
  accentColor?: string;
  textColor?: string;
  markerColor?: string;
  showIndex?: boolean;
  showMarker?: boolean;
  proximityRadius?: number;
  maxShift?: number;
  falloff?: "smooth" | "linear";
  markerLength?: number;
  markerGap?: number;
  tickScale?: number;
  scaleTick?: boolean;
  itemGap?: number;
  fontSize?: number;
  smoothing?: number;
  defaultActive?: number;
  activeItem?: number;
  onItemClick?: (index: number) => void;
  onItemHover?: (index: number) => void;
};

export default function LineSidebar({
  items,
  accentColor = "#4ACBEB",
  textColor = "#c4c4c4",
  markerColor = "#186275",
  showIndex = true,
  showMarker = true,
  proximityRadius = 120,
  maxShift = 24,
  falloff = "smooth",
  markerLength = 50,
  markerGap = 4,
  tickScale = 0.4,
  scaleTick = true,
  itemGap = 16,
  fontSize = 1.25,
  smoothing = 120,
  defaultActive = 0,
  activeItem,
  onItemClick,
  onItemHover,
}: LineSidebarProps) {
  const [internalActive, setInternalActive] = useState(defaultActive);
  const mouseYRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Controlled externally or via internal state
  const current = activeItem !== undefined ? activeItem : internalActive;

  // Throttle mousemove via rAF so we do at most one re-render per frame
  // instead of one per mouse-pixel. getBoundingClientRect is deferred to
  // each LineSidebarItem's render, so this is the only forced layout source.
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseYRef.current = e.clientY;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      forceUpdate((n) => n + 1);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseYRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    forceUpdate((n) => n + 1);
  }, []);

  return (
    <div
      className="linesidebar"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ gap: itemGap }}
    >
      {items.map((item, i) => (
        <LineSidebarItem
          key={i}
          index={i}
          label={item}
          isActive={i === current}
          accentColor={accentColor}
          textColor={textColor}
          markerColor={markerColor}
          showIndex={showIndex}
          showMarker={showMarker}
          markerLength={markerLength}
          markerGap={markerGap}
          maxShift={maxShift}
          tickScale={tickScale}
          scaleTick={scaleTick}
          fontSize={fontSize}
          smoothing={smoothing}
          mouseY={mouseYRef.current}
          proximityRadius={proximityRadius}
          falloff={falloff}
          onClick={() => {
            if (activeItem === undefined) setInternalActive(i);
            onItemClick?.(i);
          }}
          onHover={() => {
            if (activeItem === undefined) setInternalActive(i);
            onItemHover?.(i);
          }}
        />
      ))}
    </div>
  );
}

type ItemProps = {
  index: number;
  label: string;
  isActive: boolean;
  accentColor: string;
  textColor: string;
  markerColor: string;
  showIndex: boolean;
  showMarker: boolean;
  markerLength: number;
  markerGap: number;
  maxShift: number;
  tickScale: number;
  scaleTick: boolean;
  fontSize: number;
  smoothing: number;
  mouseY: number | null;
  proximityRadius: number;
  falloff: "smooth" | "linear";
  onClick: () => void;
  onHover: () => void;
};

// memo prevents re-renders of items whose props haven't changed between rAF ticks
const LineSidebarItem = memo(function LineSidebarItem({
  index,
  label,
  isActive,
  accentColor,
  textColor,
  markerColor,
  showIndex,
  showMarker,
  markerLength,
  markerGap,
  maxShift,
  tickScale,
  scaleTick,
  fontSize,
  smoothing,
  mouseY,
  proximityRadius,
  falloff,
  onClick,
  onHover,
}: ItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  let proximity = 0;
  if (mouseY !== null && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(mouseY - mid);
    if (dist <= proximityRadius) {
      const t = 1 - dist / proximityRadius;
      proximity = falloff === "smooth" ? t * t * (3 - 2 * t) : t;
    }
  }

  const shift = isActive ? maxShift : proximity * maxShift * 0.5;
  const markerScale = scaleTick ? (isActive ? 1 : tickScale + proximity * (1 - tickScale)) : 1;
  const textOpacity = isActive ? 1 : 0.45 + proximity * 0.4;
  const markerW = markerLength * markerScale;

  return (
    <div
      ref={ref}
      className="linesidebar__item"
      onClick={onClick}
      onMouseEnter={onHover}
    >
      {showMarker && (
        <div
          className="linesidebar__marker"
          style={{
            width: markerW,
            marginRight: markerGap,
            backgroundColor: isActive ? accentColor : markerColor,
            opacity: isActive ? 1 : 0.35 + proximity * 0.45,
            transition: `width ${smoothing}ms cubic-bezier(0.22,1,0.36,1), background-color ${smoothing}ms, opacity ${smoothing}ms`,
          }}
        />
      )}
      <div
        className="linesidebar__content"
        style={{
          transform: `translateX(${shift}px)`,
          transition: `transform ${smoothing}ms cubic-bezier(0.22,1,0.36,1), opacity ${smoothing}ms`,
          opacity: textOpacity,
        }}
      >
        {showIndex && (
          <span
            className="linesidebar__index"
            style={{
              color: isActive ? accentColor : "rgba(255,255,255,0.35)",
              fontSize: `${fontSize * 0.72}rem`,
            }}
          >
            /{String(index + 1).padStart(2, "0")}
          </span>
        )}
        <span
          className="linesidebar__label"
          style={{
            color: isActive ? accentColor : textColor,
            fontSize: `${fontSize}rem`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
});
