import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function Logo({
  className = "",
  showText = true,
  size = 40,
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/logo.png"
        alt="Teams Squared"
        width={size}
        height={size}
        className="object-contain"
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className="font-bold tracking-tight"
            style={{ color: "#4800E8", fontSize: `${size * 0.38}px` }}
          >
            teams
          </span>
          <span
            className="font-bold tracking-tight"
            style={{ color: "#4800E8", fontSize: `${size * 0.38}px` }}
          >
            squared
          </span>
        </div>
      )}
    </div>
  );
}
