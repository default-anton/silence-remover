const leftPad = (num: number, size: number): string => {
  let s: string = num + "";
  while (s.length < size) s = "0" + s;
  return s;
};

const timecodeToFrames = (ts: string, fps: number): number => {
  const [hours, minutes, seconds, frames] = ts.split(":");
  return (
    parseInt(frames) +
    fps * parseInt(seconds) +
    fps * 60 * parseInt(minutes) +
    fps * 3600 * parseInt(hours)
  );
};

const framesToTimecode = (frames: number, fps: number): string => {
  const hours = Math.floor(frames / (fps * 3600));
  const minutes = Math.floor((frames - hours * fps * 3600) / (fps * 60));
  const seconds = Math.floor(
    (frames - hours * fps * 3600 - minutes * fps * 60) / fps
  );
  const framesStr =
    frames - hours * fps * 3600 - minutes * fps * 60 - seconds * fps;

  return [
    leftPad(hours, 2),
    leftPad(minutes, 2),
    leftPad(seconds, 2),
    leftPad(framesStr, 2),
  ].join(":");
};

export class Clip {
  readonly mediaPoolItem: any;
  private customStartFrame?: number;
  private customEndFrame?: number;

  constructor(mediaPoolItem: any) {
    this.mediaPoolItem = mediaPoolItem;
  }

  clone(): Clip {
    const newClip = new Clip(this.mediaPoolItem);
    newClip.customStartFrame = this.customStartFrame;
    newClip.customEndFrame = this.customEndFrame;
    return newClip;
  }

  set startFrame(startFrame: number) {
    this.customStartFrame = startFrame;
  }

  set endFrame(endFrame: number) {
    this.customEndFrame = endFrame;
  }

  get name(): string {
    return this.mediaPoolItem.GetName();
  }

  get clipType(): string {
    return this.mediaPoolItem.GetClipProperty("Type");
  }

  get filePath(): string {
    return this.mediaPoolItem.GetClipProperty("File Path");
  }

  get fps(): number {
    return parseInt(this.mediaPoolItem.GetClipProperty("FPS"));
  }

  get duration(): string {
    return this.mediaPoolItem.GetClipProperty("Duration");
  }

  get frames(): number {
    return this.endFrame - this.startFrame;
  }

  get fileFrames(): number {
    return this.mediaPoolItem.GetClipProperty("Frames");
  }

  get sampleRate(): string {
    return this.mediaPoolItem.GetClipProperty("Sample Rate");
  }

  get syncedAudio(): string | undefined {
    return this.mediaPoolItem.GetClipProperty("Synced Audio");
  }

  get audioChannels(): string {
    return this.mediaPoolItem.GetClipProperty("Audio Ch");
  }

  get resolution(): string {
    return this.mediaPoolItem.GetClipProperty("Resolution");
  }

  isVideo(): boolean {
    return this.clipType.includes("Video");
  }

  hasAudio(): boolean {
    return this.clipType.includes("Audio");
  }

  get startFrame(): number {
    if (this.customStartFrame !== undefined) {
      return this.customStartFrame;
    }

    const start: string | undefined = this.mediaPoolItem.GetClipProperty("In");

    if (start === undefined) {
      return 0;
    }

    return timecodeToFrames(start, this.fps);
  }

  get endFrame(): number {
    if (this.customEndFrame !== undefined) {
      return this.customEndFrame;
    }

    const end: string | undefined = this.mediaPoolItem.GetClipProperty("Out");

    if (end === undefined) {
      return timecodeToFrames(this.duration, this.fps);
    }

    return timecodeToFrames(end, this.fps);
  }
}
