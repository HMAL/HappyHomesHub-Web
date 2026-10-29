interface HHLogoProps {
  variant?: 'full' | 'mark';
  theme?: 'light' | 'dark';
  size?: number;
}

export default function HHLogo({ variant = 'full', theme = 'dark', size = 36 }: HHLogoProps) {
  const primary = theme === 'dark' ? '#fff' : '#0D1F2D';
  const accent = '#D4972A';

  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill={theme === 'dark' ? '#0D1F2D' : '#F3F4F6'} />
        {/* Left H */}
        <rect x="6" y="14" width="3" height="14" rx="1" fill={primary} />
        <rect x="6" y="20" width="9" height="3" rx="1" fill={accent} />
        <rect x="12" y="14" width="3" height="14" rx="1" fill={primary} />
        {/* House peak accent */}
        <path d="M5 14 L10 9 L15 14" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Right H */}
        <rect x="22" y="14" width="3" height="14" rx="1" fill={primary} />
        <rect x="22" y="20" width="9" height="3" rx="1" fill={accent} />
        <rect x="28" y="14" width="3" height="14" rx="1" fill={primary} />
        {/* House peak accent */}
        <path d="M21 14 L26 9 L31 14" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>

      {variant === 'full' && (
        <div className="flex flex-col leading-none">
          <span
            className="font-display font-bold"
            style={{ color: theme === 'dark' ? '#fff' : '#0D1F2D', fontSize: size * 0.42 }}
          >
            HappyHomes<span style={{ color: accent }}>Hub</span>
          </span>
          {size > 28 && (
            <span
              className="font-sans"
              style={{
                color: theme === 'dark' ? '#cbd5e1' : '#6b7280',
                fontSize: Math.max(13, size * 0.28),
                letterSpacing: '0.01em',
                marginTop: size * 0.08,
              }}
            >
              Your property, simplified
            </span>
          )}
        </div>
      )}
    </div>
  );
}
