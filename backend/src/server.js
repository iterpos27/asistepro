const { loadBackendEnv } = require('./utils/env.util');

loadBackendEnv();

const app = require('./app');
const { checkDatabaseConnection } = require('./config/database');

const PORT = process.env.PORT || 4001;

async function startServer() {
  await checkDatabaseConnection();

  app.listen(PORT, () => {
    console.log(`ASISTEPRO API running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start ASISTEPRO API');
  console.error({
    name: error?.name,
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    hint: error?.hint,
    stack: error?.stack,
  });
  process.exit(1);
});
