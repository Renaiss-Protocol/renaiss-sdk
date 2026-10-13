declare namespace NodeJS {
  interface ProcessEnv {
    CI: string | undefined;
    RENAISS_API_URL: string | undefined;
  }
}
