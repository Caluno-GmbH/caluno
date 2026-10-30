import { Args, Context, ID, Query, Resolver } from '@nestjs/graphql';
import { PERMISSIONS } from '../../auth/constants';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { BadRequestGraphQLError } from '../../graphql/errors';
import type { AuthenticatedGraphQLContext } from '../../graphql/graphql.context';
import { DocumentKind } from '../enums';
import { DocumentTemplateMapper } from '../mappers';
import { DocumentTemplate } from '../models/document-template.model';
import {
  AccountingOrgAccessService,
  AccountingScopeService,
  DocumentTemplateService,
} from '../services';

@Resolver(() => DocumentTemplate)
export class DocumentTemplateQueryResolver {
  constructor(
    private readonly documentTemplateService: DocumentTemplateService,
    private readonly documentTemplateMapper: DocumentTemplateMapper,
    private readonly accountingOrgAccessService: AccountingOrgAccessService,
    private readonly accountingScopeService: AccountingScopeService,
  ) {}

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => [DocumentTemplate])
  async documentTemplates(
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<DocumentTemplate[]> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    const templates =
      await this.documentTemplateService.findDocumentTemplates(organizationId);
    const readable = await this.accountingScopeService.filterReadable(
      context.organizationUnitId,
      templates,
    );
    return this.documentTemplateMapper.toArray(readable);
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => DocumentTemplate)
  async documentTemplate(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<DocumentTemplate> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    const template = await this.documentTemplateService.findDocumentTemplate(
      organizationId,
      id,
    );
    await this.accountingScopeService.assertCanRead(
      context.organizationUnitId,
      template,
      'Document template not found',
    );
    return this.documentTemplateMapper.toModelOrThrow(template);
  }

  @Permissions(PERMISSIONS.ACCOUNTING_MANAGE)
  @Query(() => DocumentTemplate)
  async activeDocumentTemplate(
    @Args('reimbursementTypeId', { type: () => ID })
    reimbursementTypeId: string,
    @Args('kind', { type: () => DocumentKind }) kind: DocumentKind,
    @Args('organizationUnitId', { type: () => ID, nullable: true })
    organizationUnitId: string | null | undefined,
    @Context() context: AuthenticatedGraphQLContext,
  ): Promise<DocumentTemplate> {
    const organizationId =
      await this.accountingOrgAccessService.resolveEnabledOrganizationId(
        context.organizationUnitId,
      );
    if (organizationUnitId === '') {
      throw new BadRequestGraphQLError('organizationUnitId must not be empty');
    }
    if (organizationUnitId) {
      await this.accountingScopeService.assertUnitReadable(
        context.organizationUnitId,
        organizationUnitId,
        'Organization unit not found',
      );
    }
    const template = await this.documentTemplateService.findActiveTemplate(
      organizationId,
      reimbursementTypeId,
      kind,
      organizationUnitId ?? context.organizationUnitId,
    );
    return this.documentTemplateMapper.toModelOrThrow(template);
  }
}
