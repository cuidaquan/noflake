import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 4000);
const app = buildServer();

app.listen(port, () => {
  console.log(`NoFlake backend listening on port ${port}`);
});
