import "./style.css";
import "./mediaDevices.ts";
import { JellyfishClient, Peer } from "@jellyfish-dev/ts-client-sdk";
import { videoMediaStream, startDevice, audioMediaStream } from "./mediaDevices";

await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
const devices = await navigator.mediaDevices.enumerateDevices();

const videoDevice = devices.filter((device) => device.kind === "videoinput")[0];
const audioDevice = devices.filter((device) => device.kind === "audioinput")[0];

await startDevice(videoDevice.deviceId, "video");
await startDevice(audioDevice.deviceId, "audio");

console.log(`audio: ${JSON.stringify(audioDevice)}, video: ${JSON.stringify(videoDevice)}`);

const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

const random_id = () => {
  crypto.randomUUID();
};

type PeerMetadata = {
  name: string;
};

type TrackMetadata = {
  type: "camera" | "microphone" | "screenshare";
};

export const client = new JellyfishClient<PeerMetadata, TrackMetadata>();

client.addListener("joined", (peerId: string, peers: Peer[]) => {
  console.log("joined");

  if (!videoMediaStream) throw Error("Video stram is empty!");
  const vidoeTrack = videoMediaStream.getVideoTracks()?.[0];
  if (!vidoeTrack) throw Error("Media stream has no video track!");

  client.addTrack(vidoeTrack, videoMediaStream, undefined, { enabled: true, activeEncodings: ["l", "m", "h"] });

  console.log("Added video");
});

client.addListener("disconnected", () => {
  console.log("disconnected");
});

const token = params.peer_token;

client.connect({
  token: token,
  signaling: {
    host: process.env.JF_ADDR,
    protocol: process.env.JF_PROTOCOL,
  },
  peerMetadata: {
    name: `Kamil${random_id()}`,
  },
});

client.addListener("trackReady", (trackContext) => {
  console.log('Track ready, requesting "h"');

  client.setTargetTrackEncoding(trackContext.trackId, "h");
});

client.addListener("trackRemoved", (trackContext) => {
  console.log("Track removed");
});

setInterval(() => {
  const tracks = client.getRemoteTracks();
  const trackEncodings = [];

  for (const trackId in tracks) {
    const encoding = tracks[trackId].encoding;

    trackEncodings.push(encoding);
    if (encoding != "h") {
      client.setTargetTrackEncoding(trackId, "h");
    }
  }

  console.log(`trackEncodings: ${trackEncodings}`);
}, 5000);
