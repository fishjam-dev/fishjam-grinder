export type Args = {
  jellyfishAddress: string;
  jellyfishToken: string;
  secure: boolean;
  peers: number;
  peersPerRoom: number;
  duration: number;
  peerDelay: number;
  chromeExecutable: string;
  peersPerBrowser: number;
  activePeers: number;
};

export type PeerResponse = {
  data: {
    token: string;
    peer: object;
  };
};

export type RoomResponse = {
  data: {
    jellyfish_address: string;
    room: Room;
  };
};

export type RoomsResponse = {
  data: Array<Room>;
};

export type Room = {
  id: string;
  components: object;
  peers: object;
  config: object;
};
