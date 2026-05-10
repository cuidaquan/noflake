import { buildServer } from "./server";
import { createSystemTicker } from "./system-tick";
import { readStoreFromFile, writeStoreToFile } from "./store/in-memory-store";

const port = Number(process.env.PORT ?? 4000);
const storePath = process.env.NOAFLAKE_STORE_PATH ?? "./data/store.json";
if (process.env.NOAFLAKE_RESET_STORE !== "false") {
  writeStoreToFile(storePath, { events: [], reservations: [] });
}
const store = readStoreFromFile(storePath);
const ticker = createSystemTicker({
  store,
  onStoreChange: (nextStore) => writeStoreToFile(storePath, nextStore)
});
const app = buildServer({
  store,
  onStoreChange: (nextStore) => writeStoreToFile(storePath, nextStore),
  allowTestReset: process.env.NOAFLAKE_ALLOW_TEST_RESET === "true"
});

app.listen(port, () => {
  console.log(`NoFlake backend listening on port ${port}`);
});

setInterval(() => {
  ticker.tick();
}, 60_000);
