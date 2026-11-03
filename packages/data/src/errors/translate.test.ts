import { describe, expect, it } from 'bun:test';
import { ClientError } from 'graphql-request';
import { DataError } from './data-error';
import { createSdkErrorWrapper, fromGraphQLError } from './translate';

// Shaped exactly like the response graphql-request wraps in a ClientError when
// the backend throws a NotFoundGraphQLError (see document-template.service.ts).
const notFoundResponse = {
  data: null,
  errors: [
    {
      message: 'No contract template configured for reimbursement type type-1',
      locations: [{ line: 2, column: 3 }],
      path: ['activeDocumentTemplate'],
      extensions: { code: 'NOT_FOUND' },
    },
  ],
  status: 200,
};

const clientError = () =>
  new ClientError(notFoundResponse as never, {} as never);

describe('fromGraphQLError', () => {
  it('extracts the domain message and code from a graphql-request ClientError', () => {
    const dataError = fromGraphQLError(clientError());

    expect(dataError).toBeInstanceOf(DataError);
    expect(dataError.message).toBe(
      'No contract template configured for reimbursement type type-1',
    );
    expect(dataError.options?.code).toBe('NOT_FOUND');
  });

  it('returns the same DataError when one is passed through again', () => {
    // The React SDK wrapper and the server DataClient both translate; double
    // translation must not clobber an already-clean message.
    const original = new DataError('already translated', { code: 'NOT_FOUND' });
    expect(fromGraphQLError(original)).toBe(original);
  });

  it('preserves a duck-typed DataError across dual-package copies', () => {
    class OtherDataError extends Error {
      name = 'DataError';
      constructor(
        message: string,
        public readonly options?: { code?: string },
      ) {
        super(message);
      }
    }
    const other = new OtherDataError('Unauthorized', {
      code: 'UNAUTHENTICATED',
    });
    expect(other instanceof DataError).toBe(false);
    expect(fromGraphQLError(other)).toBe(other);
    expect(fromGraphQLError(other).options?.code).toBe('UNAUTHENTICATED');
  });
});

describe('createSdkErrorWrapper', () => {
  it('propagates onError throws instead of replacing with DataError', async () => {
    const redirect = new Error('NEXT_REDIRECT:/login');
    const wrapper = createSdkErrorWrapper(() => {
      throw redirect;
    });

    await expect(
      wrapper(
        async () => {
          throw clientError();
        },
        'GetActiveDocumentTemplate',
        'query',
      ),
    ).rejects.toBe(redirect);
  });

  it('rethrows a failed call as DataError, not the raw ClientError', async () => {
    const wrapper = createSdkErrorWrapper();

    let caught: unknown;
    try {
      await wrapper(
        async () => {
          throw clientError();
        },
        'GetActiveDocumentTemplate',
        'query',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DataError);
    expect((caught as DataError).message).toBe(
      'No contract template configured for reimbursement type type-1',
    );
    expect((caught as DataError).options?.code).toBe('NOT_FOUND');
  });

  it('notifies onError with the translated error', async () => {
    const seen: DataError[] = [];
    const wrapper = createSdkErrorWrapper((error) => seen.push(error));

    await wrapper(
      async () => {
        throw clientError();
      },
      'GetActiveDocumentTemplate',
      'query',
    ).catch(() => {});

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(DataError);
  });

  it('passes a successful call through unchanged', async () => {
    const wrapper = createSdkErrorWrapper();
    const result = await wrapper(
      async () => ({ ok: true }),
      'GetActiveDocumentTemplate',
      'query',
    );
    expect(result).toEqual({ ok: true });
  });
});
