import { RoomResponse, PeerResponse, RoomsResponse } from "./types";

export class Client {
  jellyfishAddress: string;
  jellyfishToken: string;

  constructor({ jellyfishAddress, jellyfishToken, secure }: { jellyfishAddress: string, jellyfishToken: string, secure: boolean }) {

    const protocol = secure ? 'https' : 'http';

    this.jellyfishAddress = `${protocol}://${jellyfishAddress}`;
    this.jellyfishToken = jellyfishToken;
  }

  createRoom = async () => {
    const response = await fetch(`${this.jellyfishAddress}/room/`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'webrtc',
        options: {},
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'authorization': `Bearer ${this.jellyfishToken}`,
      }
    });

    const content: RoomResponse = await response.json() as RoomResponse;
    return content.data.room.id;
  }

  addPeer = async (roomId: string) => {
    const response = await fetch(`${this.jellyfishAddress}/room/${roomId}/peer`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'webrtc',
        options: {}
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'authorization': `Bearer ${this.jellyfishToken}`,
      }
    });

    const content: PeerResponse = await response.json() as PeerResponse;
    return content.data.token;
  }

  purge = async () => {
    const roomsResponse = await fetch(`${this.jellyfishAddress}/room`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'authorization': `Bearer ${this.jellyfishToken}`,
      }
    });

    const content: RoomsResponse = await roomsResponse.json() as RoomsResponse;

    for (const room of content.data) {
      await fetch(`${this.jellyfishAddress}/room/${room.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'authorization': `Bearer ${this.jellyfishToken}`,
        }
      })
    }
  }
}