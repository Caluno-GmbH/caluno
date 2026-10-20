import { describe, expect, it } from 'bun:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationUnitInput } from './create-organization-unit.input';
import { UpdateOrganizationUnitInput } from './update-organization-unit.input';

const orgId = () => crypto.randomUUID();

const checkCreate = async (input: Record<string, unknown>) => {
  const dto = plainToInstance(CreateOrganizationUnitInput, input);
  return { dto, errors: await validate(dto) };
};

const checkUpdate = async (input: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateOrganizationUnitInput, input);
  return { dto, errors: await validate(dto) };
};

describe('CreateOrganizationUnitInput', () => {
  it('accepts a non-empty name and trims surrounding whitespace', async () => {
    const { dto, errors } = await checkCreate({
      organizationId: orgId(),
      parentId: orgId(),
      typeId: orgId(),
      name: '  Nord  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Nord');
  });

  it('rejects a blank or whitespace-only name', async () => {
    for (const name of ['', '   ', '\t\n']) {
      const { errors } = await checkCreate({
        organizationId: orgId(),
        parentId: orgId(),
        typeId: orgId(),
        name,
      });
      expect(errors.map((e) => e.property)).toContain('name');
    }
  });
});

describe('UpdateOrganizationUnitInput', () => {
  it('allows omitting name', async () => {
    const { errors } = await checkUpdate({ organizationId: orgId() });
    expect(errors.map((e) => e.property)).not.toContain('name');
  });

  it('trims a provided name', async () => {
    const { dto, errors } = await checkUpdate({
      organizationId: orgId(),
      name: '  Süd  ',
    });
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Süd');
  });

  it('rejects a blank or whitespace-only name when provided', async () => {
    for (const name of ['', '   ', '\t\n']) {
      const { errors } = await checkUpdate({
        organizationId: orgId(),
        name,
      });
      expect(errors.map((e) => e.property)).toContain('name');
    }
  });
});
