import { buildServer } from "./server";
import { createSystemTicker } from "./system-tick";
import { readStoreFromFile, writeStoreToFile } from "./store/in-memory-store";

const port = Number(process.env.PORT ?? 4000);
const storePath = process.env.NOAFLAKE_STORE_PATH ?? "./data/store.json";
const store = readStoreFromFile(storePath);
const ticker = createSystemTicker({
  store,
  onStoreChange: (nextStore) => writeStoreToFile(storePath, nextStore)
});
const app = buildServer({
  store,
  onStoreChange: (nextStore) => writeStoreToFile(storePath, nextStore)
});

app.listen(port, () => {
  console.log(`NoFlake backend listening on port ${port}`);
});

setInterval(() => {
  ticker.tick();
}, 60_000);
