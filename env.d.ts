declare namespace NodeJS {
  interface ProcessEnv {
    CI: string | undefined;
    RENAISS_RUN_METERED_TESTS: string | undefined;
    RENAISS_API_URL: string | undefined;
    RENAISS_TEST_PRIVATE_KEY: string | undefined;
    RENAISS_TEST_WALLET: string | undefined;
  }
}
