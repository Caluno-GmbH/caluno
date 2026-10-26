import { Injectable } from '@nestjs/common';
import type { Database } from '../../database/database.module';
import {
  BadRequestGraphQLError,
  ConflictGraphQLError,
} from '../../graphql/errors';
import {
  POSTHOG_EVENT,
  POSTHOG_SURFACE,
} from '../../shared/observability/posthog.events';
import { PostHogService } from '../../shared/observability/posthog.service';

@Injectable()
export class RequiredFormWriteSupport {
  constructor(private readonly postHogService: PostHogService) {}

  async verifyFormsHaveBlocks(
    formIds: string[],
    runner: Database,
  ): Promise<void> {
    const uniqueFormIds = [...new Set(formIds)];
    if (uniqueFormIds.length === 0) {
      return;
    }

    const refs = await runner.query.requirementFormBlockRefs.findMany({
      where: { formId: { in: uniqueFormIds } },
      columns: { formId: true },
    });

    const formsWithBlocks = new Set(refs.map((ref) => ref.formId));
    if (formsWithBlocks.size !== uniqueFormIds.length) {
      throw new BadRequestGraphQLError(
        'One or more forms do not contain any blocks',
      );
    }
  }

  async assertFormsBelongToOrganization(
    formIds: string[],
    organizationId: string,
    runner: Database,
  ): Promise<void> {
    if (formIds.length === 0) {
      return;
    }

    const forms = await runner.query.requirementForms.findMany({
      where: { id: { in: formIds }, organizationId },
    });

    if (forms.length !== formIds.length) {
      throw new ConflictGraphQLError(
        'One or more forms do not belong to this organization',
      );
    }

    await this.verifyFormsHaveBlocks(formIds, runner);
  }

  captureRequiredFormUpdate(
    userId: string | undefined,
    properties: {
      organization_id: string;
      organization_unit_id?: string;
      target_type: string;
      shift_id?: string;
      event_id?: string;
      shift_instance_id?: string;
    },
  ): void {
    if (!userId) {
      return;
    }
    this.postHogService.capture({
      event: POSTHOG_EVENT.REQUIRED_FORM_UPDATE,
      userId,
      properties: {
        surface: POSTHOG_SURFACE.BACKOFFICE,
        ...properties,
      },
    });
  }
}
