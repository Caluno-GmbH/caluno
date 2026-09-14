import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import { UserProfileService } from '../../requirement-profile/services/user-profile.service';
import {
  type ResolvedOrgProfile,
  resolveOrgProfile,
} from '../utils/org-profile';
import {
  type TemplateBodyShape as BodyShape,
  type TemplateLineShape as LineShape,
  ORG_SOURCE_TO_ORG_COLUMN,
  PROFILE_SOURCE_TO_PROFILE_KEY,
  REQUIRED_ORG_PROFILE_SOURCES,
} from './document-template.types';

/** A value counts as "missing" when it is not a non-blank string. */
const isMissingString = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';

/**
 * Computes which of the profile-required data sources a document's template
 * actually uses (on enabled lines) and whether the volunteer's profile is
 * missing any of them. Shared by the sign gate (Block: don't let a document be
 * signed with gaps) and the GraphQL `missingProfileFields` resolver that lets
 * the volunteer card surface a "complete your profile" call to action.
 */
@Injectable()
export class DocumentProfileRequirementService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly userProfileService: UserProfileService,
  ) {}

  /** The profile-required DataSourceKeys the template binds on enabled lines. */
  requiredProfileSources(body: unknown): string[] {
    const template = (body ?? {}) as BodyShape;
    const sources = new Set<string>();

    const collectLine = (line: LineShape | undefined) => {
      if (!line || line.enabled === false) return;
      for (const field of line.fields ?? []) {
        if (
          field.value.kind === 'bound' &&
          field.value.source in PROFILE_SOURCE_TO_PROFILE_KEY
        ) {
          sources.add(field.value.source);
        }
      }
    };

    collectLine(template.header?.orgIdentityLine);
    for (const metaLine of template.header?.metaLines ?? []) {
      collectLine(metaLine);
    }
    for (const block of template.blocks ?? []) {
      if (block.enabled === false) continue;
      collectLine(block.line);
      for (const line of block.lines ?? []) collectLine(line);
    }
    collectLine(template.footer?.closingLine);

    return [...sources];
  }

  /**
   * The profile-required source keys the document needs that the volunteer has
   * not yet supplied. Empty when the document is ready to be signed.
   */
  async missingProfileSources(
    volunteerId: string,
    templateBody: unknown,
  ): Promise<string[]> {
    const required = this.requiredProfileSources(templateBody);
    if (required.length === 0) return [];
    const profile = await this.userProfileService.findByUserId(volunteerId);
    const data = (profile?.data ?? {}) as Record<string, unknown>;

    return required.filter((source) => {
      const key = PROFILE_SOURCE_TO_PROFILE_KEY[source];
      return isMissingString(data[key]);
    });
  }

  private requiredOrgSources(body: unknown): string[] {
    const template = (body ?? {}) as BodyShape;
    const sources = new Set<string>();

    const collectLine = (line: LineShape | undefined) => {
      if (!line || line.enabled === false) return;
      for (const field of line.fields ?? []) {
        if (
          field.value.kind === 'bound' &&
          field.value.source in ORG_SOURCE_TO_ORG_COLUMN
        ) {
          sources.add(field.value.source);
        }
      }
    };

    collectLine(template.header?.orgIdentityLine);
    for (const metaLine of template.header?.metaLines ?? []) {
      collectLine(metaLine);
    }
    for (const block of template.blocks ?? []) {
      if (block.enabled === false) continue;
      collectLine(block.line);
      for (const line of block.lines ?? []) collectLine(line);
    }
    collectLine(template.footer?.closingLine);

    return [...sources];
  }

  /**
   * The org-profile source keys (e.g. org_city/org_address) a document's
   * template needs that the given org unit has not yet supplied. Pure and
   * synchronous so callers that already have the unit (e.g. a batched
   * DataLoader) can skip the extra per-row query in `missingOrgProfileSources`.
   */
  missingOrgProfileSourcesForUnit(
    unit: Record<string, unknown> | undefined,
    templateBody: unknown,
  ): string[] {
    const required = this.requiredOrgSources(templateBody);
    if (required.length === 0) return [];
    if (!unit) return [];

    return required.filter((source) => {
      const column = ORG_SOURCE_TO_ORG_COLUMN[source];
      if (column === 'name') return false; // always present
      return isMissingString(unit[column]);
    });
  }

  /**
   * The org details a document for this unit renders (the org root when no
   * unit is given), with blank fields inherited from the nearest parent unit.
   * See resolveOrgProfile.
   */
  resolveOrgProfile(
    organizationId: string,
    organizationUnitId: string | null | undefined,
  ): Promise<ResolvedOrgProfile | undefined> {
    return resolveOrgProfile(this.db, organizationId, organizationUnitId);
  }

  /**
   * The org-profile source keys (e.g. org_city/org_address) a document's
   * template needs that the unit's resolved org details don't supply. Empty
   * when the document can be created.
   */
  async missingOrgProfileSources(
    organizationId: string,
    organizationUnitId: string | null | undefined,
    templateBody: unknown,
  ): Promise<string[]> {
    if (this.requiredOrgSources(templateBody).length === 0) return [];
    const profile = await this.resolveOrgProfile(
      organizationId,
      organizationUnitId,
    );
    return this.missingOrgProfileSourcesForUnit(
      profile as unknown as Record<string, unknown> | undefined,
      templateBody,
    );
  }

  /**
   * The baseline org-profile source keys (the ones every shipped preset
   * binds) that the given unit (or the org's root unit, when none is given)
   * has not yet supplied. Used by Gate A to answer "is this org ready to
   * author templates at all?" before any template body exists.
   */
  async missingBaselineOrgProfileSources(
    organizationId: string,
    organizationUnitId: string | null | undefined,
  ): Promise<string[]> {
    const profile = await this.resolveOrgProfile(
      organizationId,
      organizationUnitId,
    );
    const record = profile as unknown as Record<string, unknown> | undefined;
    // `org_name` maps to `name`, which is always present, so it never appears
    // as missing — keep the no-unit fallback consistent with that.
    if (!record) {
      return REQUIRED_ORG_PROFILE_SOURCES.filter((s) => s !== 'org_name');
    }

    return REQUIRED_ORG_PROFILE_SOURCES.filter((source) => {
      const column = ORG_SOURCE_TO_ORG_COLUMN[source];
      if (column === 'name') return false; // always present
      return isMissingString(record[column]);
    });
  }
}
