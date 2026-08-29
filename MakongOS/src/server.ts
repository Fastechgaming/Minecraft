import 'dotenv/config';
import path from 'node:path';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { startBot } from './bot/client';
import { createLogger } from './services/logger';

const log = createLogger('server');
const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== 'production';

/**
 * MakongOS ships as one process: the Next.js dashboard and the Discord bot
 * share this Node runtime, the Prisma client, and the settings cache. There
 * is nothing else to deploy or host separately — `npm start` runs both.
 */
async function main(): Promise<void> {
  const app = next({ dev, dir: path.join(__dirname, '..') });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl).catch((err) => {
      log.error('Request handling failed', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  log.info(`Dashboard ready on http://localhost:${port}`);

  await startBot();
}

main().catch((err) => {
  log.error('Fatal startup error', err);
  process.exit(1);
});
