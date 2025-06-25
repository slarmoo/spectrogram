import { HTML, SVG } from "./imperative-html/elements-strict";
import type { Synth } from "./synth";
import { forwardRealFourierTransform } from "./fft";

export class Spectrogram {
    private readonly _editorWidth: number = 720;
    private readonly _editorHeight: number = 400;
    private readonly _curve: SVGPathElement = SVG.path({ fill: "none", stroke: "rgb(255, 255, 255)", "stroke-width": 2, "pointer-events": "none" });

    private readonly _svg: SVGSVGElement = SVG.svg({ style: `background-color:#09301cc0; touch-action: none; cursor: crosshair;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
        this._curve
    )

    public readonly container: HTMLElement = HTML.div({ class: "spectrogram", style: "width: " + this._editorWidth + "px; height: " + this._editorHeight +"px;" }, this._svg);

    private readonly synth;
    private spectrum: Float32Array | null = null;

    constructor(synth: Synth) {
        this.synth = synth;
    }

    public generateWave() {
        this.spectrum = this.synth.displayOutput;
        this.render();
    }

    public generateSpectrum() { //TODO: logarithmic scale
        if (this.synth.displayOutput) {
            const hold: Float32Array = this.synth.displayOutput.slice();
            forwardRealFourierTransform(hold);
            this.spectrum = new Float32Array(hold.length >> 1);
            for (let i: number = 0; i < hold.length >> 1; i++) {
                this.spectrum[i] = 0.3 - Math.abs(hold[i]);
            }
        }
        this.render();
    }

    private render() {
        if (!this.synth.isPlaying || this.spectrum == null) return;
        let path: string = "M 0 " + prettyNumber(this.spectrum[0] * this._editorHeight + this._editorHeight / 2) + " ";
        for (let index: number = 1; index < this.spectrum.length; index++) {
            path += "L " + prettyNumber(index / this.spectrum.length * this._editorWidth) + " " + prettyNumber(this.spectrum[index] * this._editorHeight + this._editorHeight/2 );
        }
        this._curve.setAttribute("d", path);
    }
}

function prettyNumber(value: number): string {
    return value.toFixed(2).replace(/\.?0*$/, "");
}