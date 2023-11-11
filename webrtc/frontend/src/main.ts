import "./style.css";
import "./mediaDevices.ts";
import { JellyfishClient, Peer, TrackEncoding } from "@jellyfish-dev/ts-client-sdk";
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

  if (params.activePeer === "true") {
    if (!videoMediaStream) throw Error("Video stram is empty!");
    const vidoeTrack = videoMediaStream.getVideoTracks()?.[0];
    if (!vidoeTrack) throw Error("Media stream has no video track!");

    client.addTrack(
      vidoeTrack,
      videoMediaStream,
      undefined,
      { enabled: true, activeEncodings: ["l", "m", "h"] },
      new Map<TrackEncoding, number>([
        ["l", 150],
        ["m", 500],
        ["h", 1500],
      ]),
    );

    console.log("Added video");

    if (!audioMediaStream) throw Error("Audio strem is empty!");
    const audoiTrack = audioMediaStream.getAudioTracks()?.[0];
    if (!audoiTrack) throw Error("Media stream has no audio track!");

    client.addTrack(audoiTrack, audioMediaStream);
    console.log("Added audio");
  }
});

client.addListener("disconnected", () => {
  console.log("disconnected");
});

const token = params.peerToken;

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
  console.log("Track ready");
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
