import { chromium, Browser } from 'playwright'
import { Client } from './client'
import { args } from './types'


// import fs from 'fs';
// import path from 'path';
// import { NodeSSH } from 'node-ssh';

const frontendAddress = 'http://localhost:5005';
const fakeVideo = 'out.mjpeg';

// const ssh = new NodeSSH()

const delay = (s: number) => {
  return new Promise(resolve => setTimeout(resolve, 1000 * s));
};

export const runBenchmark = async (args: args) => {
  const client = new Client(args);
  let browsers: Array<Browser> = [];

  while (browsers.length < args.peers) {
    const roomId = await client.createRoom();

    for (let j = 0; j < args.peersPerRoom && browsers.length < args.peers; j++) {
      const browser = await startPeer(client, roomId);

      browsers.push(browser);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Browsers launched: ${browsers.length} / ${args.peers}`);
      await delay(args.peerDelay);
    }
  }
  process.stdout.write("\n");

  console.log("Started all browsers");
  await delay(args.delay);

  console.log("Starting benchmark");
  await delay(args.duration);

  console.log("Benchmark finished, closing");
  for (const browser of browsers) {
    browser.close();
  }
};

const startPeer = async (client: Client, roomId: string) => {
  const peerToken = await client.addPeer(roomId);

  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${fakeVideo}`, '--auto-accept-camera-and-microphone-capture'],

    // Start headfull browser
    // devtools: true,
    logger: {
      isEnabled: (name: any, severity: any) => name === 'browser',
      log: (name: any, severity: any, message: any, args: any) => console.log(`${name} ${message}`)
    },
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${frontendAddress}?peer_token=${peerToken}`);
  // console.log('browser joining?');

  return browser;
};