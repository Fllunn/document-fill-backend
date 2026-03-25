export { }

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string
      HTTPS: string

      MONGO_URL: string
      CLIENT_URL: string

      JWT_ACCESS_SECRET: string
      JWT_REFRESH_SECRET: string
      REDIS_HOST: string
      REDIS_PORT: string
      REDIS_PASSWORD: string
      REDIS_DB: string

      EMAIL: string
      EMAIL_PASSWORD: string

      YC_KEY_ID: string
      YC_SECRET: string
      YC_BUCKET_NAME: string

      API_URL: string
    }
  }
}
