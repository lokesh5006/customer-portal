import { ReactNode } from 'react';

interface AuthBackgroundProps {
  children: ReactNode;
}

const Gear = ({ className, size = 200 }: { className?: string; size?: number }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M50 8 L55 8 L57 18 A33 33 0 0 1 67 22 L75 16 L80 21 L74 29 A33 33 0 0 1 78 39 L88 41 L88 47 L88 53 L88 59 L78 61 A33 33 0 0 1 74 71 L80 79 L75 84 L67 78 A33 33 0 0 1 57 82 L55 92 L50 92 L45 92 L43 82 A33 33 0 0 1 33 78 L25 84 L20 79 L26 71 A33 33 0 0 1 22 61 L12 59 L12 53 L12 47 L12 41 L22 39 A33 33 0 0 1 26 29 L20 21 L25 16 L33 22 A33 33 0 0 1 43 18 L45 8 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="50" cy="50" r="14" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export const AuthBackground = ({ children }: AuthBackgroundProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900">
      {/* Subtle gear shapes */}
      <div className="pointer-events-none absolute inset-0 text-white/[0.08]">
        <Gear className="absolute -top-16 -left-16" size={280} />
        <Gear className="absolute top-1/3 -right-20" size={220} />
        <Gear className="absolute bottom-10 left-10" size={180} />
        <Gear className="absolute -bottom-16 -right-10" size={260} />
        <Gear className="absolute top-10 right-1/3" size={120} />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>
    </div>
  );
};
