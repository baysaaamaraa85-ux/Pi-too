// e2e тест тусдаа өгөгдлийн сан (pitoo_e2e) болон порт дээр ажиллана: хөгжүүлэлтийн
// өгөгдөлд хүрэхгүй.
export const E2E = {
  dbName: "pitoo_e2e",
  adminDatabaseUrl: "postgresql://postgres:dev@localhost:5440/postgres",
  databaseUrl: "postgresql://postgres:dev@localhost:5440/pitoo_e2e",
  appDatabaseUrl: "postgresql://pitoo_app:pitoo_app_dev@localhost:5440/pitoo_e2e",
  apiPort: 3100,
  webPort: 5273,
  adminPhone: "99000001",
  adminPassword: "AdminE2e123!",
};

export function apiEnv() {
  return {
    NODE_ENV: "development",
    PORT: String(E2E.apiPort),
    APP_ORIGIN: `http://localhost:${E2E.webPort}`,
    DATABASE_URL: E2E.databaseUrl,
    APP_DATABASE_URL: E2E.appDatabaseUrl,
    JWT_ACCESS_SECRET: "e2e-access-secret-e2e-access-secret-0123456789",
    JWT_REFRESH_SECRET: "e2e-refresh-secret-e2e-refresh-secret-0123456789",
    ADMIN_PHONE: E2E.adminPhone,
    ADMIN_TEMP_PASSWORD: E2E.adminPassword,
  };
}
