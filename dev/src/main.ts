import { Synth } from "./synth.ts";
import { Spectrogram } from "./spectrogram";

const synth: Synth = new Synth();
const spectrogram: Spectrogram = new Spectrogram(synth);
const oscilloscope: Spectrogram = new Spectrogram(synth);

const fileInput: HTMLInputElement = document.getElementById("fileInput") as HTMLInputElement;
const playButton: HTMLButtonElement = document.getElementById("playButton") as HTMLButtonElement;
const bufferSizeInput: HTMLInputElement = document.getElementById("bufferSizeInput") as HTMLInputElement;
const graphContainer: HTMLDivElement = document.getElementById("graphs") as HTMLDivElement;

graphContainer.appendChild(oscilloscope.container);
graphContainer.appendChild(spectrogram.container);

bufferSizeInput.addEventListener("change", () => {
    const size: number = Math.pow(2, parseInt(bufferSizeInput.value));
    bufferSizeInput.title = size + "";
    synth.bufferSize = size;
})

fileInput.addEventListener("change", async () => {
    if (fileInput.files == null) return;
    for (const file of fileInput.files) {
        const data: ArrayBuffer = await file.arrayBuffer();
        await synth.initializeFileData(data);
        playButton.innerHTML = synth.isPlaying ? "pause" : "play";
        break; // Only one file is supported.
    }
    fileInput.blur()
});

playButton.addEventListener("click", () => {
    togglePause();
});

document.addEventListener("keypress", (event) => {
    if (event.key == " ") {
        togglePause();
        event.preventDefault();
    }
})

function togglePause() {
    synth.togglePause();
    playButton.innerHTML = synth.isPlaying ? "pause" : "play";
}

render();

function render() {
    requestAnimationFrame(() => {
        oscilloscope.generateWave();
        spectrogram.generateSpectrum();
        render();
    })
}