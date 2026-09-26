export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img src="/favicon.png" width={size} height={size} alt="ВСМ Тренажёр" />
  );
}
