import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { Rocket, Users, Utensils, UserCog, FileText, Trophy } from "lucide-react";

/* =======================================================
   LIVE STREAM CONFIGURATION
======================================================= */
const YOUTUBE_VIDEO_ID = "mKCieTImjvU"; // Replace with actual YouTube Live ID 

const ALL_EVENTS = [
  { name: "Inaugural", timeLabel: "9:30 AM", startStr: "09:30", endStr: "11:30", icon: Rocket, day: 1 },
  { name: "Round 1 Evaluation", timeLabel: "11:30 AM", startStr: "11:30", endStr: "20:00", icon: Users, day: 1 },
  { name: "Dinner", timeLabel: "8:00 PM – 9:00 PM", startStr: "20:00", endStr: "21:00", icon: Utensils, day: 1 },
  { name: "Mentorship / Internal Evaluation", timeLabel: "9:30 PM – 11:30 PM", startStr: "21:30", endStr: "23:30", icon: UserCog, day: 1 },
  { name: "Round 2 Evaluation", timeLabel: "10:00 AM – 1:00 PM", startStr: "10:00", endStr: "13:00", icon: FileText, day: 2 },
  { name: "Lunch", timeLabel: "1:00 PM – 2:00 PM", startStr: "13:00", endStr: "14:00", icon: Utensils, day: 2 },
  { name: "Final Evaluation", timeLabel: "2:30 PM", startStr: "14:30", endStr: "17:30", icon: Trophy, day: 2 },
];

function LiveSchedule() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const checkIsActive = (startStr: string, endStr: string, dayNum: number) => {
    const isDay1 = now.getFullYear() === 2026 && now.getMonth() === 8 && now.getDate() === 11;
    const isDay2 = now.getFullYear() === 2026 && now.getMonth() === 8 && now.getDate() === 12;
    
    let isCorrectDay = false;
    if (dayNum === 1 && isDay1) isCorrectDay = true;
    if (dayNum === 2 && isDay2) isCorrectDay = true;
    
    const isPreEvent = now.getTime() < new Date(2026, 8, 11).getTime();
    if (isPreEvent && dayNum === 1) isCorrectDay = true; 

    if (!isCorrectDay) return false;

    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalM = currentH * 60 + currentM;

    const [startH, startM] = startStr.split(':').map(Number);
    const startTotalM = startH * 60 + startM;

    const [endH, endM] = endStr.split(':').map(Number);
    const endTotalM = endH * 60 + endM;

    return currentTotalM >= startTotalM && currentTotalM < endTotalM;
  };

  const renderEventCard = (event: any) => {
    const isActive = checkIsActive(event.startStr, event.endStr, event.day);
    const Icon = event.icon;

    return (
      <div key={event.name} className={`w-[130px] h-[170px] sm:w-[140px] sm:h-[180px] rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden snap-center shrink-0 group transition-all duration-300
        ${isActive ? 'bg-cyan-950/30 border border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.2)]' : 'glass border border-line/40 hover:border-lumen/40 hover:bg-white/[0.02]'}
      `}>
        {/* Top Left Highlight (Glassmorphism glare) */}
        <div className="absolute top-0 left-0 w-[60%] h-[60%] bg-white/[0.04] blur-[20px] rounded-full pointer-events-none" />
        
        {/* Scanning Effect for Active */}
        {isActive && (
          <>
            <div className="absolute inset-0 border-[1.5px] border-cyan-400/50 rounded-2xl pointer-events-none z-20" />
            <div className="absolute top-0 bottom-0 -left-[100%] w-[100%] z-30 pointer-events-none flex items-center justify-center animate-shining-card">
              <div className="flex gap-[4px] sm:gap-[6px] h-[150%] items-center">
                <div className="w-[1px] h-full bg-cyan-300 shadow-[0_0_8px_1px_rgba(34,211,238,0.7)] opacity-60" />
                <div className="w-[3px] sm:w-[4px] h-full bg-cyan-300 shadow-[0_0_12px_2px_rgba(34,211,238,0.85)]" />
                <div className="w-[1px] h-full bg-cyan-300 shadow-[0_0_8px_1px_rgba(34,211,238,0.7)] opacity-80" />
                <div className="w-[2px] h-full bg-cyan-300 shadow-[0_0_10px_1px_rgba(34,211,238,0.7)] opacity-50" />
              </div>
            </div>
          </>
        )}

        {/* Content */}
        <Icon className={`w-6 h-6 sm:w-7 sm:h-7 mb-3 sm:mb-4 transition-colors duration-300 z-10 ${isActive ? 'text-cyan-400' : 'text-white'}`} />
        
        <span className={`text-[9px] sm:text-[10px] font-mono font-semibold tracking-wider mb-2 z-10 ${isActive ? 'text-cyan-400' : 'text-cyan-400/70'}`}>
          {event.timeLabel}
        </span>
        
        <span className={`text-xs sm:text-sm font-display font-medium leading-tight px-3 z-10 ${isActive ? 'text-white' : 'text-fg'}`}>
          {event.name}
        </span>
      </div>
    );
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 300;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full mt-6 sm:mt-10 relative flex items-center group max-w-5xl mx-auto">
      {/* Left Arrow */}
      <button
        type="button"
        onClick={() => scroll('left')}
        aria-label="Scroll schedule left"
        className="absolute left-0 sm:-left-4 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full glass border border-line flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex cursor-pointer"
      >
        &lt;
      </button>
      
      <div ref={scrollRef} className="w-full overflow-x-auto hide-scrollbar flex items-center gap-6 sm:gap-8 px-4 sm:px-8 snap-x pb-6 pt-2">
        
        {/* Day 1 Group */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3 px-2">
            <span className="font-display text-white text-lg sm:text-xl">Day 1</span>
            <span className="text-muted text-xs sm:text-sm font-sans tracking-wide">September 11</span>
          </div>
          <div className="flex gap-4">
            {ALL_EVENTS.filter(e => e.day === 1).map(renderEventCard)}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-[1px] h-[160px] sm:h-[180px] bg-line/50 shrink-0 mt-8" />

        {/* Day 2 Group */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3 px-2">
            <span className="font-display text-white text-lg sm:text-xl">Day 2</span>
            <span className="text-muted text-xs sm:text-sm font-sans tracking-wide">September 12</span>
          </div>
          <div className="flex gap-4 pr-4 sm:pr-8">
            {ALL_EVENTS.filter(e => e.day === 2).map(renderEventCard)}
          </div>
        </div>

      </div>

      {/* Right Arrow */}
      <button
        type="button"
        onClick={() => scroll('right')}
        aria-label="Scroll schedule right"
        className="absolute right-0 sm:-right-4 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full glass border border-line flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100 hidden sm:flex cursor-pointer"
      >
        &gt;
      </button>
    </div>
  );
}

type EventState = "BEFORE" | "LIVE" | "AFTER";

export default function LiveHero({ isActive = true }: { isActive?: boolean }) {
  const [eventState] = useState<EventState>("LIVE");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isActive || !titleRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = titleRef.current.querySelectorAll("[data-char]");

    gsap.fromTo(
      chars,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        stagger: 0.03,
        duration: 1.05,
        ease: "expo.out",
        delay: 1.7,
      }
    );
  }, [isActive]);

  const title = "SPECATHON";

  return (
    <section
      id="top"
      className="group relative min-h-[92svh] flex flex-col justify-center pt-24 pb-12 sm:pt-28 sm:pb-14 md:pt-32 md:pb-16 lg:pt-24 lg:pb-10 overflow-hidden noise"
    >
      <div className="relative mx-auto max-w-[1400px] w-full px-4 md:px-8 flex flex-col items-center text-center -mt-8 md:-mt-12 lg:-mt-16">
        {isActive && (
          <>
            {/* Header / Animated Title */}

            <h1
              ref={titleRef}
              className="hero-title font-display font-bold leading-[1.2] text-[clamp(1.2rem,4vw,2.5rem)] tracking-tightest flex items-center justify-center flex-wrap gap-x-3 md:flex-nowrap md:gap-x-4 py-1 px-2 overflow-visible"
              aria-label="SPECATHON 2026"
            >
              <span
                className="overflow-visible inline-flex py-2 px-1"
                style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}
              >
                {title.split("").map((c, i) => (
                  <span
                    key={i}
                    data-char
                    className="inline-block will-change-transform py-1 px-[2px] shimmer-text"
                    style={{ "--delay": `${i * 0.15}s` } as React.CSSProperties}
                  >
                    {c}
                  </span>
                ))}
              </span>

              <motion.span
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: 2.3,
                  type: "spring",
                  stiffness: 180,
                  damping: 16,
                }}
                className="font-bold text-lumen text-[clamp(1.2rem,4vw,2.5rem)]"
                style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}
              >
                2026
              </motion.span>
            </h1>

            {/* EVENT STATES */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.7, duration: 0.7 }}
              className="mt-2 sm:mt-6 w-full flex flex-col items-center"
            >
              {/* STATE 1: BEFORE EVENT */}
              {eventState === "BEFORE" && (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-fg tracking-tightest">
                    THE WAIT IS ALMOST OVER
                  </h2>
                  <p className="text-subtle text-base md:text-lg">
                    Stream starts September 11, 2026
                  </p>
                </div>
              )}

              {/* STATE 2: LIVE */}
              {eventState === "LIVE" && (
                <div className="w-full flex flex-col items-center space-y-6">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between w-full max-w-5xl px-1">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-cyan-400/20 bg-cyan-950/20 shadow-cyan">
                      <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulseGlow" />
                      <span className="eyebrow !tracking-widest text-cyan-400 text-[10px]" style={{ letterSpacing: '0.1em' }}>
                        LIVE
                      </span>
                    </div>


                  </div>

                  {/* Video Player */}
                  <div className="w-full max-w-5xl aspect-video glass rounded-2xl overflow-hidden relative group">
                    {YOUTUBE_VIDEO_ID ? (
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&playsinline=1&rel=0`}
                        title="Specathon 2026 Live Stream"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                        <div className="w-10 h-10 rounded-full border-t-2 border-r-2 border-plasma animate-spinCrisp mb-4" />
                        <span className="eyebrow text-subtle">STREAM STARTING SOON</span>
                      </div>
                    )}
                  </div>

                  {/* Video Caption */}
                  <div className="w-full max-w-5xl text-left mt-3 px-1">
                    <h3 className="font-display font-medium text-lg sm:text-xl text-fg flex items-center gap-2">
                      SPECATHON 2026 
                      <span className="text-muted/50 text-sm">|</span> 
                      <span className="text-cyan-400 tracking-widest text-xs uppercase pt-0.5 font-sans">LIVE</span>
                    </h3>
                  </div>

                  {/* Up Next Display */}
                  <div className="mt-6 sm:mt-8 w-full max-w-5xl pt-2">
                    <div className="text-center mb-4 sm:mb-6 text-2xl sm:text-3xl font-display">
                      <span className="text-white" style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}>Up </span>
                      <span className="text-cyan-400 italic" style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}>Next</span>
                    </div>
                    <LiveSchedule />
                  </div>
                </div>
              )}

              {/* STATE 3: AFTER EVENT */}
              {eventState === "AFTER" && (
                <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                  <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-fg tracking-tightest">
                    EVENT HAS ENDED
                  </h2>
                  <p className="text-subtle text-base md:text-lg max-w-lg text-center">
                    Thank you for being part of Specathon 2026.
                  </p>
                  <button className="btn-primary mt-4">
                    Watch Recording
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </section>
  );
}
