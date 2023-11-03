export type Args = {
  jellyfishAddress: string,
  jellyfishToken: string,
  secure: boolean,
  username: string,
  peersPerRoom: number,
  peers: number,
  duration: number,
  delay: number,
  peerDelay: number,
  chromeExecutable: string,
  peersPerBrowser: number
}

export type PeerResponse = {
  data: {
    token: string;
    peer: object;
  }
}

export type RoomResponse = {
  data: {
    jellyfish_address: string
    room: Room
  }
};

export type RoomsResponse = {
  data: Array<Room>
};

export type Room = {
  id: string;
  components: object;
  peers: object;
  config: object;
}