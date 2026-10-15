import { describe, expect, it } from 'bun:test';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AccountingController } from '../src/accounting/accounting.controller';
import type { DownloadBundleQueryDto } from '../src/accounting/dto/download-bundle-query.dto';
import type { AccountingOrgAccessService } from '../src/accounting/services';
import type { BundleDownloadService } from '../src/accounting/services/bundle-download.service';
import {
  ForbiddenGraphQLError,
  NotFoundGraphQLError,
} from '../src/graphql/errors';

const session = { user: { id: 'user-1' } } as UserSession;
const query = {
  volunteerId: crypto.randomUUID(),
  reimbursementTypeId: crypto.randomUUID(),
} as DownloadBundleQueryDto;

const controllerWith = (access: () => Promise<string>) =>
  new AccountingController(
    {
      buildAndRecord: async () => ({
        buffer: Buffer.from('zip'),
        zipName: 'Abrechnung.zip',
      }),
    } as unknown as BundleDownloadService,
    {
      resolveEnabledOrganizationId: access,
    } as unknown as AccountingOrgAccessService,
  );

describe('AccountingController bundle download errors', () => {
  it('answers a missing unit with a 400', async () => {
    const controller = controllerWith(async () => 'org');
    await expect(
      controller.downloadBundle(session, undefined, query),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers accounting being disabled with a 403', async () => {
    const controller = controllerWith(async () => {
      throw new ForbiddenGraphQLError('Accounting is not enabled');
    });
    await expect(
      controller.downloadBundle(session, 'unit', query),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('answers an unknown unit with a 404', async () => {
    const controller = controllerWith(async () => {
      throw new NotFoundGraphQLError('Organization not found');
    });
    await expect(
      controller.downloadBundle(session, 'unit', query),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('leaves other errors alone', async () => {
    const boom = new Error('db down');
    const controller = controllerWith(async () => {
      throw boom;
    });
    await expect(
      controller.downloadBundle(session, 'unit', query),
    ).rejects.toBe(boom);
  });
});
