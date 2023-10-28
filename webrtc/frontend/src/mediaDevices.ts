import { AUDIO_TRACK_CONSTRAINTS, VIDEO_TRACK_CONSTRAINTS } from "./constraints";

export let videoMediaStream: MediaStream | null = null;
export let audioMediaStream: MediaStream | null = null;

const LAST_SELECTED_VIDEO_DEVICE_ID_KEY = "last-selected-video-device-id";
const LAST_SELECTED_AUDIO_DEVICE_ID_KEY = "last-selected-audio-device-id";

export const startDevice = async (deviceId: string, type: "audio" | "video") => {
  localStorage.setItem(
    type === "video" ? LAST_SELECTED_VIDEO_DEVICE_ID_KEY : LAST_SELECTED_AUDIO_DEVICE_ID_KEY,
    deviceId,
  );

  const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
    [type]: { deviceId: deviceId, ...(type === "video" ? VIDEO_TRACK_CONSTRAINTS : AUDIO_TRACK_CONSTRAINTS) },
  });

  if (type === "video") {
    videoMediaStream = stream;
  } else {
    audioMediaStream = stream;
  }
};
