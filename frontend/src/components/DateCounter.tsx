import { useState, useEffect } from "react";
import SlotCounter from "react-slot-counter";

const CHAR_SET: string[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz&-".split("");

interface DateCounterProps {
  value?: string;
  text?: string;
  delay?: number;
  startDelay?: number;
  animateBy?: string;
  direction?: string;
}

export default function DateCounter(props: DateCounterProps = {}): JSX.Element {
  const [isStarted, setIsStarted] = useState(false);
  const textValue = props.value ?? props.text;
  const groups = textValue ? textValue.split(" ") : ["11", "&", "12", "SEP"];

  // Respect startDelay from parent (2800ms in Hero) so animation plays right as badge becomes visible
  const delayTime = props.startDelay ?? 2700;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsStarted(true);
    }, delayTime);
    return () => clearTimeout(timer);
  }, [delayTime]);

  let animatedIndex = 0;

  return (
    <div className="date-counter flex items-center gap-3.5 sm:gap-4">
      {groups.map((group, groupIndex) => (
        <div className="counter-group flex items-center gap-2" key={groupIndex}>
          {group.split("").map((char, charIndex) => {
            const index = animatedIndex++;
            const direction: "bottom-up" | "top-down" =
              index % 2 === 0 ? "bottom-up" : "top-down";

            return (
              <div 
                className="counter-box flex items-center justify-center w-7 h-9 sm:w-8 sm:h-10 md:w-9 md:h-12 rounded-xl bg-[#141923] border border-white/[0.06] text-white font-sans font-bold text-base sm:text-lg md:text-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden"
                key={`${groupIndex}-${charIndex}`}
              >
                <SlotCounter
                  value={isStarted ? char : "0"}
                  dummyCharacters={CHAR_SET}
                  direction={direction}
                  duration={1.2 + (index * 0.15)}
                  autoAnimationStart={true}
                  animateUnchanged={true}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}