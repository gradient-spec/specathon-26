import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Reveal from "./Reveal";

/* =======================================================
   COUNTDOWN DEADLINE
======================================================= */

const DEADLINE = new Date(
  "2026-09-11T23:59:59+05:30"
).getTime();


/* =======================================================
   COUNTDOWN HOOK
======================================================= */

function useDeadline() {
  const [t, setT] = useState(() =>
    Math.max(0, DEADLINE - Date.now())
  );

  useEffect(() => {
    const id = setInterval(() => {
      setT(Math.max(0, DEADLINE - Date.now()));
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return {
    days: Math.floor(t / 86_400_000),

    hours: Math.floor(
      (t % 86_400_000) / 3_600_000
    ),

    minutes: Math.floor(
      (t % 3_600_000) / 60_000
    ),

    seconds: Math.floor(
      (t % 60_000) / 1000
    ),
  };
}


/* =======================================================
   MAIN COUNTDOWN
======================================================= */

export default function SeatCountdown() {
  const {
    days,
    hours,
    minutes,
    seconds,
  } = useDeadline();

  return (
    <section className="relative pt-14 pb-8 md:pt-12 md:pb-6">

      <div
        className="
          mx-auto
          flex
          flex-col
          items-center
          px-4
          text-center
          md:px-10
        "
      >

        {/* =================================================
            DEADLINE LABEL
        ================================================= */}

<Reveal>
  <div
    className="
      mb-10
      font-playfair
      text-base
      tracking-wide
      md:mb-5
      md:text-lg
    "
  >
    <span className="italic text-white">
      Clock's Ticking
    </span>

    <span className="mx-2 text-slate-500">-</span>

    <span className="italic text-cyan-400">
      September 11th 2026
    </span>
  </div>
</Reveal>

        {/* =================================================
            COUNTDOWN CONTAINER
        ================================================= */}

        <motion.div
          initial={{
            opacity: 0,
            y: 14,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            margin: "-80px",
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            relative
            w-full
            max-w-2xl
          "
        >

          {/* =================================================
              GLASSMORPHIC BOX
          ================================================= */}

          <div
            className="
              relative
              overflow-hidden
              rounded-[16px]
              border
              border-cyan-400/30
              bg-slate-900/20
              backdrop-blur-xl
              shadow-[0_0_24px_rgba(0,210,235,0.06)]
              md:rounded-[18px]
            "
          >

            {/* GLASS TINT */}

            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-white/[0.012]
              "
            />


            {/* TOP GLOW */}

            <div
              className="
                pointer-events-none
                absolute
                inset-x-0
                top-0
                h-px
                bg-gradient-to-r
                from-transparent
                via-cyan-400/55
                to-transparent
              "
            />


            {/* =================================================
                CORNER ACCENTS
            ================================================= */}

            <div
              className="
                pointer-events-none
                absolute
                left-0
                top-0
                h-3
                w-3
                border-l
                border-t
                border-cyan-300/45
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                right-0
                top-0
                h-3
                w-3
                border-r
                border-t
                border-cyan-300/45
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                bottom-0
                left-0
                h-3
                w-3
                border-b
                border-l
                border-cyan-300/35
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                bottom-0
                right-0
                h-3
                w-3
                border-b
                border-r
                border-cyan-300/35
              "
            />


            {/* =================================================
                CONTENT
            ================================================= */}

            <div
              className="
                relative
                px-4
                py-4
                md:px-6
                md:py-5
              "
            >

              {/* TIME REMAINING */}

              <div
                className="
                  mb-3
                  font-sans
                  text-[8px]
                  font-medium
                  uppercase
                  tracking-[0.34em]
                  text-cyan-300/75
                  md:mb-4
                  md:text-[9px]
                "
              >
                TIME REMAINING
              </div>


              {/* =================================================
                  COUNTDOWN ROW
              ================================================= */}

              <div
                className="
                  flex
                  items-start
                  justify-center
                  gap-0
                "
              >

                <TimeUnit
                  label="Days"
                  value={days}
                />

                <Separator />

                <TimeUnit
                  label="Hours"
                  value={hours}
                />

                <Separator />

                <TimeUnit
                  label="Minutes"
                  value={minutes}
                />

                <Separator />

                <TimeUnit
                  label="Seconds"
                  value={seconds}
                />

              </div>

            </div>

          </div>

        </motion.div>

      </div>

    </section>
  );
}


/* =======================================================
   TIME UNIT
======================================================= */

function TimeUnit({
  label,
  value,
}: {
  label: string;
  value: number;
}) {

  const valueString = String(value).padStart(2, "0");

  return (
    <div
      className="
        flex
        min-w-0
        flex-1
        flex-col
        items-center
      "
    >

      {/* FLIP CLOCK DIGITS */}

      <div
        className="
          flex
          items-center
          justify-center
          gap-[3px]
          md:gap-[5px]
        "
      >

        {valueString
          .split("")
          .map((digit, index) => (
            <FlipDigit
              key={`${label}-${index}`}
              digit={digit}
            />
          ))}

      </div>


      {/* LABEL */}

      <div
        className="
          mt-1.5
          font-sans
          text-[7px]
          font-medium
          uppercase
          tracking-[0.28em]
          text-cyan-300/60
          md:mt-2
          md:text-[8px]
        "
      >
        {label}
      </div>

    </div>
  );
}


/* =======================================================
   COLON SEPARATOR
======================================================= */

function Separator() {

  return (
    <div
      className="
        flex
        h-[46px]
        w-[12px]
        items-center
        justify-center
        pb-2
        md:h-[68px]
        md:w-[18px]
      "
    >

      <span
        className="
          text-xl
          font-light
          leading-none
          text-cyan-400/60
          md:text-3xl
        "
        style={{
          textShadow:
            "0 0 5px rgba(0,210,235,0.45), 0 0 13px rgba(0,210,235,0.15)",
        }}
      >
        :
      </span>

    </div>
  );
}


/* =======================================================
   FLIP DIGIT
======================================================= */

function FlipDigit({
  digit,
}: {
  digit: string;
}) {

  const previousDigit = useRef(digit);

  const [oldDigit, setOldDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {

    if (digit === previousDigit.current) {
      return;
    }

    setOldDigit(previousDigit.current);
    setIsFlipping(true);

    previousDigit.current = digit;

  }, [digit]);


  return (
    <div
      className="
        relative
        h-[46px]
        w-[28px]
        md:h-[68px]
        md:w-[40px]
      "
      style={{
        perspective: "700px",
      }}
    >

      {/* =================================================
          MAIN CARD
      ================================================= */}

      <div
        className="
          absolute
          inset-0
          overflow-hidden
          rounded-[4px]
          border
          border-slate-700/80
          bg-slate-950/95
          shadow-[0_4px_10px_rgba(0,0,0,0.35)]
          md:rounded-[5px]
        "
      >

        {/* TOP HALF */}

        <div
          className="
            absolute
            inset-x-0
            top-0
            h-1/2
            overflow-hidden
            rounded-t-[4px]
            border-b
            border-black/50
            bg-gradient-to-b
            from-slate-800
            via-slate-900
            to-slate-950
            md:rounded-t-[5px]
          "
        >

          <DigitText
            digit={isFlipping ? oldDigit : digit}
            position="top"
          />

        </div>


        {/* BOTTOM HALF */}

        <div
          className="
            absolute
            inset-x-0
            bottom-0
            h-1/2
            overflow-hidden
            rounded-b-[4px]
            bg-gradient-to-b
            from-slate-950
            via-slate-900
            to-slate-800
            md:rounded-b-[5px]
          "
        >

          <DigitText
            digit={digit}
            position="bottom"
          />

        </div>


        {/* =================================================
            CENTER SPLIT
        ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            top-1/2
            z-30
            h-px
            -translate-y-1/2
            bg-black/90
            shadow-[0_1px_2px_rgba(255,255,255,0.06)]
          "
        />


        {/* =================================================
            CENTER HIGHLIGHT
        ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-x-0
            top-1/2
            z-40
            h-px
            -translate-y-[1px]
            bg-cyan-400/10
          "
        />

      </div>


      {/* =================================================
          FLIPPING TOP PANEL
      ================================================= */}

      {isFlipping && (
        <>
          <motion.div
            key={`top-${oldDigit}-${digit}`}
            initial={{
              rotateX: 0,
            }}
            animate={{
              rotateX: -90,
            }}
            transition={{
              duration: 0.22,
              ease: [0.4, 0, 1, 1],
            }}
            onAnimationComplete={() => {
              setTimeout(() => {
                setIsFlipping(false);
              }, 90);
            }}
            className="
              absolute
              inset-x-0
              top-0
              z-50
              h-1/2
              origin-bottom
              overflow-hidden
              rounded-t-[4px]
              border
              border-slate-700/80
              bg-gradient-to-b
              from-slate-700
              via-slate-800
              to-slate-950
              shadow-[0_5px_12px_rgba(0,0,0,0.45)]
              md:rounded-t-[5px]
            "
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
          >

            <DigitText
              digit={oldDigit}
              position="top"
            />

          </motion.div>


          {/* =================================================
              NEW TOP PANEL
          ================================================= */}

          <motion.div
            key={`new-top-${digit}-${oldDigit}`}
            initial={{
              rotateX: 90,
            }}
            animate={{
              rotateX: 0,
            }}
            transition={{
              delay: 0.19,
              duration: 0.20,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute
              inset-x-0
              top-0
              z-40
              h-1/2
              origin-bottom
              overflow-hidden
              rounded-t-[4px]
              border
              border-slate-700/80
              bg-gradient-to-b
              from-slate-800
              via-slate-900
              to-slate-950
              md:rounded-t-[5px]
            "
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
          >

            <DigitText
              digit={digit}
              position="top"
            />

          </motion.div>


          {/* =================================================
              NEW BOTTOM FLAP
          ================================================= */}

          <motion.div
            key={`bottom-${digit}-${oldDigit}`}
            initial={{
              rotateX: 90,
            }}
            animate={{
              rotateX: 0,
            }}
            transition={{
              delay: 0.19,
              duration: 0.20,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute
              inset-x-0
              bottom-0
              z-30
              h-1/2
              origin-top
              overflow-hidden
              rounded-b-[4px]
              border
              border-slate-700/80
              bg-gradient-to-b
              from-slate-950
              via-slate-900
              to-slate-800
              md:rounded-b-[5px]
            "
            style={{
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d",
            }}
          >

            <DigitText
              digit={digit}
              position="bottom"
            />

          </motion.div>
        </>
      )}


      {/* =================================================
          SUBTLE OUTER CYAN REFLECTION
      ================================================= */}

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          z-[60]
          rounded-[4px]
          border
          border-cyan-400/[0.10]
          shadow-[inset_0_0_10px_rgba(0,210,235,0.035)]
          md:rounded-[5px]
        "
      />

    </div>
  );
}


/* =======================================================
   DIGIT TEXT
======================================================= */

function DigitText({
  digit,
  position,
}: {
  digit: string;
  position: "top" | "bottom";
}) {

  return (
    <div
      className={`
        absolute
        left-0
        flex
        w-full
        items-center
        justify-center
        font-sans
        text-[32px]
        font-medium
        leading-none
        tracking-[-0.04em]
        text-slate-200
        md:text-[48px]

        ${
          position === "top"
            ? "top-0 h-[200%]"
            : "bottom-0 h-[200%]"
        }
      `}
      style={{
        textShadow: `
          0 0 5px rgba(34,211,238,0.20),
          0 0 12px rgba(34,211,238,0.08)
        `,
      }}
    >
      {digit}
    </div>
  );
}