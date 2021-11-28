const PLUGIN_ID = "com.antonkuzmenko.silence_remover";

let WorkflowIntegration: any = null;

try {
  WorkflowIntegration = require("./WorkflowIntegration.node");
} catch {
  console.error("Davinci's WorkflowIntegration.node file not found");
}

if (
  WorkflowIntegration === null ||
  !WorkflowIntegration.Initialize(PLUGIN_ID)
) {
  console.error("failed to initialize the %s plugin", PLUGIN_ID);
}

class Clip {
  readonly mediaPoolItem: any;

  constructor(mediaPoolItem: any) {
    this.mediaPoolItem = mediaPoolItem;
  }

  set startFrame(startFrame: number) {
    this.mediaPoolItem.SetClipProperty(
      "In",
      this.framesToDavinciTS(startFrame)
    );
  }

  set endFrame(endFrame: number) {
    this.mediaPoolItem.SetClipProperty("Out", this.framesToDavinciTS(endFrame));
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

  get sampleRate(): string {
    return this.mediaPoolItem.GetClipProperty("Sample Rate");
  }

  get syncedAudio(): string | undefined {
    return this.mediaPoolItem.GetClipProperty("Synced Audio");
  }

  isVideo(): boolean {
    return this.clipType === "Video + Audio" || this.clipType === "Video";
  }

  get startFrame(): number {
    const start: string | undefined = this.mediaPoolItem.GetClipProperty("In");

    if (start === null) {
      return 0;
    }

    return this.davinciTSToFrames(start);
  }

  get endFrame(): number {
    const end: string | undefined = this.mediaPoolItem.GetClipProperty("Out");

    if (end === null) {
      return this.davinciTSToFrames(this.duration);
    }

    return this.davinciTSToFrames(end);
  }

  private davinciTSToFrames(ts: string): number {
    const [hours, minutes, seconds, frames] = ts.split(":");
    return (
      parseInt(frames) +
      this.fps * parseInt(seconds) +
      this.fps * 60 * parseInt(minutes) +
      this.fps * 3600 * parseInt(hours)
    );
  }

  private framesToDavinciTS(frames: number): string {
    const hours = Math.floor(frames / (this.fps * 3600));
    const minutes = Math.floor(
      (frames - hours * this.fps * 3600) / (this.fps * 60)
    );
    const seconds = Math.floor(
      (frames - hours * this.fps * 3600 - minutes * this.fps * 60) / this.fps
    );
    const framesStr =
      frames -
      hours * this.fps * 3600 -
      minutes * this.fps * 60 -
      seconds * this.fps;

    return `${this.leftPad(hours, 2)}:${this.leftPad(
      minutes,
      2
    )}:${this.leftPad(seconds, 2)}:${framesStr}`;
  }

  private leftPad(num: number, size: number): string {
    let s: string = num + "";
    while (s.length < size) s = "0" + s;
    return s;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const resolve = WorkflowIntegration.GetResolve();
  if (!resolve) {
    console.error("GetResolve failed");
    return;
  }

  const projectManager = resolve.GetProjectManager();
  const project = projectManager.GetCurrentProject();
  const mediaPool = project.GetMediaPool();
  const currentFolder = mediaPool.GetCurrentFolder();
  const clipsInCurrentFolder = currentFolder.GetClipList();
  const clips: Clip[] = [];
  for (const davinciClip of clipsInCurrentFolder) {
    const clip = new Clip(davinciClip);
    if (!clip.isVideo()) {
      continue;
    }
    clips.push(clip);
  }

  const timeline = mediaPool.CreateEmptyTimeline("TestTimeline");
  if (!timeline) {
    console.error("Error: Failed to create timeline!");
  }

  for (const clip of clips) {
    if (clip.isVideo()) {
      if (clip.endFrame - clip.startFrame < 3) {
        mediaPool.AppendToTimeline(clip.mediaPoolItem);
        continue;
      }

      const originalStartFrame = clip.startFrame;
      const originalEndFrame = clip.endFrame;
      const clip1EndFrame = Math.floor(originalEndFrame / 2);

      clip.endFrame = clip1EndFrame;
      mediaPool.AppendToTimeline(clip.mediaPoolItem);

      clip.endFrame = originalEndFrame;
      clip.startFrame = clip1EndFrame + 1;
      mediaPool.AppendToTimeline(clip);

      // revert the clip to its original state
      clip.startFrame = originalStartFrame;
      clip.endFrame = originalEndFrame;
    }
  }
});
