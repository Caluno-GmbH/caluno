// Import this first!
import './instrument';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { TermsAutoPublishService } from './terms/services/terms-auto-publish.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  const onSignal = (signal: NodeJS.Signals) => {
    logger.log({ signal }, 'shutdown signal received');
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  // Envoy (Scaleway Serverless Containers) must close idle upstream sockets
  // before Node does. Node's default keepAliveTimeout is 5000 ms; if Node
  // closes first, Envoy reuses a dead socket → RST → intermittent 502.
  const server = app.getHttpServer() as import('node:http').Server;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  await app.listen(process.env.PORT ?? 8080);
  void app.get(TermsAutoPublishService).runIfEnabled();
}
void bootstrap();
