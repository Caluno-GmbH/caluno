import type { Locale } from '@repo/data';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@repo/ui';
import { ExternalLink } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  formatLastChanged,
  type LegalDocumentCard,
} from '@/lib/legal-documents';

type LegalDocumentsSectionProps = {
  cards: LegalDocumentCard[];
  locale: Locale;
};

export const LegalDocumentsSection = async ({
  cards,
  locale,
}: LegalDocumentsSectionProps) => {
  const tProfile = await getTranslations('Profile');

  return (
    <section>
      <h1 className="hyphens-auto break-words text-xl font-bold mb-4">
        {tProfile('legalDocuments')}
      </h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.kind}>
            <CardHeader>
              <CardTitle className="break-words">
                {tProfile(card.kind)}
              </CardTitle>
              {card.lastChangedOn && (
                <p className="text-sm text-primary">
                  {tProfile('lastChanged', {
                    date: formatLastChanged(card.lastChangedOn, locale),
                  })}
                </p>
              )}
            </CardHeader>
            <CardContent className="flex justify-end">
              <Button asChild variant="ghost" size="sm">
                <a href={card.href} target="_blank" rel="noopener noreferrer">
                  {tProfile('readDocument')}
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
