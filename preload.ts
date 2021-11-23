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
  mediaPoolItem: any;
  name: string;
  clipType: string;
  filePath: string;
  fps: number;
  duration: string;
  sampleRate: string;
  syncedAudio?: string;
  start?: string;
  end?: string;

  constructor(
    mediaPoolItem: any,
    name: string,
    clipType: string,
    filePath: string,
    fps: number,
    duration: string,
    sampleRate: string,
    syncedAudio?: string,
    start?: string,
    end?: string
  ) {
    this.mediaPoolItem = mediaPoolItem;
    this.name = name;
    this.clipType = clipType;
    this.filePath = filePath;
    this.fps = fps;
    this.duration = duration;
    this.sampleRate = sampleRate;
    this.syncedAudio = syncedAudio;
    this.start = start;
    this.end = end;
  }

  isVideo(): boolean {
    return this.clipType === "Video + Audio";
  }

  get clipInfo(): ClipInfo {
    return {
      mediaPoolItem: this.mediaPoolItem,
      startFrame: this.startFrame,
      endFrame: this.endFrame,
    };
  }

  get startFrame(): number {
    if (this.start === null) {
      return 0;
    }

    return this.davinciTSToFrames(this.start);
  }

  get endFrame(): number {
    if (this.end === null) {
      return this.frames;
    }

    return this.davinciTSToFrames(this.end);
  }

  get frames(): number {
    return this.davinciTSToFrames(this.duration);
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
}

interface ClipInfo {
  mediaPoolItem: any;
  startFrame: number;
  endFrame: number;
  mediaType?: 1 | 2; // (int; 1 - Video only, 2 - Audio only)
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
    const clip = new Clip(
      davinciClip,
      davinciClip.GetName(),
      davinciClip.GetClipProperty("Type"),
      davinciClip.GetClipProperty("File Path"),
      davinciClip.GetClipProperty("FPS"),
      davinciClip.GetClipProperty("Duration"),
      davinciClip.GetClipProperty("Sample Rate"),
      davinciClip.GetClipProperty("Synced Audio"),
      davinciClip.GetClipProperty("In"),
      davinciClip.GetClipProperty("Out")
    );
    if (!clip.isVideo()) {
      continue;
    }
    clips.push(clip);
  }
  const timelineClips: ClipInfo[] = [];
  for (const clip of clips) {
    if (clip.isVideo()) {
      const info = clip.clipInfo;
      if (info.endFrame - info.startFrame < 3) {
        timelineClips.push(info);
        continue;
      }
      const info2 = { ...info };
      info.endFrame = Math.floor(info.endFrame / 2);
      info2.startFrame = info.endFrame + clip.fps + 1;
      timelineClips.push(info);
      timelineClips.push(info2);
    }
  }
  console.log("timelineClips", timelineClips);

  const timeline = mediaPool.CreateEmptyTimeline("TestTimeline");
  if (!timeline) {
    console.error("Error: Failed to create timeline!");
  }
  for (const clip of timelineClips) {
    mediaPool.AppendToTimeline(clip);
  }
});
