import "./style.css";
import "./mediaDevices.ts";
import { JellyfishClient, Peer, TrackEncoding } from "@jellyfish-dev/ts-client-sdk";
import { startDevices } from "./mediaDevices";

const startClient = () => {
  const params: QueryParams = parseQueryParams();
  const client = new JellyfishClient<PeerMetadata, TrackMetadata>();

  client.addListener("joined", () => {
    console.log("Joined");
    if (params.activePeer) {
      addMediaTracks(client);
    }
  });

  client.addListener("trackReady", (trackContext) => {
    console.log("Track ready");
  });

  client.addListener("trackRemoved", (trackContext) => {
    console.log("Track removed");
  });

  client.addListener("disconnected", () => {
    console.log("Disconnected");
  });

  client.connect({
    token: params.peerToken,
    signaling: {
      host: process.env.JF_ADDR,
      protocol: process.env.JF_PROTOCOL,
    },
    peerMetadata: {
      name: `Kamil${crypto.randomUUID()}`,
    },
  });

  return client;
};

const addMediaTracks = (client: JellyfishClient<PeerMetadata, TrackMetadata>) => {
  const videoTrack = videoMediaStream.getVideoTracks()?.[0];

  client.addTrack(
    videoTrack,
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

  const audioTrack = audioMediaStream.getAudioTracks()?.[0];

  client.addTrack(audioTrack, audioMediaStream);
  console.log("Added audio");
};

const startEncodingLogging = (period: number) => {
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
  }, period);
};

const parseQueryParams = () => {
  const urlSearchParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlSearchParams.entries());

  return {
    peerToken: params.peerToken,
    activePeer: params.activePeer === "true"
  }
};

const [audioMediaStream, videoMediaStream] = await startDevices();
const client = startClient();
startEncodingLogging(5000);
