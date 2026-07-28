interface SeoCtaBandProps {
  heading: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  primaryAriaLabel: string;
  primaryMicrocopy?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryAriaLabel?: string;
}

export default function SeoCtaBand({
  heading,
  description,
  primaryHref,
  primaryLabel,
  primaryAriaLabel,
  primaryMicrocopy = '14-day free trial',
  secondaryHref,
  secondaryLabel,
  secondaryAriaLabel,
}: SeoCtaBandProps) {
  return (
    <div className="my-10 rounded-xl bg-primary/5 border border-primary/10 p-6 md:p-8 text-center">
      <h3 className="text-xl font-bold tracking-tight">{heading}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">{description}</p>
      <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={primaryHref}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-600 transition-all group"
          aria-label={primaryAriaLabel}
          data-track="lead_cta_click"
          data-cta-id="inline_band"
        >
          {primaryLabel}
          <span className="ml-2 text-primary-foreground/70 text-xs group-hover:text-primary-foreground/90 transition-colors">
            {primaryMicrocopy}
          </span>
        </a>
        {secondaryHref && secondaryLabel && (
          <a
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
            aria-label={secondaryAriaLabel}
          >
            {secondaryLabel}
          </a>
        )}
      </div>
    </div>
  );
}
