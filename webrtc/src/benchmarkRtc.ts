import { chromium, Browser } from 'playwright'
import { Client } from './client'
import { Args } from './types'

const frontendAddress = 'http://localhost:5005';
const fakeVideo = 'out.mjpeg';


let trackEncodingsRaw = new Map<string, string>();

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

  let time = 0, step = 5;

  while (true) {
    await delay(step);
    time += Math.min(step, args.duration - time);

    const trackEncodings = parseTrackEncodings();

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${time} / ${args.duration}s (${Math.floor(time / args.duration)}), Encodings: ${JSON.stringify(trackEncodings)}`);

    if (time == args.duration) break;
  }

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

      const { incoming, outgoing } = getTrackNumber(args);
      process.stdout.write(`Browsers launched: ${peersAdded} / ${args.peers}  Expected network usage: Incoming ${incoming * 1.5} Mbit/s, Outgoing ${outgoing * 1.5} Mbit/s`);
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

  page.on('console', msg => {
    const content = msg.text().trim();
    if (content.includes("trackEncodings:")) {
      trackEncodingsRaw.set(peerToken.substring(peerToken.length - 10), content.slice("trackEncodings:".length));
    }
  })
};

const cleanup = async (client: Client, browsers: Array<Browser>) => {
  for (const browser of browsers) {
    browser.close();
  }

  await client.purge();
};

const getTrackNumber = (args: Args) => {
  const incoming = args.peers;

  const maxPeersInRoom = Math.min(args.peers, args.peersPerRoom);
  const peersInLastRoom = args.peers % args.peersPerRoom;
  const outgoing = Math.floor(args.peers / maxPeersInRoom) * maxPeersInRoom * (maxPeersInRoom - 1) + peersInLastRoom * (peersInLastRoom - 1);

  return { incoming, outgoing }
};

// const getExpectedBandwidth = (args: Args) => {

//   return { incoming, outgoing };
// };

const parseTrackEncodings = () => {
  const totalEncodings = { 'l': 0, 'm': 0, 'h': 0 };

  trackEncodingsRaw.forEach((encodings: string, peerId: string) => {
    for (const layer_char of 'lmh') {
      const layer = layer_char as 'l' | 'm' | 'h';
      // RegEx that matches all occurences of `layer` in `encodings`
      const regex = new RegExp(layer, 'g');
      totalEncodings[layer] += (encodings.match(regex) || []).length
    }
  });
  return totalEncodings;
};