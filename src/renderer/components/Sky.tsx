// The horizon grid at the bottom of the opening and closing screens: lines
// that meet at the horizon, and cross lines that run toward you, faster as
// they come. With reduced motion they stand still.

const RAYS = 24;
const RUNNERS = 6;

export function Sky() {
  const rays = Array.from({ length: RAYS + 1 }, (_, i) => {
    const t = i / RAYS - 0.5;
    return <line key={`r${i}`} x1={500 + t * 600} y1={0} x2={500 + t * 4200} y2={200} />;
  });
  const runners = Array.from({ length: RUNNERS }, (_, i) => (
    <line key={`h${i}`} className="run" x1={-2000} y1={0} x2={3000} y2={0} style={{ animationDelay: `${(-30 * i) / RUNNERS}s` }} />
  ));
  return (
    <div className="sky" aria-hidden="true">
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
        {rays}
        {runners}
      </svg>
    </div>
  );
}
