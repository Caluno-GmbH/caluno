import { type Database } from './fixture-helpers';
import * as schema from './schema';

type FormBlock = typeof schema.formBlocks.$inferSelect;

/**
 * Form blocks are organization-scoped, but the forms referencing them can be
 * unit-scoped. When a unit (and with it a form) is deleted, the block survives
 * — so this must reuse it instead of colliding on (organization_id, title).
 *
 * A new block and its fields are written in one transaction so a failed run
 * cannot leave an empty block behind. An existing block that has fields is
 * returned untouched (`created: false`): admins may have edited it, and this
 * runs on every deploy. A block with no fields at all is broken whoever left
 * it (older seeds were not atomic), so it is populated and reported as
 * `created: true`.
 */
export const ensureFormBlock = async (
  db: Database,
  input: {
    organizationId: string;
    title: string;
    description: string;
    createdById: string;
    fields: Array<Omit<typeof schema.formBlockFields.$inferInsert, 'blockId'>>;
  },
): Promise<{ block: FormBlock; created: boolean }> => {
  const where = { organizationId: input.organizationId, title: input.title };

  const existing = await db.query.formBlocks.findFirst({ where });
  if (existing) {
    const hasFields = await db.query.formBlockFields.findFirst({
      where: { blockId: existing.id },
    });
    if (hasFields) {
      return { block: existing, created: false };
    }

    await db
      .insert(schema.formBlockFields)
      .values(
        input.fields.map((field) => ({ ...field, blockId: existing.id })),
      );
    return { block: existing, created: true };
  }

  const created = await db.transaction(async (tx) => {
    const [block] = await tx
      .insert(schema.formBlocks)
      .values({
        organizationId: input.organizationId,
        title: input.title,
        description: input.description,
        required: true,
        createdBy: input.createdById,
        updatedBy: input.createdById,
      })
      .onConflictDoNothing()
      .returning();

    if (!block) {
      return undefined;
    }

    await tx
      .insert(schema.formBlockFields)
      .values(input.fields.map((field) => ({ ...field, blockId: block.id })));

    return block;
  });

  if (created) {
    return { block: created, created: true };
  }

  // A concurrent seed may have won the insert; adopt its block.
  const raced = await db.query.formBlocks.findFirst({ where });
  if (!raced) {
    throw new Error(`Failed to create form block: ${input.title}`);
  }

  return { block: raced, created: false };
};

/**
 * Links a block to a form. `fresh` says this run created the form or the
 * block, so the link is ours to add. Otherwise it is only added to a form with
 * no blocks at all — an empty form is broken, whereas a form that has blocks
 * may have been rearranged by an admin and is left alone.
 */
export const ensureFormBlockRef = async (
  db: Database,
  ref: typeof schema.requirementFormBlockRefs.$inferInsert,
  { fresh }: { fresh: boolean },
): Promise<void> => {
  if (!fresh) {
    const formHasBlocks = await db.query.requirementFormBlockRefs.findFirst({
      where: { formId: ref.formId },
    });
    if (formHasBlocks) {
      return;
    }
  }

  const linked = await db.query.requirementFormBlockRefs.findFirst({
    where: { formId: ref.formId, blockId: ref.blockId },
  });

  if (!linked) {
    await db.insert(schema.requirementFormBlockRefs).values(ref);
  }
};
