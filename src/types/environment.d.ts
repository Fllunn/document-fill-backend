export { }

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string
      HTTPS: string

      MONGO_USER: string
      MONGO_PASSWORD: string
      MONGO_DB: string
      MONGO_HOST: string
      MONGO_PORT: string
      MONGO_URL: string

      REDIS_PASSWORD: string
      REDIS_HOST: string
      REDIS_PORT: string
      REDIS_DB: string

      CLIENT_URL: string

      JWT_ACCESS_SECRET: string
      JWT_REFRESH_SECRET: string
      JWT_RESET_SECRET: string
      TOKEN_PEPPER: string

      VERIFICATION_CODE_LENGTH: string
      VERIFICATION_CODE_ATTEMPTS: string
      VERIFICATION_CODE_TTL_SECONDS: string
      VERIFICATION_CODE_COOLDOWN_SECONDS: string

      YC_SECRET: string
      YC_KEY_ID: string
      YC_BUCKET_NAME: string

      DOCUMENT_ENCRYPTION_KEY: string
    }
  }
}
