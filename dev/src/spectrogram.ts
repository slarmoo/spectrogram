import { HTML, SVG } from "./imperative-html/elements-strict.ts";
import type { Synth } from "./synth.ts";

export class Spectrogram {
    private readonly _editorWidth: number = 720;
    private readonly _editorHeight: number = 400;
    private readonly _curveL: SVGPathElement = SVG.path({ fill: "none", stroke: "rgb(255, 255, 255)", "stroke-width": 2, "pointer-events": "none" });
    private readonly _curveR: SVGPathElement = SVG.path({ fill: "none", stroke: "rgb(85, 199, 216)", "stroke-width": 2, "pointer-events": "none" });
    private readonly _text: SVGTextElement = SVG.text({ x: "20", y: this._editorHeight - 20, fill: "white" }, "");

    private readonly _svg: SVGSVGElement = SVG.svg({ style: `background-color:#072818; touch-action: none; cursor: crosshair;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
        this._curveL,
        this._curveR,
        this._text
    )

    public readonly container: HTMLElement = HTML.div({ class: "spectrogram", style: "width: " + this._editorWidth + "px; height: " + this._editorHeight + "px;" }, this._svg);

    private readonly synth;
    private spectrumLeft: Float32Array | null = null;
    private spectrumRight: Float32Array | null = null;

    private maxFreq = 24000;
    private readonly minFreq = 20;

    constructor(synth: Synth, renderFrequencies: boolean = false) {
        this.synth = synth;
        if (renderFrequencies) {
            this.synth.updateFreq = (sampleRate) => this.maxFreq = sampleRate / 2;
            this.container.addEventListener("mousemove", this._hover);
            this.container.addEventListener("mouseleave", () => this._text.textContent = "");
        }
    }

    public generateWave() {
        this.spectrumLeft = this.synth.displayTimeLeft;
        this.spectrumRight = this.synth.displayTimeRight;
        this.renderWave();
    }

    public generateSpectrum() {
        this.spectrumLeft = this.synth.displayFFTLeft.map((val) => (val + 80) / -160);
        this.spectrumRight = this.synth.displayFFTRight.map((val) => (val + 80) / -160);
        this.renderSpectrum();
    }

    private _mouseX: number = 0;
    private _mouseY: number = 0;

    private _hover = (event: MouseEvent): void => {
        if (this.container.offsetParent == null) {
            this._text.textContent = "";
            return;
        }
        const boundingRect: ClientRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (this._mouseX <= 0 || this._mouseY <= 0 || this._mouseX >= this._editorWidth || this._mouseY >= this._editorHeight) {
            this._text.textContent = "";
            return;
        }

        this._text.textContent = ((this.minFreq * Math.pow(this.maxFreq / this.minFreq, this._mouseX / this._editorWidth)) | 0 )+ "hz"
    }

    private renderWave() {
        if (!this.synth.isPlaying || this.spectrumLeft == null || this.spectrumRight == null) return;
        let pathL: string = "M 0 " + prettyNumber(this.spectrumLeft[0] * this._editorHeight + this._editorHeight / 2) + " ";
        let pathR: string = "M 0 " + prettyNumber(this.spectrumRight[0] * this._editorHeight + this._editorHeight / 2) + " ";
        for (let index: number = 1; index < this.spectrumLeft.length; index++) {
            pathL += "L " + prettyNumber(index / this.spectrumLeft.length * this._editorWidth) + " " + prettyNumber(this.spectrumLeft[index] * this._editorHeight + this._editorHeight / 2);
            pathR += "L " + prettyNumber(index / this.spectrumRight.length * this._editorWidth) + " " + prettyNumber(this.spectrumRight[index] * this._editorHeight + this._editorHeight / 2);
        }
        this._curveL.setAttribute("d", pathL);
        this._curveR.setAttribute("d", pathR);
    }

    private logarithmicIndex(index: number, array: Float32Array): number {
        const freq: number = this.minFreq * Math.pow(this.maxFreq / this.minFreq, index / this._editorWidth) / this.maxFreq * array.length;
        const freqInt: number = freq | 0;
        const freqRatio: number = freq - freqInt;
        return array[freqInt] * (1 - freqRatio) + array[freqInt + 1] * freqRatio;
    }

    private renderSpectrum() {
        if (!this.synth.isPlaying || this.spectrumLeft == null || this.spectrumRight == null) return;
        let pathL: string = "M 0 " + prettyNumber(this.spectrumLeft[0] * this._editorHeight + this._editorHeight / 2) + " ";
        let pathR: string = "M 0 " + prettyNumber(this.spectrumRight[0] * this._editorHeight + this._editorHeight / 2) + " ";
        for (let index: number = 1; index < this._editorWidth; index++) {
            pathL += "L " + prettyNumber(index) + " " + prettyNumber(this.logarithmicIndex(index, this.spectrumLeft) * this._editorHeight + this._editorHeight / 2);
            pathR += "L " + prettyNumber(index) + " " + prettyNumber(this.logarithmicIndex(index, this.spectrumRight) * this._editorHeight + this._editorHeight / 2);
        }
        this._curveL.setAttribute("d", pathL);
        this._curveR.setAttribute("d", pathR);
    }
}

function prettyNumber(value: number): string {
    if (Number.isFinite(value)) {
        const pretty: string = value.toFixed(2).replace(/\.?0*$/, "");
        return pretty == "NaN" ? "0" : pretty;
    } else {
        return "0";
    }
}