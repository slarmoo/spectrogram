import { Synth } from "./synth";
import { Spectrogram } from "./spectrogram";

const synth: Synth = new Synth();
const spectrogram: Spectrogram = new Spectrogram(synth);
const oscilloscope: Spectrogram = new Spectrogram(synth);

const updateSpeed: number = 300;

const fileInput: HTMLInputElement = document.getElementById("fileInput") as HTMLInputElement;
const playButton: HTMLButtonElement = document.getElementById("playButton") as HTMLButtonElement;
const graphContainer: HTMLDivElement = document.getElementById("graphs") as HTMLDivElement;

graphContainer.appendChild(oscilloscope.container);
graphContainer.appendChild(spectrogram.container);

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
});

setInterval(() => {
    oscilloscope.generateWave();
    spectrogram.generateSpectrum()
}, updateSpeed)