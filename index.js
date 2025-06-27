(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class Synth {
  constructor() {
    this.isPlaying = false;
    this.initialized = false;
    this.audioContext = null;
    this.workletNode = null;
    this.displayOutput = null;
  }
  async initializeFileData(data) {
    await this.activate();
    const buffer = await this.audioContext.decodeAudioData(data);
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "initialize",
        audioFileL: buffer.getChannelData(0),
        audioFileR: buffer.getChannelData(1)
      });
      this.initialized = true;
    }
    if (!this.isPlaying) {
      this.togglePause();
    }
  }
  togglePause() {
    this.isPlaying = !this.isPlaying && this.initialized;
    if (this.isPlaying) {
      this.activate();
    }
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "play",
        isPlaying: this.isPlaying
      });
    }
  }
  async activate() {
    if (this.audioContext == null || this.workletNode == null) {
      const latencyHint = "balanced";
      this.audioContext = this.audioContext || new AudioContext({ latencyHint });
      const url_worklet = URL.createObjectURL(new Blob(["(", (function() {
        class WorkletProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.audioFileL = null;
            this.audioFileR = null;
            this.audioFileIndex = 0;
            this.isPlaying = false;
            this.port.onmessage = (event) => {
              if (event.data.type == "initialize") {
                this.audioFileL = event.data.audioFileL;
                this.audioFileR = event.data.audioFileR;
              }
              if (event.data.type == "play") {
                this.isPlaying = event.data.isPlaying;
              }
            };
          }
          process(_, outputs) {
            const outputDataL = outputs[0][0];
            const outputDataR = outputs[0][1];
            if (this.isPlaying && this.audioFileL && this.audioFileR) {
              for (let i = 0; i < outputDataL.length; i++) {
                outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                outputDataR[i] = this.audioFileR[this.audioFileIndex + i];
              }
              this.audioFileIndex += outputDataL.length;
              if (this.audioFileIndex >= this.audioFileL.length) {
                this.audioFileIndex %= this.audioFileL.length;
              }
            } else if (this.isPlaying && this.audioFileL) {
              for (let i = 0; i < outputDataL.length; i++) {
                outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                outputDataR[i] = this.audioFileL[this.audioFileIndex + i];
              }
              this.audioFileIndex += outputDataL.length;
              if (this.audioFileIndex >= this.audioFileL.length) {
                this.audioFileIndex %= this.audioFileL.length;
              }
            } else {
              outputDataL.fill(0);
              outputDataR.fill(0);
            }
            this.port.postMessage({
              type: "render",
              displayOutput: outputDataL.slice()
            });
            return true;
          }
        }
        registerProcessor("synth-processor", WorkletProcessor);
      }).toString(), ")()"], { type: "application/javascript" }));
      await this.audioContext.audioWorklet.addModule(url_worklet);
      this.workletNode = new AudioWorkletNode(this.audioContext, "synth-processor", { numberOfOutputs: 1, outputChannelCount: [2] });
      this.workletNode.connect(this.audioContext.destination);
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type == "render") {
          this.displayOutput = event.data.displayOutput;
        }
      };
    }
    await this.audioContext.resume();
  }
  // private deactivate(): void {
  //     if (this.audioContext != null && this.workletNode != null) {
  //         this.workletNode.disconnect(this.audioContext.destination);
  //         this.workletNode = null;
  //         this.audioContext.close();
  //         this.audioContext = null;
  //     }
  // }
}
function applyElementArgs(element, args) {
  for (const arg of args) {
    if (arg instanceof Node) {
      element.appendChild(arg);
    } else if (typeof arg === "string") {
      element.appendChild(document.createTextNode(arg));
    } else if (typeof arg === "function") {
      applyElementArgs(element, [arg()]);
    } else if (Array.isArray(arg)) {
      applyElementArgs(element, arg);
    } else if (arg && typeof Symbol !== "undefined" && typeof arg[Symbol.iterator] === "function") {
      applyElementArgs(element, [...arg]);
    } else if (arg && arg.constructor === Object && element instanceof Element) {
      for (const key of Object.keys(arg)) {
        const value = arg[key];
        if (key === "class") {
          if (typeof value === "string") {
            element.setAttribute("class", value);
          } else if (Array.isArray(arg) || value && typeof Symbol !== "undefined" && typeof value[Symbol.iterator] === "function") {
            element.setAttribute("class", [...value].join(" "));
          } else {
            console.warn("Invalid " + key + ' value "' + value + '" on ' + element.tagName + " element.");
          }
        } else if (key === "style") {
          if (value && value.constructor === Object) {
            for (const styleKey of Object.keys(value)) {
              if (styleKey in element.style) {
                element.style[styleKey] = value[styleKey];
              } else {
                element.style.setProperty(styleKey, value[styleKey]);
              }
            }
          } else {
            element.setAttribute(key, value);
          }
        } else if (typeof value === "function") {
          element[key] = value;
        } else if (typeof value === "boolean") {
          if (value) element.setAttribute(key, "");
          else element.removeAttribute(key);
        } else {
          element.setAttribute(key, value);
        }
      }
    } else {
      element.appendChild(document.createTextNode(arg));
    }
  }
  return element;
}
const svgNS = "http://www.w3.org/2000/svg";
function parseHTML(...args) {
  return document.createRange().createContextualFragment(args.join());
}
function parseSVG(...args) {
  const fragment = document.createDocumentFragment();
  const svgParser = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + args.join() + "</svg>", "image/svg+xml").documentElement;
  while (svgParser.firstChild !== null) {
    document.importNode(svgParser.firstChild, true);
    fragment.appendChild(svgParser.firstChild);
  }
  return fragment;
}
const HTML = parseHTML;
const SVG = parseSVG;
for (const name of "a abbr address area article aside audio b base bdi bdo blockquote br button canvas caption cite code col colgroup datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i iframe img input ins kbd label legend li link main map mark menu menuitem meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr".split(" ")) {
  HTML[name] = (...args) => applyElementArgs(document.createElement(name), args);
}
for (const name of "a altGlyph altGlyphDef altGlyphItem animate animateMotion animateTransform circle clipPath color-profile cursor defs desc discard ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph mpath path pattern polygon polyline radialGradient rect script set stop style svg switch symbol text textPath title tref tspan use view vkern".split(" ")) {
  SVG[name] = (...args) => applyElementArgs(document.createElementNS(svgNS, name), args);
  if (/-/.test(name)) {
    const snakeCaseName = name.replace(/-/g, "_");
    SVG[snakeCaseName] = (...args) => applyElementArgs(document.createElementNS(svgNS, name), args);
  }
}
function isPowerOf2(n) {
  return !!n && !(n & n - 1);
}
function countBits(n) {
  if (!isPowerOf2(n)) throw new Error("FFT array length must be a power of 2.");
  return Math.round(Math.log(n) / Math.log(2));
}
function reverseIndexBits(array, fullArrayLength) {
  const bitCount = countBits(fullArrayLength);
  if (bitCount > 16) throw new Error("FFT array length must not be greater than 2^16.");
  const finalShift = 16 - bitCount;
  for (let i = 0; i < fullArrayLength; i++) {
    let j;
    j = (i & 43690) >> 1 | (i & 21845) << 1;
    j = (j & 52428) >> 2 | (j & 13107) << 2;
    j = (j & 61680) >> 4 | (j & 3855) << 4;
    j = (j >> 8 | (j & 255) << 8) >> finalShift;
    if (j > i) {
      let temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }
}
function forwardRealFourierTransform(array) {
  const fullArrayLength = array.length;
  const totalPasses = countBits(fullArrayLength);
  if (fullArrayLength < 4) throw new Error("FFT array length must be at least 4.");
  reverseIndexBits(array, fullArrayLength);
  for (let index = 0; index < fullArrayLength; index += 4) {
    const index1 = index + 1;
    const index2 = index + 2;
    const index3 = index + 3;
    const real0 = array[index];
    const real1 = array[index1];
    const real2 = array[index2];
    const real3 = array[index3];
    const tempA = real0 + real1;
    const tempB = real2 + real3;
    array[index] = tempA + tempB;
    array[index1] = real0 - real1;
    array[index2] = tempA - tempB;
    array[index3] = real2 - real3;
  }
  const sqrt2over2 = Math.sqrt(2) / 2;
  for (let index = 0; index < fullArrayLength; index += 8) {
    const index1 = index + 1;
    const index3 = index + 3;
    const index4 = index + 4;
    const index5 = index + 5;
    const index7 = index + 7;
    const real0 = array[index];
    const real1 = array[index1];
    const imag3 = array[index3];
    const real4 = array[index4];
    const real5 = array[index5];
    const imag7 = array[index7];
    const tempA = (real5 - imag7) * sqrt2over2;
    const tempB = (real5 + imag7) * sqrt2over2;
    array[index] = real0 + real4;
    array[index1] = real1 + tempA;
    array[index3] = real1 - tempA;
    array[index4] = real0 - real4;
    array[index5] = tempB - imag3;
    array[index7] = tempB + imag3;
  }
  for (let pass = 3; pass < totalPasses; pass++) {
    const subStride = 1 << pass;
    const midSubStride = subStride >> 1;
    const stride = subStride << 1;
    const radiansIncrement = Math.PI * 2 / stride;
    const cosIncrement = Math.cos(radiansIncrement);
    const sinIncrement = Math.sin(radiansIncrement);
    const oscillatorMultiplier = 2 * cosIncrement;
    for (let startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
      const startIndexA = startIndex;
      const startIndexB = startIndexA + subStride;
      const stopIndex = startIndexB + subStride;
      const realStartA = array[startIndexA];
      const realStartB = array[startIndexB];
      array[startIndexA] = realStartA + realStartB;
      array[startIndexB] = realStartA - realStartB;
      let c = cosIncrement;
      let s = -sinIncrement;
      let cPrev = 1;
      let sPrev = 0;
      for (let index = 1; index < midSubStride; index++) {
        const indexA0 = startIndexA + index;
        const indexA1 = startIndexB - index;
        const indexB0 = startIndexB + index;
        const indexB1 = stopIndex - index;
        const real0 = array[indexA0];
        const imag0 = array[indexA1];
        const real1 = array[indexB0];
        const imag1 = array[indexB1];
        const tempA = real1 * c + imag1 * s;
        const tempB = real1 * s - imag1 * c;
        array[indexA0] = real0 + tempA;
        array[indexA1] = real0 - tempA;
        array[indexB0] = -imag0 - tempB;
        array[indexB1] = imag0 - tempB;
        const cTemp = oscillatorMultiplier * c - cPrev;
        const sTemp = oscillatorMultiplier * s - sPrev;
        cPrev = c;
        sPrev = s;
        c = cTemp;
        s = sTemp;
      }
    }
  }
}
class Spectrogram {
  constructor(synth2) {
    this._editorWidth = 720;
    this._editorHeight = 400;
    this._curve = SVG.path({ fill: "none", stroke: "rgb(255, 255, 255)", "stroke-width": 2, "pointer-events": "none" });
    this._text = SVG.text({ x: "20", y: this._editorHeight - 20, fill: "white" }, "");
    this._svg = SVG.svg(
      { style: `background-color:#09301cc0; touch-action: none; cursor: crosshair;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
      this._curve,
      this._text
    );
    this.container = HTML.div({ class: "spectrogram", style: "width: " + this._editorWidth + "px; height: " + this._editorHeight + "px;" }, this._svg);
    this.spectrum = null;
    this.synth = synth2;
  }
  generateWave() {
    this.spectrum = this.synth.displayOutput;
    this.renderWave();
  }
  generateSpectrum() {
    if (this.synth.displayOutput) {
      const hold = this.synth.displayOutput.slice();
      forwardRealFourierTransform(hold);
      this.spectrum = new Float32Array(hold.length >> 1);
      for (let i = 0; i < hold.length >> 1; i++) {
        this.spectrum[i] = 0.45 - Math.abs(hold[i] *= 1 / Math.sqrt(hold.length));
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
  renderWave() {
    if (!this.synth.isPlaying || this.spectrum == null) return;
    let path = "M 0 " + prettyNumber(this.spectrum[0] * this._editorHeight + this._editorHeight / 2) + " ";
    for (let index = 1; index < this.spectrum.length; index++) {
      path += "L " + prettyNumber(index / this.spectrum.length * this._editorWidth) + " " + prettyNumber(this.spectrum[index] * this._editorHeight + this._editorHeight / 2);
    }
    this._curve.setAttribute("d", path);
  }
  renderSpectrum() {
    if (!this.synth.isPlaying || this.spectrum == null) return;
    let path = "M 0 " + prettyNumber(this.spectrum[0] * this._editorHeight + this._editorHeight / 2) + " ";
    for (let index = 1; index < this.spectrum.length; index++) {
      path += "L " + prettyNumber(Math.log2(index / this.spectrum.length + 1) * this._editorWidth) + " " + prettyNumber(this.spectrum[index] * this._editorHeight + this._editorHeight / 2);
    }
    this._curve.setAttribute("d", path);
  }
}
function prettyNumber(value) {
  return value.toFixed(2).replace(/\.?0*$/, "");
}
const synth = new Synth();
const spectrogram = new Spectrogram(synth);
const oscilloscope = new Spectrogram(synth);
const updateSpeed = 50;
const fileInput = document.getElementById("fileInput");
const playButton = document.getElementById("playButton");
const graphContainer = document.getElementById("graphs");
graphContainer.appendChild(oscilloscope.container);
graphContainer.appendChild(spectrogram.container);
fileInput.addEventListener("change", async () => {
  if (fileInput.files == null) return;
  for (const file of fileInput.files) {
    const data = await file.arrayBuffer();
    await synth.initializeFileData(data);
    playButton.innerHTML = synth.isPlaying ? "pause" : "play";
    break;
  }
  fileInput.blur();
});
playButton.addEventListener("click", () => {
  togglePause();
});
document.addEventListener("keypress", (event) => {
  if (event.key == " ") {
    togglePause();
    event.preventDefault();
  }
});
function togglePause() {
  synth.togglePause();
  playButton.innerHTML = synth.isPlaying ? "pause" : "play";
}
setInterval(() => {
  oscilloscope.generateWave();
  spectrogram.generateSpectrum();
}, updateSpeed);
