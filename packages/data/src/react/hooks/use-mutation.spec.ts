import { describe, expect, it, mock } from 'bun:test';
import type { MutationFunctionContext } from '@tanstack/react-query';
import { skipRedirectCallbacks } from './use-mutation';

const redirect = { digest: 'NEXT_REDIRECT;replace;/en/login;307;' };
const context = {} as MutationFunctionContext;

describe('skipRedirectCallbacks', () => {
  it('skips onError and onSettled for a redirect', () => {
    const onError = mock(() => {});
    const onSettled = mock(() => {});
    const options = skipRedirectCallbacks<unknown, unknown, void, unknown>({
      onError,
      onSettled,
    });

    options?.onError?.(redirect, undefined, undefined, context);
    options?.onSettled?.(undefined, redirect, undefined, undefined, context);

    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('passes any other error through', () => {
    const onError = mock(() => {});
    const onSettled = mock(() => {});
    const onSuccess = mock(() => {});
    const error = new Error('Forbidden');
    const options = skipRedirectCallbacks<unknown, unknown, void, unknown>({
      onError,
      onSettled,
      onSuccess,
    });

    options?.onError?.(error, undefined, undefined, context);
    options?.onSettled?.(undefined, error, undefined, undefined, context);

    expect(onError).toHaveBeenCalledWith(error, undefined, undefined, context);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(options?.onSuccess).toBe(onSuccess);
  });

  it('leaves missing options alone', () => {
    expect(skipRedirectCallbacks(undefined)).toBeUndefined();
  });
});
