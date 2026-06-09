const { loadBackendEnv } = require('./utils/env.util');

loadBackendEnv();

const app = require('./app');
const { checkDatabaseConnection } = require('./config/database');

const PORT = process.env.PORT || 4000;

async function startServer() {
  await checkDatabaseConnection();

  app.listen(PORT, () => {
    console.log(`ASISTEPRO API running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start ASISTEPRO API:', error.message);
  process.exit(1);
});
