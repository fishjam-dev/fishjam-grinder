import { chromium, Browser } from "playwright";
import { TrackEncoding } from "@jellyfish-dev/ts-client-sdk";
import { Client } from "./client";
import { Args } from "./types";
import { getEncodingsReport, onEncodingsUpdate } from "./encodingReporter";

const frontendAddress = "http://localhost:5005";
const fakeVideo = "media/sample_video.mjpeg";
const fakeAudio = "media/sample_audio.wav";

const encodingReportPeriod = 5;
const encodingBitrate = new Map<TrackEncoding, number>([
  ["l", 0.15],
  ["m", 0.5],
  ["h", 1.5],
]);

const delay = (s: number) => {
  return new Promise((resolve) => setTimeout(resolve, 1000 * s));
};

export const runBenchmark = async (args: Args) => {
  const client = new Client(args);
  await client.purge();

  const browsers = await addPeers(args);

  console.log("Started all browsers, running benchmark");

  const encodingReports = [];

  let time = 0,
    step = encodingReportPeriod;
  while (true) {
    await delay(step);
    step = Math.min(step, args.duration - time);
    time += step;

    const report = getEncodingsReport();
    encodingReports.push({ ...report.toJson(), timestamp: time });

    writeInPlace(
      `${time} / ${args.duration}s (${Math.floor(
        time / args.duration,
      )}), Encodings: ${report.toString()}}`,
    );

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
      await startPeer({
        browser: currentBrowser!,
        client: client,
        roomId: roomId,
        active: j < args.activePeers,
      });
      peersAdded++, peersInCurrentBrowser++;

      const { incoming, outgoing } = getEstimatedBandwidth(args);
      writeInPlace(
        `Browsers launched: ${peersAdded} / ${args.peers}  Expected network usage: Incoming ${incoming} Mbit/s, Outgoing ${outgoing} Mbit/s`,
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
  for (const browser of browsers) {
    browser.close();
  }

  await client.purge();
};

const getEstimatedBandwidth = (args: Args) => {
  const maxPeersInRoom = Math.min(args.peers, args.peersPerRoom);
  const fullRooms = Math.floor(args.peers / maxPeersInRoom);
  const peersInLastRoom = args.peers % args.peersPerRoom;
  const activePeersInLastRoom = Math.min(args.activePeers, peersInLastRoom);

  const incoming_tracks = fullRooms * args.activePeers + activePeersInLastRoom;

  const outgoing_tracks =
    fullRooms * args.activePeers * (maxPeersInRoom - 1) +
    activePeersInLastRoom * (peersInLastRoom - 1);

  const outgoing = encodingBitrate.get(args.targetEncoding)! * incoming_tracks;

  let incoming = 0;
  for (const encoding of args.availableEncodings) {
    incoming += encodingBitrate.get(encoding)! * incoming_tracks;
  }

  return { incoming, outgoing };
};

const writeInPlace = (text: string) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(text);
};
