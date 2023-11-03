#!/usr/bin/env node

import { startServer } from "./src/server"
import { Args } from "./src/types"

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const { runBenchmark } = require('./src/benchmarkRtc')

const { fileURLToPath } = require('url')

const argv = yargs(hideBin(process.argv))
  .option('rooms', {
    alias: 'r',
    type: 'integer',
    description: 'Number of rooms'
  })
  .option('jellyfish-address', {
    type: 'string',
    description: 'Address of Jellyfish server'
  })
  .options('jellyfish-token', {
    type: 'string',
    description: 'Jellyfish API token'
  })
  .option('secure', {
    type: 'boolean',
    description: 'Use secure connection (https / wss) instead of (http / ws)',
    default: false
  })
  .options('peers', {
    type: 'integer',
    description: 'Number of peers'
  })
  .options('peers-per-room', {
    type: 'integer',
    description: 'Number of peers in each room'
  })
  .option('duration', {
    type: 'integer',
    description: 'Duration of the benchmark (s)',
    default: 60
  })
  .option('peer-delay', {
    type: 'integer',
    description: 'Delay between joining of each peer (s)',
    default: 1
  })
  .option('delay', {
    type: 'integer',
    description: 'Additional delay after joining of last peer (s)',
    default: 10
  })
  .option('chrome-executable', {
    type: 'string',
    description: 'Path to Google Chrome executable'
  })
  .option('peers-per-browser', {
    type: 'integer',
    description: 'Number of peers spawned per browser',
    default: 16
  })
  .demandOption(['jellyfish-address', 'jellyfish-token', 'peers', 'peers-per-room'])
  .argv;

console.log(argv);

(async () => {
  startServer({ jellyfishAddress: argv.jellyfishAddress });

  console.log('runBenchmark');
  runBenchmark(argv);
})();