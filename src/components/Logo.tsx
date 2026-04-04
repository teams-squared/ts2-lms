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
  // The text logo is wider than it is tall — scale width accordingly
  const width = showText ? Math.round(size * 2.8) : size;

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src={src}
        alt="Teams Squared"
        width={width}
        height={size}
        className="object-contain"
      />
    </div>
  );
}
