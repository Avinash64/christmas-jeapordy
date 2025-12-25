import Image from "next/image";

type ItemCardProps = {
  value: number | string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export default function ItemCard({
  value,
  onClick,
  disabled = false,
  className = "",
}: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-20 w-full rounded bg-blue-700 text-2xl font-extrabold text-yellow-300 shadow hover:bg-blue-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-blue-700/40",
        className,
      ].join(" ")}
      aria-label={`tile ${value}`}
    >
      {typeof value === "number" ? `$${value}` : value}
    </button>
  );
}