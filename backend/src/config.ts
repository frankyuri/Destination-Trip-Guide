const developmentSecret = 'development-only-change-me';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return developmentSecret;
};

export const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET is required in production');
  }
  return `${developmentSecret}-refresh`;
};

export const validateEnvironment = (): void => {
  getJwtSecret();
  getRefreshSecret();
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
};