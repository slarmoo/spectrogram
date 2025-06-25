import { Synth } from "./synth";

const synth: Synth = new Synth();

const fileInput: HTMLInputElement = document.getElementById("fileInput") as HTMLInputElement;
const playButton: HTMLButtonElement = document.getElementById("playButton") as HTMLButtonElement;

fileInput.addEventListener("change", async () => {
    if (fileInput.files == null) return;
    for (const file of fileInput.files) {
        const data: ArrayBuffer = await file.arrayBuffer();
        await synth.initializeFileData(data);
        playButton.innerHTML = synth.isPlaying ? "pause" : "play";
        break; // Only one file is supported.
    }
});

playButton.addEventListener("click", () => {
    synth.togglePause();
    playButton.innerHTML = synth.isPlaying ? "pause" : "play";
})