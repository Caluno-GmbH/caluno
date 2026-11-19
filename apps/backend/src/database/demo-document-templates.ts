/**
 * Template bodies for the Altonaer Lesepaten demo, generated from the template
 * builder's presets (`getContractDocument` / `getInvoiceDocument` in
 * apps/frontend/src/domain/accounting/components/template/builder-document-presets.ts)
 * through `serializeTemplateBody`, so they are what an admin saving an
 * untouched preset gets. The backend cannot import the frontend; regenerate
 * this file when the presets change.
 */
import type { DocumentTemplateBody } from '../accounting/schemas/document-template.schema';

type Pauschale = 'ehrenamt' | 'uebungsleiter';

export const DEMO_TEMPLATE_BODIES: Record<
  'contract' | 'invoice',
  Record<Pauschale, DocumentTemplateBody & Record<string, unknown>>
> = {
  contract: {
    ehrenamt: {
      header: {
        titleLines: [
          'Zusatzvereinbarung zur',
          'Aufwandsentschädigung gemäß § 3 Nr. 26a EStG (Ehrenamtspauschale)',
        ],
        metaLines: [],
      },
      blocks: [
        {
          kind: 'text',
          id: 'persoenliche-daten',
          title: '',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'parties',
              text: 'Zwischen dem {orgName}, {orgStreet}, {orgZip} {orgCity}',
              fields: [
                {
                  id: 'parties-org-name',
                  value: {
                    kind: 'bound',
                    source: 'org_name',
                  },
                },
                {
                  id: 'parties-org-street',
                  value: {
                    kind: 'bound',
                    source: 'org_street',
                  },
                },
                {
                  id: 'parties-org-zip',
                  value: {
                    kind: 'bound',
                    source: 'org_zip',
                  },
                },
                {
                  id: 'parties-org-city',
                  value: {
                    kind: 'bound',
                    source: 'org_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'parties-additional',
              text: ', {additionalInfo}',
              fields: [
                {
                  id: 'parties-additional-info',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: true,
              enabled: false,
              inline: true,
            },
            {
              id: 'volunteer-name',
              text: 'und {volunteerFirstName} {volunteerLastName},',
              fields: [
                {
                  id: 'volunteer-name-first',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_first_name',
                  },
                },
                {
                  id: 'volunteer-name-last',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_last_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-address',
              text: 'wohnhaft in {volunteerStreet}, {volunteerZip} {volunteerCity}',
              fields: [
                {
                  id: 'volunteer-street-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_street',
                  },
                },
                {
                  id: 'volunteer-zip-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_zip',
                  },
                },
                {
                  id: 'volunteer-city-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-dob',
              text: 'geboren am {volunteerDob}',
              fields: [
                {
                  id: 'volunteer-dob-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_dob',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
            {
              id: 'parties-closing',
              text: 'im Folgenden „ehrenamtlich tätige Person" genannt, wird Folgendes vereinbart:',
              fields: [],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'zeitraum-taetigkeit',
          title: 'Zeitraum und ehrenamtliche Tätigkeit',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'engagement-scope',
              text: 'Die ehrenamtlich tätige Person übt im Zeitraum {contractLifespan} für die Einrichtung {orgName} eine nebenberufliche Tätigkeit aus.',
              fields: [
                {
                  id: 'contract-lifespan',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'period',
                },
                {
                  id: 'engagement-org-name',
                  value: {
                    kind: 'bound',
                    source: 'org_facility_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'engagement-tasks',
              text: 'Im Rahmen des steuerbegünstigten Zwecks einer gemeinnützigen Organisation ist die Person mit folgenden Tätigkeiten ehrenamtlich tätig: {tasks}',
              fields: [
                {
                  id: 'tasks',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'freiwillige-stunden',
          title: '',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'hours-scope',
              text: 'Zeitraum: {contractLifespan}  Stundenzahl pro {hoursUnit}: in der Regel {hoursAmount}',
              fields: [
                {
                  id: 'contract-lifespan',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'period',
                },
                {
                  id: 'hours-unit',
                  value: {
                    kind: 'manual-template',
                    value: 'Monat',
                  },
                  control: 'unit-tabs',
                },
                {
                  id: 'hours-amount',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'number',
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'hours-confirmation',
              text: 'Die ehrenamtlich tätige Person bestätigt, dass der zeitliche Umfang der Tätigkeit (ggf. unter Berücksichtigung weiterer gleichartiger Tätigkeiten), bezogen auf das Kalenderjahr, höchstens ein Drittel der Arbeitszeit bei Vollbeschäftigung beträgt.',
              fields: [],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'aufwandsentschaedigung',
          title: 'Aufwandsentschädigung',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'rate',
              text: 'Als Aufwandsentschädigung erhält die ehrenamtlich tätige Person {rate} € pro Stunde.',
              fields: [
                {
                  id: 'rate-field',
                  value: {
                    kind: 'bound',
                    source: 'hourly_rate',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-intro',
              text: 'Die Aufwandsentschädigung wird monatlich auf folgendes Konto überwiesen:',
              fields: [],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-holder',
              text: 'Kontoinhaber:in: {volunteerAccountHolder}',
              fields: [
                {
                  id: 'payout-holder-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_account_holder',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-iban',
              text: 'IBAN: {volunteerIban}',
              fields: [
                {
                  id: 'payout-iban-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_iban',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-bic',
              text: 'BIC: {volunteerBic}',
              fields: [
                {
                  id: 'payout-bic-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_bic',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
          ],
        },
        {
          kind: 'text',
          id: 'sonstiges',
          title: 'Sonstiges',
          locked: false,
          enabled: false,
          lines: [
            {
              id: 'freeform',
              text: '{freeformText}',
              fields: [
                {
                  id: 'freeform-text',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
      ],
      footer: {
        closingLine: {
          id: 'closing',
          text: '{place}, {date}',
          fields: [
            {
              id: 'closing-place',
              value: {
                kind: 'bound',
                source: 'org_city',
              },
            },
            {
              id: 'closing-date',
              value: {
                kind: 'bound',
                source: 'generated_date',
              },
            },
          ],
          optional: false,
          enabled: true,
        },
        showSignatures: true,
      },
      pageFooter: {
        enabled: false,
        text: '',
      },
    },
    uebungsleiter: {
      header: {
        titleLines: [
          'Zusatzvereinbarung zur',
          'Aufwandsentschädigung gemäß § 3 Nr. 26 EStG (Übungsleiterpauschale)',
        ],
        metaLines: [],
      },
      blocks: [
        {
          kind: 'text',
          id: 'persoenliche-daten',
          title: '',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'parties',
              text: 'Zwischen dem {orgName}, {orgStreet}, {orgZip} {orgCity}',
              fields: [
                {
                  id: 'parties-org-name',
                  value: {
                    kind: 'bound',
                    source: 'org_name',
                  },
                },
                {
                  id: 'parties-org-street',
                  value: {
                    kind: 'bound',
                    source: 'org_street',
                  },
                },
                {
                  id: 'parties-org-zip',
                  value: {
                    kind: 'bound',
                    source: 'org_zip',
                  },
                },
                {
                  id: 'parties-org-city',
                  value: {
                    kind: 'bound',
                    source: 'org_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'parties-additional',
              text: ', {additionalInfo}',
              fields: [
                {
                  id: 'parties-additional-info',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: true,
              enabled: false,
              inline: true,
            },
            {
              id: 'volunteer-name',
              text: 'und {volunteerFirstName} {volunteerLastName},',
              fields: [
                {
                  id: 'volunteer-name-first',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_first_name',
                  },
                },
                {
                  id: 'volunteer-name-last',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_last_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-address',
              text: 'wohnhaft in {volunteerStreet}, {volunteerZip} {volunteerCity}',
              fields: [
                {
                  id: 'volunteer-street-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_street',
                  },
                },
                {
                  id: 'volunteer-zip-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_zip',
                  },
                },
                {
                  id: 'volunteer-city-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-dob',
              text: 'geboren am {volunteerDob}',
              fields: [
                {
                  id: 'volunteer-dob-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_dob',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
            {
              id: 'parties-closing',
              text: 'im Folgenden „ehrenamtlich tätige Person" genannt, wird Folgendes vereinbart:',
              fields: [],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'zeitraum-taetigkeit',
          title: 'Zeitraum und ehrenamtliche Tätigkeit',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'engagement-scope',
              text: 'Die ehrenamtlich tätige Person übt im Zeitraum {contractLifespan} für die Einrichtung {orgName} eine nebenberufliche Tätigkeit aus.',
              fields: [
                {
                  id: 'contract-lifespan',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'period',
                },
                {
                  id: 'engagement-org-name',
                  value: {
                    kind: 'bound',
                    source: 'org_facility_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'engagement-tasks',
              text: 'Im Rahmen des steuerbegünstigten Zwecks einer gemeinnützigen Organisation ist die Person mit folgenden Tätigkeiten ehrenamtlich tätig: {tasks}',
              fields: [
                {
                  id: 'tasks',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'freiwillige-stunden',
          title: '',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'hours-scope',
              text: 'Zeitraum: {contractLifespan}  Stundenzahl pro {hoursUnit}: in der Regel {hoursAmount}',
              fields: [
                {
                  id: 'contract-lifespan',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'period',
                },
                {
                  id: 'hours-unit',
                  value: {
                    kind: 'manual-template',
                    value: 'Monat',
                  },
                  control: 'unit-tabs',
                },
                {
                  id: 'hours-amount',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'number',
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'hours-confirmation',
              text: 'Die ehrenamtlich tätige Person bestätigt, dass der zeitliche Umfang der Tätigkeit (ggf. unter Berücksichtigung weiterer gleichartiger Tätigkeiten), bezogen auf das Kalenderjahr, höchstens ein Drittel der Arbeitszeit bei Vollbeschäftigung beträgt.',
              fields: [],
              optional: false,
              enabled: true,
            },
          ],
        },
        {
          kind: 'text',
          id: 'aufwandsentschaedigung',
          title: 'Aufwandsentschädigung',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'rate',
              text: 'Als Aufwandsentschädigung erhält die ehrenamtlich tätige Person {rate} € pro Stunde.',
              fields: [
                {
                  id: 'rate-field',
                  value: {
                    kind: 'bound',
                    source: 'hourly_rate',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-intro',
              text: 'Die Aufwandsentschädigung wird monatlich auf folgendes Konto überwiesen:',
              fields: [],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-holder',
              text: 'Kontoinhaber:in: {volunteerAccountHolder}',
              fields: [
                {
                  id: 'payout-holder-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_account_holder',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-iban',
              text: 'IBAN: {volunteerIban}',
              fields: [
                {
                  id: 'payout-iban-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_iban',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-bic',
              text: 'BIC: {volunteerBic}',
              fields: [
                {
                  id: 'payout-bic-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_bic',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
          ],
        },
        {
          kind: 'text',
          id: 'sonstiges',
          title: 'Sonstiges',
          locked: false,
          enabled: false,
          lines: [
            {
              id: 'freeform',
              text: '{freeformText}',
              fields: [
                {
                  id: 'freeform-text',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
      ],
      footer: {
        closingLine: {
          id: 'closing',
          text: '{place}, {date}',
          fields: [
            {
              id: 'closing-place',
              value: {
                kind: 'bound',
                source: 'org_city',
              },
            },
            {
              id: 'closing-date',
              value: {
                kind: 'bound',
                source: 'generated_date',
              },
            },
          ],
          optional: false,
          enabled: true,
        },
        showSignatures: true,
      },
      pageFooter: {
        enabled: false,
        text: '',
      },
    },
  },
  invoice: {
    ehrenamt: {
      header: {
        titleLines: ['Stundennachweis Ehrenamtspauschale'],
        metaLines: [
          {
            id: 'meta-invoice-number',
            text: 'Rechnungsnummer: {documentNumber}',
            fields: [
              {
                id: 'meta-invoice-number-field',
                value: {
                  kind: 'bound',
                  source: 'document_number',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
          {
            id: 'meta-date',
            text: 'Datum: {date}',
            fields: [
              {
                id: 'meta-date-field',
                value: {
                  kind: 'bound',
                  source: 'generated_date',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
          {
            id: 'meta-kostenstelle',
            text: 'Kostenstelle: {kostenstelle}',
            fields: [
              {
                id: 'kostenstelle',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
          {
            id: 'meta-kostentraeger',
            text: 'Kostenträger: {kostentraeger}',
            fields: [
              {
                id: 'kostentraeger',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
          {
            id: 'meta-rechtstraeger',
            text: 'Rechtsträger: {rechtstraeger}',
            fields: [
              {
                id: 'rechtstraeger',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
        ],
      },
      blocks: [
        {
          kind: 'text',
          id: 'persoenliche-daten',
          title: 'Persönliche Daten',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'volunteer-name',
              text: '{volunteerFirstName} {volunteerLastName}',
              fields: [
                {
                  id: 'volunteer-name-first',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_first_name',
                  },
                },
                {
                  id: 'volunteer-name-last',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_last_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-street',
              text: '{volunteerStreet}',
              fields: [
                {
                  id: 'volunteer-street-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_street',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-addr',
              text: '{volunteerZip} {volunteerCity}',
              fields: [
                {
                  id: 'volunteer-zip-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_zip',
                  },
                },
                {
                  id: 'volunteer-city-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-holder',
              text: 'Kontoinhaber:in: {volunteerAccountHolder}',
              fields: [
                {
                  id: 'payout-holder-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_account_holder',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-iban',
              text: 'IBAN: {volunteerIban}',
              fields: [
                {
                  id: 'volunteer-iban-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_iban',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-bic',
              text: 'BIC: {volunteerBic}',
              fields: [
                {
                  id: 'volunteer-bic-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_bic',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
          ],
        },
        {
          kind: 'table',
          id: 'stundennachweis',
          title: 'Stundennachweis',
          locked: true,
          columns: [
            'Tätigkeit',
            'Beginn',
            'Ende',
            'Stunden gesamt',
            '€/h',
            'Betrag',
          ],
          previewRowCount: 10,
          firstColumnSource: 'shift_name',
          firstColumnCustomLabel: '',
        },
        {
          kind: 'note',
          id: 'jahresdeckel-hinweis',
          title: 'Bereits erhaltene Zahlungen',
          locked: true,
          line: {
            id: 'jahresdeckel-hinweis-line',
            text: '{volunteerFirstName} {volunteerLastName} hat im Zeitraum {alreadyReceivedPeriod} bereits {alreadyReceivedAmount} vom Jahresfreibetrag in Höhe von {yearlyLimitAmount} erhalten.',
            fields: [
              {
                id: 'jahresdeckel-volunteer-first',
                value: {
                  kind: 'bound',
                  source: 'volunteer_first_name',
                },
              },
              {
                id: 'jahresdeckel-volunteer-last',
                value: {
                  kind: 'bound',
                  source: 'volunteer_last_name',
                },
              },
              {
                id: 'jahresdeckel-period',
                value: {
                  kind: 'bound',
                  source: 'already_received_period',
                },
              },
              {
                id: 'jahresdeckel-received',
                value: {
                  kind: 'bound',
                  source: 'already_received_amount',
                },
              },
              {
                id: 'jahresdeckel-limit',
                value: {
                  kind: 'bound',
                  source: 'yearly_limit_amount',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
        },
        {
          kind: 'text',
          id: 'sonstiges',
          title: 'Sonstiges',
          locked: false,
          enabled: false,
          lines: [
            {
              id: 'freeform',
              text: '{freeformText}',
              fields: [
                {
                  id: 'freeform-text',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
      ],
      footer: {
        closingLine: {
          id: 'closing',
          text: '{place}, {date}',
          fields: [
            {
              id: 'closing-place',
              value: {
                kind: 'bound',
                source: 'org_city',
              },
            },
            {
              id: 'closing-date',
              value: {
                kind: 'bound',
                source: 'generated_date',
              },
            },
          ],
          optional: false,
          enabled: true,
        },
        showSignatures: true,
      },
      pageFooter: {
        enabled: false,
        text: '',
      },
      invoiceNumberFormat: 'date-number',
    },
    uebungsleiter: {
      header: {
        titleLines: ['Stundennachweis Übungsleiterpauschale'],
        metaLines: [
          {
            id: 'meta-invoice-number',
            text: 'Rechnungsnummer: {documentNumber}',
            fields: [
              {
                id: 'meta-invoice-number-field',
                value: {
                  kind: 'bound',
                  source: 'document_number',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
          {
            id: 'meta-date',
            text: 'Datum: {date}',
            fields: [
              {
                id: 'meta-date-field',
                value: {
                  kind: 'bound',
                  source: 'generated_date',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
          {
            id: 'meta-kostenstelle',
            text: 'Kostenstelle: {kostenstelle}',
            fields: [
              {
                id: 'kostenstelle',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
          {
            id: 'meta-kostentraeger',
            text: 'Kostenträger: {kostentraeger}',
            fields: [
              {
                id: 'kostentraeger',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
          {
            id: 'meta-rechtstraeger',
            text: 'Rechtsträger: {rechtstraeger}',
            fields: [
              {
                id: 'rechtstraeger',
                value: {
                  kind: 'manual-template',
                  value: '',
                },
              },
            ],
            optional: true,
            enabled: false,
          },
        ],
      },
      blocks: [
        {
          kind: 'text',
          id: 'persoenliche-daten',
          title: 'Persönliche Daten',
          locked: true,
          enabled: true,
          lines: [
            {
              id: 'volunteer-name',
              text: '{volunteerFirstName} {volunteerLastName}',
              fields: [
                {
                  id: 'volunteer-name-first',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_first_name',
                  },
                },
                {
                  id: 'volunteer-name-last',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_last_name',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-street',
              text: '{volunteerStreet}',
              fields: [
                {
                  id: 'volunteer-street-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_street',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-addr',
              text: '{volunteerZip} {volunteerCity}',
              fields: [
                {
                  id: 'volunteer-zip-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_zip',
                  },
                },
                {
                  id: 'volunteer-city-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_city',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'payout-holder',
              text: 'Kontoinhaber:in: {volunteerAccountHolder}',
              fields: [
                {
                  id: 'payout-holder-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_account_holder',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-iban',
              text: 'IBAN: {volunteerIban}',
              fields: [
                {
                  id: 'volunteer-iban-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_iban',
                  },
                },
              ],
              optional: false,
              enabled: true,
            },
            {
              id: 'volunteer-bic',
              text: 'BIC: {volunteerBic}',
              fields: [
                {
                  id: 'volunteer-bic-field',
                  value: {
                    kind: 'bound',
                    source: 'volunteer_bic',
                  },
                },
              ],
              optional: true,
              enabled: false,
            },
          ],
        },
        {
          kind: 'table',
          id: 'stundennachweis',
          title: 'Stundennachweis',
          locked: true,
          columns: [
            'Tätigkeit',
            'Beginn',
            'Ende',
            'Stunden gesamt',
            '€/h',
            'Betrag',
          ],
          previewRowCount: 10,
          firstColumnSource: 'shift_name',
          firstColumnCustomLabel: '',
        },
        {
          kind: 'note',
          id: 'jahresdeckel-hinweis',
          title: 'Bereits erhaltene Zahlungen',
          locked: true,
          line: {
            id: 'jahresdeckel-hinweis-line',
            text: '{volunteerFirstName} {volunteerLastName} hat im Zeitraum {alreadyReceivedPeriod} bereits {alreadyReceivedAmount} vom Jahresfreibetrag in Höhe von {yearlyLimitAmount} erhalten.',
            fields: [
              {
                id: 'jahresdeckel-volunteer-first',
                value: {
                  kind: 'bound',
                  source: 'volunteer_first_name',
                },
              },
              {
                id: 'jahresdeckel-volunteer-last',
                value: {
                  kind: 'bound',
                  source: 'volunteer_last_name',
                },
              },
              {
                id: 'jahresdeckel-period',
                value: {
                  kind: 'bound',
                  source: 'already_received_period',
                },
              },
              {
                id: 'jahresdeckel-received',
                value: {
                  kind: 'bound',
                  source: 'already_received_amount',
                },
              },
              {
                id: 'jahresdeckel-limit',
                value: {
                  kind: 'bound',
                  source: 'yearly_limit_amount',
                },
              },
            ],
            optional: false,
            enabled: true,
          },
        },
        {
          kind: 'text',
          id: 'sonstiges',
          title: 'Sonstiges',
          locked: false,
          enabled: false,
          lines: [
            {
              id: 'freeform',
              text: '{freeformText}',
              fields: [
                {
                  id: 'freeform-text',
                  value: {
                    kind: 'manual-template',
                    value: '',
                  },
                  control: 'textarea',
                },
              ],
              optional: false,
              enabled: true,
            },
          ],
        },
      ],
      footer: {
        closingLine: {
          id: 'closing',
          text: '{place}, {date}',
          fields: [
            {
              id: 'closing-place',
              value: {
                kind: 'bound',
                source: 'org_city',
              },
            },
            {
              id: 'closing-date',
              value: {
                kind: 'bound',
                source: 'generated_date',
              },
            },
          ],
          optional: false,
          enabled: true,
        },
        showSignatures: true,
      },
      pageFooter: {
        enabled: false,
        text: '',
      },
      invoiceNumberFormat: 'date-number',
    },
  },
};
