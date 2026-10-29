import { describe, expect, it } from 'bun:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationInput } from './create-organization.input';

const check = async (input: Record<string, unknown>) => {
  const dto = plainToInstance(CreateOrganizationInput, input);
  return { dto, errors: await validate(dto) };
};

describe('CreateOrganizationInput', () => {
  it('accepts a non-empty name and trims surrounding whitespace', async () => {
    const { dto, errors } = await check({ name: '  Acme Volunteers  ' });
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Acme Volunteers');
  });

  it('rejects a blank or whitespace-only name', async () => {
    for (const name of ['', '   ', '\t\n']) {
      const { errors } = await check({ name });
      expect(errors.map((e) => e.property)).toEqual(['name']);
    }
  });

  it('rejects a missing name', async () => {
    const { errors } = await check({});
    expect(errors.map((e) => e.property)).toEqual(['name']);
  });
});
