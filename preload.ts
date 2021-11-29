import { writeFileSync, unlinkSync } from "fs";
import * as path from "path";
import { ipcRenderer } from "electron";
import { Clip } from "./clip";

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

const generateResources = (clips: Clip[]): string => {
  const { resolution, fps } = clips[0];
  const format = `<format id="r0" name="FFVideoFormat${resolution}p${fps}" frameDuration="1/${fps}s"/>`;

  const assets: string[] = clips.map((clip, index) => {
    const { name, audioChannels, fileFrames, fps, filePath } = clip;

    const asset = `<asset id="r${index + 1}" hasVideo="${
      clip.isVideo() ? 1 : 0
    }" audioChannels="${audioChannels}" name="${name}" hasAudio="${
      clip.hasAudio() ? 1 : 0
    }" start="0/1s" audioSources="${
      clip.hasAudio() ? 1 : 0
    }" format="r0" duration="${fileFrames}/${fps}s">
            <media-rep kind="original-media" src="file://${filePath}"/>
        </asset>`;
    return asset;
  });
  const resources = `<resources>
    ${format}
    ${assets.join("\n")}
</resources>
`;

  return resources;
};

const generateAssetClips = (clips: Clip[]): string => {
  let timelineFrames = 0;
  const assetClips: string[] = clips.map((clip, index) => {
    const { name, frames, startFrame, fps } = clip;
    const offset = `${timelineFrames}/${fps}s`;
    const start = `${startFrame}/${fps}s`;
    const duration = `${frames}/${fps}s`;
    const ref = `r${index + 1}`;

    const assetClip = `<asset-clip name="${name}" start="${start}" tcFormat="NDF" offset="${offset}" format="r0" ref="${ref}" enabled="1" duration="${duration}">
    <adjust-transform scale="1 1" anchor="0 0"/>
</asset-clip>`;

    timelineFrames += frames;

    return assetClip;
  });

  return assetClips.join("\n");
};

const generateFCPXTimeline = (name: string, clips: Clip[]): string => {
  const resources = generateResources(clips);
  const assetClips = generateAssetClips(clips);
  const timelineDuration = clips.reduce((acc, clip) => acc + clip.frames, 0);
  const { fps } = clips[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    ${resources}
    <library>
        <event name="${name}">
            <project name="${name}">
                <sequence tcStart="0/1s" tcFormat="NDF" format="r0" duration="${timelineDuration}/${fps}s">
                    <spine>
                        ${assetClips}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
`;

  return xml;
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
    console.log("properties", davinciClip.GetClipProperty());
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

  const clips: Clip[] = [clip, clip2];
  const timelineFCPXML = generateFCPXTimeline("TestTimeline", clips);
  const tmpDir: string = ipcRenderer.sendSync("getTemp");
  const timelinePath = path.join(tmpDir, `${PLUGIN_ID}-${Date.now()}.fcpxml`);
  try {
    writeFileSync(timelinePath, timelineFCPXML);
    mediaPool.ImportTimelineFromFile(timelinePath, {
      timelineName: "TestTimeline",
    });
  } finally {
    unlinkSync(timelinePath);
  }
});
