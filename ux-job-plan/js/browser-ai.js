// Chrome's built-in model downloads on demand and runs prompts on this device.
let status = "unavailable";
const text = { type: "text", languages: ["en"] };
const modelOptions = images => ({ expectedInputs: images ? [text, { type: "image" }] : [text], expectedOutputs: [text] });

export const browserAiStatus = () => status;

export async function checkBrowserAi() {
  if (typeof globalThis.LanguageModel?.availability !== "function") return;
  try { status = await LanguageModel.availability(modelOptions(false)); }
  catch { status = "unavailable"; }
}

export async function prepareBrowserAi(onProgress) {
  status = "downloading";
  try {
    const model = await LanguageModel.create({
      ...modelOptions(false),
      monitor: m => m.addEventListener("downloadprogress", e => onProgress(Math.round(e.loaded * 100)))
    });
    model.destroy();
    status = "available";
  } catch (error) {
    await checkBrowserAi();
    throw error;
  }
}

export async function browserAiImages() {
  try { return await LanguageModel.availability(modelOptions(true)) === "available"; }
  catch { return false; }
}

export async function browserPrompt(prompt, { signal, images, onText }) {
  const withImages = images?.length && await browserAiImages();
  const model = await LanguageModel.create({ signal, ...modelOptions(withImages) });
  try {
    const input = withImages ? [{ role: "user", content: [
      { type: "text", value: prompt },
      ...images.map(value => ({ type: "image", value }))
    ] }] : prompt;
    if (!onText) return await model.prompt(input, { signal });
    let text = "";
    for await (const chunk of model.promptStreaming(input, { signal })) {
      text += chunk;
      onText({ text });
    }
    return text;
  } finally { model.destroy(); }
}
