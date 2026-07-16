//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region src/events.ts
var Events = /* @__PURE__ */ function(Events) {
	Events[Events["initialize"] = 0] = "initialize";
	Events[Events["play"] = 1] = "play";
	Events[Events["render"] = 2] = "render";
	Events[Events["skip"] = 3] = "skip";
	Events[Events["export"] = 4] = "export";
	Events[Events["value"] = 5] = "value";
	return Events;
}({});
//#endregion
//#region src/synth.ts
var Synth = class {
	constructor() {
		this.isPlaying = false;
		this.initialized = false;
		this.audioContext = null;
		this.workletNode = null;
		this.splitterNode = null;
		this.analyserNodeLeft = null;
		this.analyserNodeRight = null;
		this.updateFreq = () => {};
		this.fftSize = 8192;
		this.displayFFTLeft = new Float32Array(this.fftSize / 2);
		this.displayFFTRight = new Float32Array(this.fftSize / 2);
		this.displayTimeLeft = /* @__PURE__ */ new Float32Array(1024);
		this.displayTimeRight = /* @__PURE__ */ new Float32Array(1024);
	}
	async initializeFileData(data) {
		await this.activate();
		this.updateFreq(this.audioContext?.sampleRate || 48e3);
		const buffer = await this.audioContext.decodeAudioData(data);
		if (this.workletNode) {
			this.workletNode.port.postMessage({
				type: "initialize",
				audioFileL: buffer.getChannelData(0),
				audioFileR: buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
			});
			this.initialized = true;
		}
		if (!this.isPlaying) this.togglePause();
	}
	togglePause() {
		this.isPlaying = !this.isPlaying && this.initialized;
		if (this.isPlaying) this.activate();
		if (this.workletNode) this.workletNode.port.postMessage({
			type: "play",
			isPlaying: this.isPlaying
		});
	}
	async activate() {
		if (this.audioContext == null || this.workletNode == null) {
			const latencyHint = "balanced";
			this.audioContext = this.audioContext || new AudioContext({ latencyHint });
			const url_worklet = URL.createObjectURL(new Blob([
				"(",
				function() {
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
									this.audioFileIndex = 0;
								}
								if (event.data.type == "play") this.isPlaying = event.data.isPlaying;
							};
						}
						process(_, outputs) {
							const outputDataL = outputs[0][0];
							const outputDataR = outputs[0][1];
							if (this.isPlaying && this.audioFileL && this.audioFileR) {
								for (let i = 0; i < outputDataL.length; i++) {
									outputDataL[i] = this.audioFileL[this.audioFileIndex + i] || 0;
									outputDataR[i] = this.audioFileR[this.audioFileIndex + i] || 0;
								}
								this.audioFileIndex += outputDataL.length;
								if (this.audioFileIndex >= this.audioFileL.length) this.audioFileIndex %= this.audioFileL.length;
							} else {
								outputDataL.fill(0);
								outputDataR.fill(0);
							}
							this.port.postMessage({
								type: 2,
								displayOutput: outputDataL.slice()
							});
							return true;
						}
					}
					registerProcessor("synth-processor", WorkletProcessor);
				}.toString(),
				")()"
			], { type: "application/javascript" }));
			await this.audioContext.audioWorklet.addModule(url_worklet);
			this.workletNode = new AudioWorkletNode(this.audioContext, "synth-processor", {
				numberOfOutputs: 1,
				outputChannelCount: [2],
				channelInterpretation: "speakers",
				channelCountMode: "explicit",
				numberOfInputs: 0
			});
			if (!this.splitterNode) this.splitterNode = new ChannelSplitterNode(this.audioContext, { numberOfOutputs: 2 });
			if (!this.analyserNodeLeft) this.analyserNodeLeft = new AnalyserNode(this.audioContext, {
				channelCount: 2,
				channelInterpretation: "speakers",
				channelCountMode: "explicit",
				fftSize: this.fftSize,
				smoothingTimeConstant: .1
			});
			if (!this.analyserNodeRight) this.analyserNodeRight = new AnalyserNode(this.audioContext, {
				channelCount: 2,
				channelInterpretation: "speakers",
				channelCountMode: "explicit",
				fftSize: this.fftSize,
				smoothingTimeConstant: .1
			});
			this.workletNode.connect(this.splitterNode);
			this.splitterNode.connect(this.analyserNodeLeft, 0);
			this.splitterNode.connect(this.analyserNodeRight, 1);
			this.workletNode.connect(this.audioContext.destination);
			this.workletNode.port.onmessage = (event) => {
				if (event.data.type == Events.render) {
					this.analyserNodeLeft.getFloatTimeDomainData(this.displayTimeLeft);
					this.analyserNodeRight.getFloatTimeDomainData(this.displayTimeRight);
					this.analyserNodeLeft.getFloatFrequencyData(this.displayFFTLeft);
					this.analyserNodeRight.getFloatFrequencyData(this.displayFFTRight);
				} else if (event.data.type == Events.export) {
					const sampleFrames = event.data.L.length;
					const sampleRate = event.data.sampleRate;
					const wavChannelCount = 2;
					const bytesPerSample = 2;
					const bitsPerSample = 8 * bytesPerSample;
					const sampleCount = wavChannelCount * sampleFrames;
					const totalFileSize = 44 + sampleCount * bytesPerSample;
					let index = 0;
					const arrayBuffer = new ArrayBuffer(totalFileSize);
					const data = new DataView(arrayBuffer);
					data.setUint32(index, 1380533830, false);
					index += 4;
					data.setUint32(index, 36 + sampleCount * bytesPerSample, true);
					index += 4;
					data.setUint32(index, 1463899717, false);
					index += 4;
					data.setUint32(index, 1718449184, false);
					index += 4;
					data.setUint32(index, 16, true);
					index += 4;
					data.setUint16(index, 1, true);
					index += 2;
					data.setUint16(index, wavChannelCount, true);
					index += 2;
					data.setUint32(index, sampleRate, true);
					index += 4;
					data.setUint32(index, sampleRate * bytesPerSample * wavChannelCount, true);
					index += 4;
					data.setUint16(index, bytesPerSample * wavChannelCount, true);
					index += 2;
					data.setUint16(index, bitsPerSample, true);
					index += 2;
					data.setUint32(index, 1684108385, false);
					index += 4;
					data.setUint32(index, sampleCount * bytesPerSample, true);
					index += 4;
					{
						const range = (1 << bitsPerSample - 1) - 1;
						for (let i = 0; i < sampleFrames; i++) {
							let valL = Math.floor(Math.max(-1, Math.min(1, event.data.L[i])) * range);
							let valR = Math.floor(Math.max(-1, Math.min(1, event.data.R[i])) * range);
							data.setInt16(index, valL, true);
							index += 2;
							data.setInt16(index, valR, true);
							index += 2;
						}
					}
					const blob = new Blob([arrayBuffer], { type: "audio/wav" });
					this.save(blob, "reverbTest.wav");
				}
			};
		}
		await this.audioContext.resume();
	}
	export() {
		this.workletNode?.port.postMessage({ type: Events.export });
	}
	save(blob, name) {
		if (navigator.msSaveOrOpenBlob) {
			navigator.msSaveOrOpenBlob(blob, name);
			return;
		}
		const anchor = document.createElement("a");
		if (anchor.download != void 0) {
			const url = URL.createObjectURL(blob);
			setTimeout(function() {
				URL.revokeObjectURL(url);
			}, 6e4);
			anchor.href = url;
			anchor.download = name;
			setTimeout(function() {
				anchor.dispatchEvent(new MouseEvent("click"));
			}, 0);
		} else {
			const url = URL.createObjectURL(blob);
			setTimeout(function() {
				URL.revokeObjectURL(url);
			}, 6e4);
			if (!window.open(url, "_blank")) window.location.href = url;
		}
	}
};
//#endregion
//#region src/imperative-html/elements-base.ts
function applyElementArgs(element, args) {
	for (const arg of args) if (arg instanceof Node) element.appendChild(arg);
	else if (typeof arg === "string") element.appendChild(document.createTextNode(arg));
	else if (typeof arg === "function") applyElementArgs(element, [arg()]);
	else if (Array.isArray(arg)) applyElementArgs(element, arg);
	else if (arg && typeof Symbol !== "undefined" && typeof arg[Symbol.iterator] === "function") applyElementArgs(element, [...arg]);
	else if (arg && arg.constructor === Object && element instanceof Element) for (const key of Object.keys(arg)) {
		const value = arg[key];
		if (key === "class") if (typeof value === "string") element.setAttribute("class", value);
		else if (Array.isArray(arg) || value && typeof Symbol !== "undefined" && typeof value[Symbol.iterator] === "function") element.setAttribute("class", [...value].join(" "));
		else console.warn("Invalid " + key + " value \"" + value + "\" on " + element.tagName + " element.");
		else if (key === "style") if (value && value.constructor === Object) for (const styleKey of Object.keys(value)) if (styleKey in element.style) element.style[styleKey] = value[styleKey];
		else element.style.setProperty(styleKey, value[styleKey]);
		else element.setAttribute(key, value);
		else if (typeof value === "function") element[key] = value;
		else if (typeof value === "boolean") if (value) element.setAttribute(key, "");
		else element.removeAttribute(key);
		else element.setAttribute(key, value);
	}
	else element.appendChild(document.createTextNode(arg));
	return element;
}
var svgNS = "http://www.w3.org/2000/svg";
function parseHTML(...args) {
	return document.createRange().createContextualFragment(args.join());
}
function parseSVG(...args) {
	const fragment = document.createDocumentFragment();
	const svgParser = new DOMParser().parseFromString("<svg xmlns=\"http://www.w3.org/2000/svg\">" + args.join() + "</svg>", "image/svg+xml").documentElement;
	while (svgParser.firstChild !== null) {
		document.importNode(svgParser.firstChild, true);
		fragment.appendChild(svgParser.firstChild);
	}
	return fragment;
}
//#endregion
//#region src/imperative-html/elements-strict.ts
var HTML = parseHTML;
var SVG = parseSVG;
for (const name of "a abbr address area article aside audio b base bdi bdo blockquote br button canvas caption cite code col colgroup datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i iframe img input ins kbd label legend li link main map mark menu menuitem meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script section select small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr".split(" ")) HTML[name] = (...args) => applyElementArgs(document.createElement(name), args);
for (const name of "a altGlyph altGlyphDef altGlyphItem animate animateMotion animateTransform circle clipPath color-profile cursor defs desc discard ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph mpath path pattern polygon polyline radialGradient rect script set stop style svg switch symbol text textPath title tref tspan use view vkern".split(" ")) {
	SVG[name] = (...args) => applyElementArgs(document.createElementNS(svgNS, name), args);
	if (/-/.test(name)) {
		const snakeCaseName = name.replace(/-/g, "_");
		SVG[snakeCaseName] = (...args) => applyElementArgs(document.createElementNS(svgNS, name), args);
	}
}
//#endregion
//#region src/spectrogram.ts
var Spectrogram = class {
	constructor(synth, renderFrequencies = false) {
		this._editorWidth = 720;
		this._editorHeight = 400;
		this._curveL = SVG.path({
			fill: "none",
			stroke: "rgb(255, 255, 255)",
			"stroke-width": 2,
			"pointer-events": "none"
		});
		this._curveR = SVG.path({
			fill: "none",
			stroke: "rgb(85, 199, 216)",
			"stroke-width": 2,
			"pointer-events": "none"
		});
		this._text = SVG.text({
			x: "20",
			y: this._editorHeight - 20,
			fill: "white"
		}, "");
		this._svg = SVG.svg({
			style: `background-color:#072818; touch-action: none; cursor: crosshair;`,
			width: "100%",
			height: "100%",
			viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight,
			preserveAspectRatio: "none"
		}, this._curveL, this._curveR, this._text);
		this.container = HTML.div({
			class: "spectrogram",
			style: "width: " + this._editorWidth + "px; height: " + this._editorHeight + "px;"
		}, this._svg);
		this.spectrumLeft = null;
		this.spectrumRight = null;
		this.maxFreq = 24e3;
		this.minFreq = 20;
		this._mouseX = 0;
		this._mouseY = 0;
		this._hover = (event) => {
			if (this.container.offsetParent == null) {
				this._text.textContent = "";
				return;
			}
			const boundingRect = this._svg.getBoundingClientRect();
			this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
			this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
			if (this._mouseX <= 0 || this._mouseY <= 0 || this._mouseX >= this._editorWidth || this._mouseY >= this._editorHeight) {
				this._text.textContent = "";
				return;
			}
			this._text.textContent = (this.minFreq * Math.pow(this.maxFreq / this.minFreq, this._mouseX / this._editorWidth) | 0) + "hz";
		};
		this.synth = synth;
		if (renderFrequencies) {
			this.synth.updateFreq = (sampleRate) => this.maxFreq = sampleRate / 2;
			this.container.addEventListener("mousemove", this._hover);
			this.container.addEventListener("mouseleave", () => this._text.textContent = "");
		}
	}
	generateWave() {
		this.spectrumLeft = this.synth.displayTimeLeft;
		this.spectrumRight = this.synth.displayTimeRight;
		this.renderWave();
	}
	generateSpectrum() {
		this.spectrumLeft = this.synth.displayFFTLeft.map((val) => (val + 80) / -160);
		this.spectrumRight = this.synth.displayFFTRight.map((val) => (val + 80) / -160);
		this.renderSpectrum();
	}
	renderWave() {
		if (!this.synth.isPlaying || this.spectrumLeft == null || this.spectrumRight == null) return;
		let pathL = "M 0 " + prettyNumber(this.spectrumLeft[0] * this._editorHeight + this._editorHeight / 2) + " ";
		let pathR = "M 0 " + prettyNumber(this.spectrumRight[0] * this._editorHeight + this._editorHeight / 2) + " ";
		for (let index = 1; index < this.spectrumLeft.length; index++) {
			pathL += "L " + prettyNumber(index / this.spectrumLeft.length * this._editorWidth) + " " + prettyNumber(this.spectrumLeft[index] * this._editorHeight + this._editorHeight / 2);
			pathR += "L " + prettyNumber(index / this.spectrumRight.length * this._editorWidth) + " " + prettyNumber(this.spectrumRight[index] * this._editorHeight + this._editorHeight / 2);
		}
		this._curveL.setAttribute("d", pathL);
		this._curveR.setAttribute("d", pathR);
	}
	logarithmicIndex(index, array) {
		const freq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, index / this._editorWidth) / this.maxFreq * array.length;
		const freqInt = freq | 0;
		const freqRatio = freq - freqInt;
		return array[freqInt] * (1 - freqRatio) + array[freqInt + 1] * freqRatio;
	}
	renderSpectrum() {
		if (!this.synth.isPlaying || this.spectrumLeft == null || this.spectrumRight == null) return;
		let pathL = "M 0 " + prettyNumber(this.spectrumLeft[0] * this._editorHeight + this._editorHeight / 2) + " ";
		let pathR = "M 0 " + prettyNumber(this.spectrumRight[0] * this._editorHeight + this._editorHeight / 2) + " ";
		for (let index = 1; index < this._editorWidth; index++) {
			pathL += "L " + prettyNumber(index) + " " + prettyNumber(this.logarithmicIndex(index, this.spectrumLeft) * this._editorHeight + this._editorHeight / 2);
			pathR += "L " + prettyNumber(index) + " " + prettyNumber(this.logarithmicIndex(index, this.spectrumRight) * this._editorHeight + this._editorHeight / 2);
		}
		this._curveL.setAttribute("d", pathL);
		this._curveR.setAttribute("d", pathR);
	}
};
function prettyNumber(value) {
	if (Number.isFinite(value)) {
		const pretty = value.toFixed(2).replace(/\.?0*$/, "");
		return pretty == "NaN" ? "0" : pretty;
	} else return "0";
}
//#endregion
//#region src/main.ts
var synth = new Synth();
var spectrogram = new Spectrogram(synth, true);
var oscilloscope = new Spectrogram(synth);
var fileInput = document.getElementById("fileInput");
var linkInput = document.getElementById("fetchurl");
var submitButton = document.getElementById("submit");
var playButton = document.getElementById("playButton");
var graphContainer = document.getElementById("graphs");
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
submitButton.addEventListener("click", () => {
	if (!linkInput.value) return;
	fetch(linkInput.value).then((r) => r.arrayBuffer()).then((data) => synth.initializeFileData(data)).then(() => playButton.innerHTML = synth.isPlaying ? "pause" : "play");
});
playButton.addEventListener("click", () => {
	togglePause();
	playButton.blur();
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
render();
function render() {
	requestAnimationFrame(() => {
		oscilloscope.generateWave();
		spectrogram.generateSpectrum();
		render();
	});
}
//#endregion
