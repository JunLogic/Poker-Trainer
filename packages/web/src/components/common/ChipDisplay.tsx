interface Props {
  amount: number;
  dim?: boolean;
}

export function ChipDisplay({ amount, dim }: Props) {
  const formatted = amount >= 1000
    ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`
    : String(amount);

  return (
    <span className="chip-count" style={dim ? { opacity: 0.5 } : undefined}>
      {formatted}
    </span>
  );
}
