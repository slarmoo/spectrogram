import { Synth } from "./synth.ts";
import { Spectrogram } from "./spectrogram";

const synth: Synth = new Synth();
const spectrogram: Spectrogram = new Spectrogram(synth, true);
const oscilloscope: Spectrogram = new Spectrogram(synth);

const fileInput: HTMLInputElement = document.getElementById("fileInput") as HTMLInputElement;
const linkInput: HTMLInputElement = document.getElementById("fetchurl") as HTMLInputElement;
const submitButton: HTMLButtonElement = document.getElementById("submit") as HTMLButtonElement;
const playButton: HTMLButtonElement = document.getElementById("playButton") as HTMLButtonElement;
// const bufferSizeInput: HTMLInputElement = document.getElementById("bufferSizeInput") as HTMLInputElement;
const graphContainer: HTMLDivElement = document.getElementById("graphs") as HTMLDivElement;

graphContainer.appendChild(oscilloscope.container);
graphContainer.appendChild(spectrogram.container);

// bufferSizeInput.addEventListener("change", () => {
//     const size: number = Math.pow(2, parseInt(bufferSizeInput.value));
//     bufferSizeInput.title = size + "";
//     // synth.bufferSize = size;
// })

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

submitButton.addEventListener("click", () => {
    if (!linkInput.value) return;
    fetch(linkInput.value).then((r) => r.arrayBuffer()).then((data) => synth.initializeFileData(data)).then(() => playButton.innerHTML = synth.isPlaying ? "pause" : "play");
})

playButton.addEventListener("click", () => {
    togglePause();
    playButton.blur();
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

// const updateSpeed: number = 50
// setInterval(() => {
//     oscilloscope.generateWave();
//     spectrogram.generateSpectrum();
// }, updateSpeed);

render();

function render() {
    requestAnimationFrame(() => {
        oscilloscope.generateWave();
        spectrogram.generateSpectrum();
        render();
    })
}