#!/usr/bin/env node

import { startServer } from "./src/server";
import { Args } from "./src/types";

const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const { runBenchmark } = require("./src/benchmarkRtc");

const { fileURLToPath } = require("url");

const argv = yargs(hideBin(process.argv))
  .option("jellyfish-address", {
    type: "string",
    description: "Address of Jellyfish server",
  })
  .options("jellyfish-token", {
    type: "string",
    description: "Jellyfish API token",
  })
  .option("secure", {
    type: "boolean",
    description: "Use secure connection (https / wss)",
    default: false,
  })
  .options("peers", {
    type: "integer",
    description: "Number of peers",
  })
  .options("peers-per-room", {
    type: "integer",
    description: "Number of peers in each room",
  })
  .option("active-peers", {
    type: "integer",
    default: undefined,
    decription:
      "Number of active peers in each room, default to `peers-per-room`",
  })
  .option("duration", {
    type: "integer",
    description: "Duration of the benchmark (s)",
    default: 60,
  })
  .option("peer-delay", {
    type: "integer",
    description: "Delay between joining of each peer (s)",
    default: 1,
  })
  .option("chrome-executable", {
    type: "string",
    description: "Path to Google Chrome executable",
  })
  .option("peers-per-browser", {
    type: "integer",
    description: "Number of peers spawned per browser",
    default: 16,
  })
  .demandOption([
    "jellyfish-address",
    "jellyfish-token",
    "peers",
    "peers-per-room",
    "chrome-executable",
  ]).argv;

(async () => {
  // Start the frontend server
  startServer({ jellyfishAddress: argv.jellyfishAddress, secure: argv.secure });

  argv.peersPerRoom = Math.min(argv.peersPerRoom, argv.peers);
  if (argv.activePeers == undefined) argv.activePeers = argv.peersPerRoom;
  argv.activePeers = Math.min(argv.activePeers, argv.peersPerRoom);
  console.log(argv);

  runBenchmark(argv);
})();
