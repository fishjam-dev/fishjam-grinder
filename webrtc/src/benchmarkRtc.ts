import { chromium, Browser } from 'playwright'
import { Client } from './client'
import { Args } from './types'
import { SingleBar, Presets } from 'cli-progress'
import { addExitCallback } from 'catch-exit';


// import fs from 'fs';
// import path from 'path';
// import { NodeSSH } from 'node-ssh';

const frontendAddress = 'http://localhost:5005';
const fakeVideo = 'out.mjpeg';

// const ssh = new NodeSSH()

const delay = (s: number) => {
  return new Promise(resolve => setTimeout(resolve, 1000 * s));
};

export const runBenchmark = async (args: Args) => {
  const client = new Client(args);
  await client.purge();

  const browsers = await addPeers(args);

  console.log(`Started all browsers, waiting ${args.delay}s`);
  await delay(args.delay);

  console.log(`\nRunning benchmark`);
  const progressBar = new SingleBar({}, Presets.shades_classic);
  progressBar.start(args.duration, 0);

  for (let time = 0, step = 5; time < args.duration; time += Math.min(step, args.duration - time)) {
    await delay(step);
    progressBar.update(time);
  }
  progressBar.update(args.duration);
  progressBar.stop();

  await cleanup(client, browsers);

  console.log("\nBenchmark finished, closing");
  process.exit(0);
};

const addPeers = async (args: Args) => {
  const client = new Client(args);

  let peersAdded = 0;
  let peersInCurrentBrowser = 0;
  let browsers: Array<Browser> = [];
  let currentBrowser = await spawnBrowser(args.chromeExecutable);

  while (peersAdded < args.peers) {
    const roomId = await client.createRoom();

    for (let j = 0; j < args.peersPerRoom && peersAdded < args.peers; j++) {
      await startPeer({ browser: currentBrowser!, client: client, roomId: roomId });
      peersAdded++, peersInCurrentBrowser++;

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      const { incoming, outgoing } = getExpectedBandwidth(args);
      process.stdout.write(`Browsers launched: ${peersAdded} / ${args.peers}  Expected network usage: Incoming ${incoming} Mbit/s, Outgoing ${outgoing} Mbit/s`);
      await delay(args.peerDelay);

      if (peersInCurrentBrowser == args.peersPerBrowser) {
        browsers.push(currentBrowser!);
        currentBrowser = await spawnBrowser(args.chromeExecutable);
        peersInCurrentBrowser = 0;
      }
    }
  }
  process.stdout.write("\n");

  return browsers;
};

const spawnBrowser = async (chromeExecutable: string) => {
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${fakeVideo}`, '--auto-accept-camera-and-microphone-capture'],

    // Start headfull browser
    // devtools: true,
    logger: {
      isEnabled: (name: any, severity: any) => name === 'browser',
      log: (name: any, severity: any, message: any, args: any) => console.log(`${name} ${message}`)
    },
    executablePath: chromeExecutable
  });

  return browser;
};

const startPeer = async ({ browser, client, roomId }: { browser: Browser, client: Client, roomId: string }) => {
  const peerToken = await client.addPeer(roomId);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${frontendAddress}?peer_token=${peerToken}`);
};

const cleanup = async (client: Client, browsers: Array<Browser>) => {
  for (const browser of browsers) {
    browser.close();
  }

  await client.purge();
};

const getExpectedBandwidth = (args: Args) => {
  const incoming = 1.5 * args.peers;

  const maxPeersInRoom = Math.min(args.peers, args.peersPerRoom);
  const outgoing = 1.5 * Math.floor(args.peers / maxPeersInRoom) * maxPeersInRoom * (maxPeersInRoom - 1);
  return { incoming, outgoing };
};