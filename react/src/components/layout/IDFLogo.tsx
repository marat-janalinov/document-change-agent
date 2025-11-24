import { cn } from '@/lib/utils';

export type IDFLogoProps = {
  className?: string;
  language?: 'ru' | 'kk' | 'en';
};

export function IDFLogo({ className = 'h-16', language = 'ru' }: IDFLogoProps) {
  const labels = {
    ru: {
      l1: 'ФОНД РАЗВИТИЯ',
      l2: 'ПРОМЫШЛЕННОСТИ',
      l3: 'РЕСПУБЛИКИ КАЗАХСТАН',
      sizes: { fs1: 18, fs2: 18, fs3: 11 },
    },
    kk: {
      l1: 'ӨНЕРКӘСІПТІ ДАМЫТУ',
      l2: 'ҚОРЫ',
      l3: 'ҚАЗАҚСТАН',
      sizes: { fs1: 16, fs2: 20, fs3: 12 },
    },
    en: {
      l1: 'INDUSTRIAL DEVELOPMENT',
      l2: 'FUND',
      l3: 'KAZAKHSTAN',
      sizes: { fs1: 15, fs2: 20, fs3: 11 },
    },
  } as const;

  const { l1, l2, l3, sizes } = labels[language];

  return (
    <svg
      className={cn('block w-auto h-full', className)}
      viewBox="0 0 420 120"
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={
        language === 'ru'
          ? 'Фонд развития промышленности Республики Казахстан'
          : language === 'kk'
          ? 'Қазақстан Өнеркәсіпті дамыту қоры'
          : 'Industrial Development Fund of Kazakhstan'
      }
    >
      <g>
        <polygon points="10,20 50,20 65,50 25,50" fill="#F47920" />
        <polygon points="35,42 75,42 90,72 50,72" fill="#0A5C6B" />
        <polygon points="15,64 55,64 40,90 0,90" fill="#2B9EB3" />
      </g>

      <g fill="currentColor" fontFamily="Arial, sans-serif">
        <text x="110" y="42" fontSize={sizes.fs1} fontWeight="700" letterSpacing="0.5">
          {l1}
        </text>
        <text x="110" y="66" fontSize={sizes.fs2} fontWeight="700" letterSpacing="0.5">
          {l2}
        </text>
        <text x="110" y="86" fontSize={sizes.fs3} opacity="0.9">
          {l3}
        </text>
      </g>

      <rect x="400" y="0" width="20" height="120" fill="transparent" />
    </svg>
  );
}
