import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

// Railway and most hosts pass a numeric port. cPanel/Passenger can instead
// hand the app a Unix socket path — support both by only coercing to a number
// when the value is numeric, otherwise listening on the socket path as given.
const numericPort = Number(rawPort);
const listenTarget: number | string =
  Number.isNaN(numericPort) || numericPort <= 0 ? rawPort : numericPort;

app.listen(listenTarget, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening");
    process.exit(1);
  }

  logger.info({ listenTarget }, "Server listening");
});
