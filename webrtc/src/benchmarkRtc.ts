import { chromium, Browser } from "playwright";
import { Client } from "./client";
import { Args } from "./types";
import { getEncodingsReport, onEncodingsUpdate } from "./encodingReporter";

const frontendAddress = "http://localhost:5005";
const fakeVideo = "media/sample_video.mjpeg";
const fakeAudio = "media/sample_audio.wav";
const ENCODING_REPORT_PERIOD = 5;
const INBOUD_TRACK_BANDWIDTH = 0.15 + 0.5 + 1.5;
const OUTBOUND_TRACK_BANDWIDTH = 1.5;

const second = 1000;
const delay = (n: number) => {
  return new Promise((resolve) => setTimeout(resolve, n * second));
};

export const runBenchmark = async (args: Args) => {
  const client = new Client(args);
  await client.purge();

  const browsers = await addPeers(args);

  console.log("Started all browsers, running benchmark");

  for (
    let time = 0, step = ENCODING_REPORT_PERIOD;
    time < args.duration;
    step = Math.min(step, args.duration - time), time += step
  ) {
    const report = getEncodingsReport();

    writeInPlace(
      `${time} / ${args.duration}s, Encodings: ${report.toString()}}`,
    );
    await delay(step);
  }

  writeInPlace(`${args.duration} / ${args.duration}s`);

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

  const { incomingTracks, outgoingTracks } = getTrackNumber(args);

  while (peersAdded < args.peers) {
    const roomId = await client.createRoom();

    for (let j = 0; j < args.peersPerRoom && peersAdded < args.peers; j++) {
      await startPeer({
        browser: currentBrowser!,
        client: client,
        roomId: roomId,
        active: j < args.activePeers,
      });
      peersAdded++, peersInCurrentBrowser++;

      writeInPlace(
        `Browsers launched: ${peersAdded} / ${
          args.peers
        }  Expected network usage: Incoming ${
          incomingTracks * INBOUD_TRACK_BANDWIDTH
        } Mbit/s, Outgoing ${outgoingTracks * OUTBOUND_TRACK_BANDWIDTH} Mbit/s`,
      );
      await delay(args.peerDelay);

      if (peersInCurrentBrowser == args.peersPerBrowser) {
        browsers.push(currentBrowser!);
        currentBrowser = await spawnBrowser(args.chromeExecutable);
        peersInCurrentBrowser = 0;
      }
    }
  }
  console.log("");

  return browsers;
};

const spawnBrowser = async (chromeExecutable: string) => {
  const browser = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${fakeVideo}`,
      `--use-file-for-fake-audio-capture=${fakeAudio}`,
      "--auto-accept-camera-and-microphone-capture",
      "--no-sandbox",
    ],

    // Start headfull browser
    // devtools: true,
    logger: {
      isEnabled: (name: any, severity: any) => name === "browser",
      log: (name: any, severity: any, message: any, args: any) =>
        console.log(`${name} ${message}`),
    },
    executablePath: chromeExecutable,
  });

  return browser;
};

const startPeer = async ({
  browser,
  client,
  roomId,
  active,
}: {
  browser: Browser;
  client: Client;
  roomId: string;
  active: boolean;
}) => {
  const peerToken = await client.addPeer(roomId);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(
    `${frontendAddress}?peerToken=${peerToken}&activePeer=${JSON.stringify(
      active,
    )}`,
  );
  page.on("console", (msg) => onEncodingsUpdate(msg, peerToken));
};

const cleanup = async (client: Client, browsers: Array<Browser>) => {
  browsers.forEach((browser) => browser.close());
  await client.purge();
};

const getTrackNumber = (args: Args) => {
  const maxPeersInRoom = Math.min(args.peers, args.peersPerRoom);
  const fullRooms = Math.floor(args.peers / maxPeersInRoom);
  const peersInLastRoom = args.peers % args.peersPerRoom;
  const activePeersInLastRoom = Math.min(args.activePeers, peersInLastRoom);

  const incomingTracks = fullRooms * args.activePeers + activePeersInLastRoom;

  const outgoingTracks =
    fullRooms * args.activePeers * (maxPeersInRoom - 1) +
    activePeersInLastRoom * (peersInLastRoom - 1);

  return { incomingTracks, outgoingTracks };
};

const writeInPlace = (text: string) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(text);
};
