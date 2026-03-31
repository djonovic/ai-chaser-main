import { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

export default function SeoFaq({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span>{item.q}</span>
            <svg
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openIndex === i && (
            <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
