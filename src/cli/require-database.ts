if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the CI test gate');
}
