import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Reveal from "./Reveal";

/* =======================================================
   COUNTDOWN DEADLINE
======================================================= */

const DEADLINE = new Date(
  "2026-08-31T23:59:59+05:30"
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
  };
}


/* =======================================================
   MAIN COUNTDOWN
======================================================= */

export default function SeatCountdown() {
  const { days, hours, minutes } = useDeadline();

  return (
    <section className="relative pt-12 pb-6 md:pt-16 md:pb-8">

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

        {/* DEADLINE LABEL */}

        <Reveal>
          <div
            className="
              mb-5
              font-sans
              text-[10px]
              font-medium
              uppercase
              tracking-[0.42em]
              text-cyan-400/70
              md:text-[11px]
            "
          >
            Seat Confirmation Deadline
            &nbsp;&nbsp;·&nbsp;&nbsp;
            Aug 31, 2026
          </div>
        </Reveal>


        {/* COUNTDOWN */}

        <motion.div
          initial={{
            opacity: 0,
            y: 16,
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
            max-w-3xl
          "
        >

          {/* GLASSMORPHIC BOX */}

          <div
            className="
              relative
              overflow-hidden
              rounded-[18px]
              border
              border-cyan-400/30
              bg-slate-900/20
              backdrop-blur-xl
              shadow-[0_0_30px_rgba(0,210,235,0.07)]
              md:rounded-[20px]
            "
          >

            {/* SUBTLE GLASS TINT */}

            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-white/[0.015]
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
                via-cyan-400/60
                to-transparent
              "
            />


            {/* CORNER ACCENTS */}

            <div
              className="
                pointer-events-none
                absolute
                left-0
                top-0
                h-4
                w-4
                border-l
                border-t
                border-cyan-300/50
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                right-0
                top-0
                h-4
                w-4
                border-r
                border-t
                border-cyan-300/50
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                bottom-0
                left-0
                h-4
                w-4
                border-b
                border-l
                border-cyan-300/40
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                bottom-0
                right-0
                h-4
                w-4
                border-b
                border-r
                border-cyan-300/40
              "
            />


            {/* CONTENT */}

            <div
              className="
                relative
                px-5
                py-5
                md:px-8
                md:py-6
              "
            >

              {/* TIME REMAINING */}

              <div
                className="
                  mb-4
                  font-sans
                  text-[9px]
                  font-medium
                  uppercase
                  tracking-[0.38em]
                  text-cyan-300/80
                  md:mb-5
                  md:text-[10px]
                "
              >
                TIME REMAINING
              </div>


              {/* COUNTDOWN ROW */}

              <div
                className="
                  flex
                  items-center
                  justify-center
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

      {/* LARGE DIGITAL NUMBER */}

      <div
        className="
          flex
          items-center
          justify-center
          gap-[5px]
          md:gap-[8px]
        "
      >

        {valueString
          .split("")
          .map((digit, index) => (
            <DigitalDigit
              key={`${label}-${index}`}
              digit={digit}
            />
          ))}

      </div>


      {/* LABEL */}

      <div
        className="
          mt-2
          font-sans
          text-[8px]
          font-medium
          uppercase
          tracking-[0.30em]
          text-cyan-300/60
          md:mt-3
          md:text-[9px]
        "
      >
        {label}
      </div>

    </div>
  );
}


/* =======================================================
   COLON
======================================================= */

function Separator() {

  return (
    <div
      className="
        flex
        h-[58px]
        w-[22px]
        items-center
        justify-center
        pb-3
        md:h-[88px]
        md:w-[34px]
      "
    >

      <span
        className="
          text-3xl
          font-light
          leading-none
          text-cyan-400/70
          md:text-5xl
        "
        style={{
          textShadow:
            "0 0 6px rgba(0,210,235,0.65), 0 0 16px rgba(0,210,235,0.30)",
        }}
      >
        :
      </span>

    </div>
  );
}


/* =======================================================
   7-SEGMENT CONFIGURATION
======================================================= */

const SEGMENTS: Record<string, string[]> = {

  "0": [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ],

  "1": [
    "b",
    "c",
  ],

  "2": [
    "a",
    "b",
    "g",
    "e",
    "d",
  ],

  "3": [
    "a",
    "b",
    "c",
    "d",
    "g",
  ],

  "4": [
    "f",
    "g",
    "b",
    "c",
  ],

  "5": [
    "a",
    "f",
    "g",
    "c",
    "d",
  ],

  "6": [
    "a",
    "f",
    "g",
    "e",
    "c",
    "d",
  ],

  "7": [
    "a",
    "b",
    "c",
  ],

  "8": [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
  ],

  "9": [
    "a",
    "b",
    "c",
    "d",
    "f",
    "g",
  ],

};


/* =======================================================
   DIGITAL DIGIT
======================================================= */

function DigitalDigit({
  digit,
}: {
  digit: string;
}) {

  const activeSegments =
    SEGMENTS[digit] || [];

  return (
    <motion.div
      key={digit}

      initial={{
        opacity: 0.45,
        scale: 0.97,
      }}

      animate={{
        opacity: 1,
        scale: 1,
      }}

      transition={{
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      }}

      className="
        relative
        h-[58px]
        w-[35px]
        md:h-[88px]
        md:w-[52px]
      "
    >

      {/* A — TOP */}

      <Segment
        active={activeSegments.includes("a")}
        className="
          left-[5px]
          right-[5px]
          top-0
          h-[5px]
          md:left-[8px]
          md:right-[8px]
          md:h-[7px]
        "
      />


      {/* B — UPPER RIGHT */}

      <Segment
        active={activeSegments.includes("b")}
        className="
          right-0
          top-[5px]
          h-[21px]
          w-[5px]
          md:top-[8px]
          md:h-[34px]
          md:w-[7px]
        "
      />


      {/* C — LOWER RIGHT */}

      <Segment
        active={activeSegments.includes("c")}
        className="
          bottom-[5px]
          right-0
          h-[21px]
          w-[5px]
          md:bottom-[8px]
          md:h-[34px]
          md:w-[7px]
        "
      />


      {/* D — BOTTOM */}

      <Segment
        active={activeSegments.includes("d")}
        className="
          bottom-0
          left-[5px]
          right-[5px]
          h-[5px]
          md:left-[8px]
          md:right-[8px]
          md:h-[7px]
        "
      />


      {/* E — LOWER LEFT */}

      <Segment
        active={activeSegments.includes("e")}
        className="
          bottom-[5px]
          left-0
          h-[21px]
          w-[5px]
          md:bottom-[8px]
          md:h-[34px]
          md:w-[7px]
        "
      />


      {/* F — UPPER LEFT */}

      <Segment
        active={activeSegments.includes("f")}
        className="
          left-0
          top-[5px]
          h-[21px]
          w-[5px]
          md:top-[8px]
          md:h-[34px]
          md:w-[7px]
        "
      />


      {/* G — MIDDLE */}

      <Segment
        active={activeSegments.includes("g")}
        className="
          left-[5px]
          right-[5px]
          top-1/2
          h-[5px]
          -translate-y-1/2
          md:left-[8px]
          md:right-[8px]
          md:h-[7px]
        "
      />

    </motion.div>
  );
}


/* =======================================================
   GLOWING SEGMENT
======================================================= */

function Segment({
  active,
  className,
}: {
  active: boolean;
  className: string;
}) {

  return (
    <motion.span
      className={`
        absolute
        rounded-[2px]
        ${className}
      `}

      animate={{
        opacity: active ? 1 : 0.16,
      }}

      transition={{
        duration: 0.25,
      }}

      style={
        active
          ? {
              background:
                "linear-gradient(90deg, rgba(34,211,238,0.72), rgba(103,232,249,0.92), rgba(34,211,238,0.72))",

              boxShadow:
                `
                0 0 4px rgba(34,211,238,0.95),
                0 0 10px rgba(34,211,238,0.70),
                0 0 22px rgba(34,211,238,0.38),
                0 0 38px rgba(34,211,238,0.16)
                `,
            }
          : {
              background:
                "rgba(8,47,73,0.30)",
            }
      }
    />
  );
}