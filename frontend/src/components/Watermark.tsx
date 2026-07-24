export default function Watermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden translate-y-[27px]"
      // `contain: strict` prevents layout/style recalculation from leaking
      // in or out of this fixed layer, reducing repaint cost on scroll.
      style={{ contain: "strict" }}
    >
      {/* Translucent, softly blurred background logo mark */}
      <div
        className="relative w-[75vw] max-w-[750px] aspect-square opacity-[0.08] flex items-center justify-center pointer-events-none"
        // will-change:transform keeps this element on its own GPU compositor
        // layer so the blur filter is evaluated once and cached, not
        // re-evaluated on every scroll or sibling repaint.
        style={{ willChange: "transform" }}
      >
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background: "linear-gradient(135deg, #E5E4E2 0%, #D5D8DC 40%, #A6ACAF 75%, #71717A 100%)",
            maskImage: `url("/gradient white.webp")`,
            WebkitMaskImage: `url("/gradient white.webp")`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
            filter: "blur(10px)",
          }}
        />
      </div>
    </div>
  );
}
