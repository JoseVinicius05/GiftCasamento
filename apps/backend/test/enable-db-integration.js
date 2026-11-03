// Carregado só pelo jest.integration.json (setupFiles): liga os testes que
// precisam de um Postgres de verdade. No `npm test` normal esta variável não
// existe e esses testes aparecem como "skipped".
process.env.RUN_DB_INTEGRATION = '1';
