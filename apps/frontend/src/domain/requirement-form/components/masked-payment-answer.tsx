import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui';
import { Info } from 'lucide-react';
import { getTranslations } from 'next-intl/server';


export async function MaskedPaymentAnswer({ value }: { value: string }) {
  const t = await getTranslations('RequirementForm.submission');

  return (
    <span className="inline-flex items-center gap-1.5">
      {value}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('restrictedPaymentData')}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <p className="text-sm">{t('restrictedPaymentData')}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
