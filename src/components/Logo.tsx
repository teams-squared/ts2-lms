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
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Octagonal geometric shape made of overlapping ribbon strips */}
        {/* Top-right ribbon */}
        <path
          d="M50 5 L80 20 L95 50 L80 35 Z"
          fill="#4400FF"
          opacity="0.9"
        />
        {/* Right-bottom ribbon */}
        <path
          d="M95 50 L80 80 L50 95 L80 65 Z"
          fill="#5000E8"
          opacity="0.85"
        />
        {/* Bottom-left ribbon */}
        <path
          d="M50 95 L20 80 L5 50 L20 65 Z"
          fill="#4400FF"
          opacity="0.9"
        />
        {/* Left-top ribbon */}
        <path
          d="M5 50 L20 20 L50 5 L20 35 Z"
          fill="#5000E8"
          opacity="0.85"
        />
        {/* Overlap accents */}
        <path
          d="M50 5 L20 35 L50 50 L80 35 Z"
          fill="#6020FF"
          opacity="0.3"
        />
        <path
          d="M95 50 L80 35 L50 50 L80 65 Z"
          fill="#6020FF"
          opacity="0.3"
        />
        <path
          d="M50 95 L80 65 L50 50 L20 65 Z"
          fill="#6020FF"
          opacity="0.3"
        />
        <path
          d="M5 50 L20 65 L50 50 L20 35 Z"
          fill="#6020FF"
          opacity="0.3"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "#4400FF" }}
          >
            teams
          </span>
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: "#4400FF" }}
          >
            squared
          </span>
        </div>
      )}
    </div>
  );
}
