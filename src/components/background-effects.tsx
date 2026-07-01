import { motion } from "framer-motion";

const rings = [
  { delay: 0, size: 80 },
  { delay: 2, size: 120 },
  { delay: 4, size: 100 },
  { delay: 6, size: 140 },
];

const orbs = [
  { x: "15%", y: "80%", size: 700, color: "rgba(251,146,60,0.12)" },
  { x: "60%", y: "10%", size: 600, color: "rgba(234,88,12,0.08)" },
  { x: "85%", y: "50%", size: 500, color: "rgba(251,191,36,0.06)" },
];

const crackPaths = [
  "M50,0 L60,30 L45,55 L70,70 L55,100",
  "M0,80 L25,70 L35,85 L60,75",
  "M100,20 L80,40 L85,65 L100,80",
  "M30,0 L20,25 L5,20 L0,45",
  "M70,100 L75,75 L95,60 L90,40",
  "M0,40 L15,50 L10,70 L25,90",
  "M100,90 L85,95 L70,85 L55,95",
  "M5,0 L0,15 L20,25 L15,45",
];

const driftVariant = {
  animate: (i: number) => ({
    x: [0, i % 2 === 0 ? 30 : -30, 0],
    y: [0, i % 2 === 0 ? -20 : 20, 0],
    transition: { duration: 18 + i * 2, repeat: Infinity, ease: "easeInOut" },
  }),
};

export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Pulse Rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {rings.map((r, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-primary/20"
            style={{ width: r.size, height: r.size }}
            initial={{ scale: 0.3, opacity: 0.5 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: r.delay,
              ease: "easeOut",
            }}
          />
        ))}
        {/* Center glow dot */}
        <div className="absolute h-2 w-2 rounded-full bg-primary/30 blur-sm" />
      </div>

      {/* Glow Orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={`orb-${i}`}
          className="absolute rounded-full"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            transform: "translate(-50%, -50%)",
          }}
          variants={driftVariant}
          custom={i}
          animate="animate"
        />
      ))}

      {/* Energy Crackle SVG */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {crackPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="rgb(251 146 60 / 0.06)"
            strokeWidth="0.3"
            fill="none"
            strokeLinecap="round"
            className="crackle-line"
            style={{ animationDelay: `${i * 0.7}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
