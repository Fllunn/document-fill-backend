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

      CLIENT_URL: string
      DOMAIN?: string

      JWT_ACCESS_SECRET: string
      JWT_REFRESH_SECRET: string
      JWT_RESET_SECRET: string
      TOKEN_PEPPER: string

      STORAGE_DIR?: string

      DOCUMENT_ENCRYPTION_KEY: string

      TELEGRAM_BOT_TOKEN?: string
    }
  }
}
