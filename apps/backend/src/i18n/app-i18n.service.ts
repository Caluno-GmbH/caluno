import MessageFormat, { type MessageFunction } from '@messageformat/core';
import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { Locale } from '../graphql/locale';

export type TranslateFn = (
  key: string,
  args?: Record<string, string | number>,
) => string;

export interface Translator {
  t: TranslateFn;
}

export const ICU_ARGUMENT_PATTERN =
  /\{\s*\w+\s*,\s*(plural|selectordinal|select)\s*,/;

@Injectable()
export class AppI18nService {
  private readonly messageFormats = new Map<Locale, MessageFormat>();
  private readonly compiledMessages = new Map<
    string,
    MessageFunction<'string'>
  >();

  constructor(private readonly i18n: I18nService) {}

  translate(
    locale: Locale,
    key: string,
    args?: Record<string, string | number>,
  ): string {
    if (args !== undefined) {
      const template = this.i18n.t(key, { lang: locale });
      if (typeof template === 'string' && ICU_ARGUMENT_PATTERN.test(template)) {
        return this.compile(locale, template)(args);
      }
    }

    return this.i18n.t(key, { lang: locale, args });
  }

  createTranslator(locale: Locale, namespace: string): Translator {
    const prefix = namespace.endsWith('.') ? namespace : `${namespace}.`;

    return {
      t: (key, args) => this.translate(locale, `${prefix}${key}`, args),
    };
  }

  private compile(locale: Locale, template: string): MessageFunction<'string'> {
    const cacheKey = `${locale}\u0000${template}`;
    const cached = this.compiledMessages.get(cacheKey);
    if (cached) return cached;

    let messageFormat = this.messageFormats.get(locale);
    if (!messageFormat) {
      messageFormat = new MessageFormat(locale);
      this.messageFormats.set(locale, messageFormat);
    }

    const compiled = messageFormat.compile(template);
    this.compiledMessages.set(cacheKey, compiled);
    return compiled;
  }
}
