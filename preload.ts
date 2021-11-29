import { writeFileSync, unlinkSync } from "fs";
import * as path from "path";
import { ipcRenderer } from "electron";

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

class Clip {
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
    if (this.customStartFrame !== undefined) {
      return this.customStartFrame;
    }

    const start: string | undefined = this.mediaPoolItem.GetClipProperty("In");

    if (start === null) {
      return 0;
    }

    return timecodeToFrames(start, this.fps);
  }

  get endFrame(): number {
    if (this.customEndFrame !== undefined) {
      return this.customEndFrame;
    }

    const end: string | undefined = this.mediaPoolItem.GetClipProperty("Out");

    if (end === null) {
      return timecodeToFrames(this.duration, this.fps);
    }

    return timecodeToFrames(end, this.fps);
  }
}

const createEDLTimeline = (timelineName: string, clips: Clip[]): string => {
  const header = `TITLE: ${timelineName}\nFCM: NON-DROP FRAME`;
  let body = "";
  let frames = 0;
  for (const [index, clip] of clips.entries()) {
    const startTimecode = framesToTimecode(clip.startFrame, clip.fps);
    const endTimecode = framesToTimecode(clip.endFrame, clip.fps);
    const clipStartInTimelineTimecode = framesToTimecode(frames, clip.fps);
    const clipEndInTimelineTimecode = framesToTimecode(
      frames + clip.frames,
      clip.fps
    );
    const clipIndex = leftPad(index, 3);
    body += `${clipIndex}  AX       V     C        ${startTimecode} ${endTimecode} ${clipStartInTimelineTimecode} ${clipEndInTimelineTimecode}\n`;
    body += `* FROM CLIP NAME: ${clip.name}\n\n`;
    frames += clip.frames;
  }

  return `${header}\n\n${body}`;
};

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
  let clip: Clip | undefined;
  for (const davinciClip of clipsInCurrentFolder) {
    const c = new Clip(davinciClip);
    if (!c.isVideo()) {
      continue;
    }
    clip = c;
  }

  if (clip === undefined) {
    console.log("nothing to do");
    return;
  }

  const clip2 = clip.clone();
  clip.endFrame = Math.floor(clip.frames / 2);
  clip2.startFrame = clip.endFrame;

  const timelineEDL = createEDLTimeline("TestTimeline", [clip, clip2]);
  const tmpDir: string = ipcRenderer.sendSync("getTemp");
  const edlFilePath = path.join(tmpDir, `${PLUGIN_ID}-${Date.now()}.edl`);
  try {
    writeFileSync(edlFilePath, timelineEDL);
    mediaPool.ImportTimelineFromFile(edlFilePath, {
      timelineName: "TestTimeline",
      importSourceClips: false,
    });
  } finally {
    unlinkSync(edlFilePath);
  }
});
