// const { chromium, firefox, webkit } = require('playwright');
import { chromium, Browser } from 'playwright';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type PeerResponse = {
  data: {
    token: string;
    peer: object;
  }
}

type RoomResponse = {
  data: {
    jellyfish_address: string
    room: {
      id: string;
      components: object;
      peers: object;
      config: object;
    }
  }
};

const jf_host = 'localhost:5002';
const jf_api_token = 'development';

const createRoom = async () => {
  const response = await fetch(`http://${jf_host}/room/`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'webrtc',
      options: {}
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'authorization': `Bearer ${jf_api_token}`,
    }
  });

  const content: RoomResponse = await response.json() as RoomResponse;
  return content.data.room.id;
};

const addPeer = async (roomId: string) => {
  const response = await fetch(`http://${jf_host}/room/${roomId}/peer`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'webrtc',
      options: {}
    }),
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'authorization': `Bearer ${jf_api_token}`,
    }
  });

  const content: PeerResponse = await response.json() as PeerResponse;
  return content.data.token;
};

const spawnBrowsers = async () => {
  const roomId = await createRoom();
  let browsers: Array<Browser> = [];

  for (let i = 0; i < 5; i++) {
    const peerToken = await addPeer(roomId);

    const browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=out.mjpeg', '--auto-accept-camera-and-microphone-capture'],

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

    await page.goto(`http://localhost:5005?peer_token=${peerToken}`);
    // console.log('browser joining?');

    browsers.push(browser);
  }

  await delay(300000);

  for (const browser of browsers) {
    browser.close();
  }
};

(async () => {
  spawnBrowsers();
})();
