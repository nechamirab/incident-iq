import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`IncidentIQ API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use by another process on this machine. ` +
        `Set a different PORT in your .env file and restart.`,
    );
    process.exit(1);
  }

  throw err;
});
