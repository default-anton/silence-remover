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

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }

  const resolve = WorkflowIntegration.GetResolve();
  if (!resolve) {
    console.log("GetResolve failed");
    return;
  }

  const projectManager = resolve.GetProjectManager();
  const project = projectManager.GetCurrentProject();
  const mediaPool = project.GetMediaPool();
  const currentFolder = mediaPool.GetCurrentFolder();
  const clipsInCurrentFolder = currentFolder.GetClipList();
  for (const clip of clipsInCurrentFolder) {
    console.log("name", clip.GetName());
    console.log("Type", clip.GetClipProperty("Type"));
    console.log("File Path", clip.GetClipProperty("File Path"));
    console.log("FPS", clip.GetClipProperty("FPS"));
    console.log("Duration", clip.GetClipProperty("Duration"));
    console.log("Sample Rate", clip.GetClipProperty("Sample Rate"));
    console.log("Synced Audio", clip.GetClipProperty("Synced Audio"));
    console.log("In", clip.GetClipProperty("In"));
    console.log("Out", clip.GetClipProperty("Out"));
  }
});
