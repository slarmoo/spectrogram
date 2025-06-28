import { HTML, SVG } from "./imperative-html/elements-strict";
import type { Synth } from "./synth.ts";
import { forwardRealFourierTransform } from "./fft";

export class Spectrogram {
    private readonly _editorWidth: number = 720;
    private readonly _editorHeight: number = 400;
    private readonly _curve: SVGPathElement = SVG.path({ fill: "none", stroke: "rgb(255, 255, 255)", "stroke-width": 2, "pointer-events": "none" });
    private readonly _text: SVGTextElement = SVG.text({x: "20", y: this._editorHeight - 20, fill: "white"}, "");

    private readonly _svg: SVGSVGElement = SVG.svg({ style: `background-color:#072818; touch-action: none; cursor: crosshair;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
        this._curve,
        this._text
    )

    public readonly container: HTMLElement = HTML.div({ class: "spectrogram", style: "width: " + this._editorWidth + "px; height: " + this._editorHeight +"px;" }, this._svg);

    private readonly synth;
    private spectrum: Float32Array | null = null;

    constructor(synth: Synth) {
        this.synth = synth;
        // this.container.addEventListener("mousemove", this._hover);
    }

    public generateWave() {
        if (this.synth.display) {
            this.spectrum = this.synth.display;
            this.renderWave();
        }
    }

    public generateSpectrum() { //TODO: fix logarithmic scale
        if (this.synth.display) {
            const hold: Float32Array = this.synth.display.slice();
            forwardRealFourierTransform(hold);
            this.spectrum = new Float32Array(hold.length >> 1);
            for (let i: number = 0; i < hold.length >> 1; i++) {
                this.spectrum[i] = 0.45 - Math.abs(hold[i] *= 1/Math.sqrt(hold.length));
            }
        }
        this.renderSpectrum();
    }

    // private _mouseX: number = 0;
    // private _mouseY: number = 0;

    // private _hover = (event: MouseEvent): void => {
    //     if (this.container.offsetParent == null) return;
    //     const boundingRect: ClientRect = this._svg.getBoundingClientRect();
    //     this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
    //     this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
    // }

    private renderWave() {
        if (!this.synth.isPlaying || this.spectrum == null) return;
        let path: string = "M 0 " + prettyNumber(this.spectrum[0] * this._editorHeight + this._editorHeight / 2) + " ";
        for (let index: number = 1; index < this.spectrum.length; index++) {
            path += "L " + prettyNumber(index / this.spectrum.length * this._editorWidth) + " " + prettyNumber(this.spectrum[index] * this._editorHeight + this._editorHeight / 2);
        }
        this._curve.setAttribute("d", path);
    }

    private renderSpectrum() {
        if (!this.synth.isPlaying || this.spectrum == null) return;
        let path: string = "M 0 " + prettyNumber(this.spectrum[0] * this._editorHeight + this._editorHeight / 2) + " ";
        for (let index: number = 1; index < this.spectrum.length; index++) {
            // const x: number = (Math.pow(2, index / this.spectrum.length) - 1);
            // const x: number = (Math.log2(index / this.spectrum.length + 1));
            const x: number = (Math.log10(index * 9 / this.spectrum.length + 1));
            // const x: number = index / this.spectrum.length;
            path += "L " + prettyNumber(x * this._editorWidth) + " " + prettyNumber(this.spectrum[index] * this._editorHeight + this._editorHeight / 2);
        }
        this._curve.setAttribute("d", path);
        // if (isFinite(this._mouseX) && isFinite(this._mouseY)) {
        //     const filterFreqReferenceHz = 4000;
        //     const filterFreqReferenceSetting = 0;
        //     const filterFreqStep = 1;
        //     const freq: number = filterFreqReferenceHz * Math.pow(2.0, (this._mouseX / this._editorWidth - filterFreqReferenceSetting) * filterFreqStep); 
        //     this._text.textContent = isFinite(freq) && !isNaN(freq) ? prettyNumber(freq) : "";
        // } else {
        //     this._text.textContent = "";
        // }
    }
}

function prettyNumber(value: number): string {
    return value.toFixed(2).replace(/\.?0*$/, "");
}