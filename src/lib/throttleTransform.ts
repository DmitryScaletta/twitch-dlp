import stream from 'node:stream';

export class ThrottleTransform extends stream.Transform {
  private rateBps: number;
  private startTime: number;
  private processedBytes: number;

  constructor(rateBps: number) {
    super();
    this.rateBps = rateBps;
    this.startTime = Date.now();
    this.processedBytes = 0;
  }

  _transform(chunk: Buffer, _: string, callback: () => void) {
    this.processedBytes += chunk.length;
    const expectedTime = (this.processedBytes / this.rateBps) * 1000;
    const actualTime = Date.now() - this.startTime;
    const delay = Math.max(0, expectedTime - actualTime);
    if (delay > 0) {
      setTimeout(() => {
        this.push(chunk);
        callback();
      }, delay);
    } else {
      this.push(chunk);
      callback();
    }
  }
}
