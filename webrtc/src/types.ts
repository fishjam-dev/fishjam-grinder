export type args = {
  jellyfishAddress: string,
  jellyfishToken: string,
  secure: boolean,
  username: string,
  peersPerRoom: number,
  peers: number,
  duration: number,
  delay: number,
  peerDelay: number,
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
    room: {
      id: string;
      components: object;
      peers: object;
      config: object;
    }
  }
};