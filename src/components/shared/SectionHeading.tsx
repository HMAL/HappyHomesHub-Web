interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** 'light' = dark text on light section, 'dark' = white text on dark section. */
  tone?: 'light' | 'dark';
  className?: string;
}

/** One heading treatment for every marketing section: eyebrow, display title, subtitle. */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = 'light',
  className = '',
}: SectionHeadingProps) {
  const dark = tone === 'dark';
  return (
    <div className={`text-center max-w-2xl mx-auto ${className}`}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-3 text-gold">
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-display text-3xl md:text-4xl font-bold mb-4 ${
          dark ? 'text-white' : 'text-gray-900'
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`text-base leading-relaxed ${dark ? 'text-white/60' : 'text-gray-600'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
