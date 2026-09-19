export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  backupSecret: process.env.BACKUP_SECRET ?? "",
};
