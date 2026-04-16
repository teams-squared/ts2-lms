import Image from "next/image";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function Logo({
  className = "",
  showText = false,
  size = 40,
}: LogoProps) {
  const src = showText ? "/logo_w_text.png" : "/logo.png";
  // logo_w_text.png natural dimensions are 96×32 (3:1 ratio)
  const width = showText ? size * 3 : size;

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={src}
        alt="Teams Squared"
        width={width}
        height={size}
        unoptimized
      />
    </div>
  );
}
