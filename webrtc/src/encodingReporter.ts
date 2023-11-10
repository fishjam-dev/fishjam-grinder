import { ConsoleMessage } from "playwright";

let trackEncodingsRaw = new Map<string, string>();

export class EncodingsReport {
  report: {
    l: number;
    m: number;
    h: number;
  };

  constructor(reportRaw: Map<string, string>) {
    const totalEncodings = { l: 0, m: 0, h: 0 };

    reportRaw.forEach((encodings: string, peerId: string) => {
      for (const layer_char of "lmh") {
        const layer = layer_char as "l" | "m" | "h";
        // RegEx that matches all occurences of `layer` in `encodings`
        const regex = new RegExp(layer, "g");
        totalEncodings[layer] += (encodings.match(regex) || []).length;
      }
    });

    this.report = totalEncodings;
  }

  toString = () => {
    return `l: ${this.report.l}, m: ${this.report.m}, h: ${this.report.h}`;
  };

  toJson = () => {
    return this.report;
  };
}

export const getEncodingsReport = () => {
  return new EncodingsReport(trackEncodingsRaw);
};

export const onEncodingsUpdate = (msg: ConsoleMessage, peerToken: string) => {
  const content = msg.text().trim();
  if (content.includes("trackEncodings:")) {
    trackEncodingsRaw.set(
      peerToken.substring(peerToken.length - 10),
      content.slice("trackEncodings:".length),
    );
  }
};
