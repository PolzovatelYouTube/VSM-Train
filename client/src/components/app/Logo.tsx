export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="ВСМ Тренажёр" role="img">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M6 20h14a6 6 0 0 0 6-6v-1H12a6 6 0 0 0-6 6v1z" className="fill-primary-foreground" />
      <path d="M4 23h22" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
