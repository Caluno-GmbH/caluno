import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ForbiddenGraphQLError } from '../../graphql/errors';
import { SentryExceptionFilter } from './sentry-exception.filter';

describe('SentryExceptionFilter', () => {
  const makeHost = (type: 'graphql' | 'http') =>
    ({ getType: () => type }) as never;

  it('rethrows expected domain GraphQL errors without reporting', () => {
    const filter = new SentryExceptionFilter();
    const report = jest.spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(filter)),
      'catch',
    );
    const error = new ForbiddenGraphQLError('nope');
    expect(() => filter.catch(error, makeHost('graphql'))).toThrow(error);
    expect(report).not.toHaveBeenCalled();
    report.mockRestore();
  });

  it('defers unexpected errors to SentryGlobalFilter', () => {
    const filter = new SentryExceptionFilter();
    const report = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
      .mockImplementation(() => undefined);
    const error = new Error('boom');
    filter.catch(error, makeHost('graphql'));
    expect(report).toHaveBeenCalledWith(error, expect.anything());
    report.mockRestore();
  });

  it('defers unexpected errors to SentryGlobalFilter in http context', () => {
    const filter = new SentryExceptionFilter();
    const report = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
      .mockImplementation(() => undefined);
    const error = new Error('boom');
    filter.catch(error, makeHost('http'));
    expect(report).toHaveBeenCalledWith(error, expect.anything());
    report.mockRestore();
  });

  it('reports an HTTP exception with a 5xx status', () => {
    const filter = new SentryExceptionFilter();
    const base = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
      .mockImplementation(() => undefined);
    const capture = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => 'event-id');
    const error = new InternalServerErrorException('PDF could not be fetched');
    filter.catch(error, makeHost('http'));
    expect(capture).toHaveBeenCalledWith(error);
    expect(base).toHaveBeenCalledWith(error, expect.anything());
    capture.mockRestore();
    base.mockRestore();
  });

  it('keeps an HTTP exception with a 4xx status out of Sentry', () => {
    const filter = new SentryExceptionFilter();
    const base = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch')
      .mockImplementation(() => undefined);
    const capture = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => 'event-id');
    filter.catch(new BadRequestException('nope'), makeHost('http'));
    expect(capture).not.toHaveBeenCalled();
    capture.mockRestore();
    base.mockRestore();
  });
});
