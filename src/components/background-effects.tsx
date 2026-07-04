const orbs = [
  { x: "10%", y: "20%", size: 700, color: "rgba(255,85,0,0.12)" },
  { x: "80%", y: "10%", size: 600, color: "rgba(255,65,0,0.08)" },
  { x: "70%", y: "80%", size: 500, color: "rgba(255,120,0,0.06)" },
  { x: "20%", y: "70%", size: 400, color: "rgba(255,100,0,0.05)" },
];

export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <div
          key={`orb-${i}`}
          className="absolute rounded-full blur-3xl"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />
    </div>
  );
}
