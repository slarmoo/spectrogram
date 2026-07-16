import { Events } from "./events";

export class Synth {
    public isPlaying: boolean = false;
    private initialized: boolean = false;

    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private splitterNode: ChannelSplitterNode | null = null;
    private analyserNodeLeft: AnalyserNode | null = null;
    private analyserNodeRight: AnalyserNode | null = null;
    public updateFreq: (sampleRate: number) => void = () => {};

    private readonly fftSize: number = 8192;

    //visuals
    public displayFFTLeft: Float32Array = new Float32Array(this.fftSize / 2);
    public displayFFTRight: Float32Array = new Float32Array(this.fftSize / 2);
    public displayTimeLeft: Float32Array = new Float32Array(1024);
    public displayTimeRight: Float32Array = new Float32Array(1024);

    public async initializeFileData(data: ArrayBuffer) {
        await this.activate();
        this.updateFreq(this.audioContext?.sampleRate || 48000);
        const buffer: AudioBuffer = await this.audioContext!.decodeAudioData(data);

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'initialize',
                audioFileL: buffer.getChannelData(0),
                // audioFileR: buffer.getChannelData(1)
                audioFileR: buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0),
            });
            this.initialized = true;
        }
        
        if (!this.isPlaying) {
            this.togglePause();
        }
    }

    public togglePause() {
        this.isPlaying = !this.isPlaying && this.initialized;
        if (this.isPlaying) {
            this.activate();
            
        }
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'play',
                isPlaying: this.isPlaying,
        });
        }
    }

    private async activate() {
        if (this.audioContext == null || this.workletNode == null) {
            const latencyHint: AudioContextLatencyCategory = "balanced";
            this.audioContext = this.audioContext || new AudioContext({ latencyHint: latencyHint });

            //a kind of hacky way to get the audioworklet to work with typescript + vite
            const url_worklet = URL.createObjectURL(new Blob(['(', function () {

                class WorkletProcessor extends AudioWorkletProcessor {
                    private audioFileL: Float32Array | null = null;
                    private audioFileR: Float32Array | null = null;
                    private audioFileIndex: number = 0;
                    private isPlaying: boolean = false;

                    constructor() {
                        super();

                        this.port.onmessage = (event) => {
                            if (event.data.type == 'initialize') {
                                this.audioFileL = event.data.audioFileL;
                                this.audioFileR = event.data.audioFileR;
                                this.audioFileIndex = 0;
                            }
                            if (event.data.type == 'play') {
                                this.isPlaying = event.data.isPlaying;
                            }
                        };
                    }
                    process(_: Float32Array[][], outputs: Float32Array[][]) {
                        const outputDataL: Float32Array = outputs[0][0];
                        const outputDataR: Float32Array = outputs[0][1];
                        if (this.isPlaying && this.audioFileL && this.audioFileR) {
                            for (let i: number = 0; i < outputDataL.length; i++) {
                                outputDataL[i] = this.audioFileL[this.audioFileIndex + i] || 0;
                                outputDataR[i] = this.audioFileR[this.audioFileIndex + i] || 0;
                            }
                            this.audioFileIndex += outputDataL.length;
                            if (this.audioFileIndex >= this.audioFileL.length) {
                                this.audioFileIndex %= this.audioFileL.length;
                            }
                        // } else if (this.isPlaying && this.audioFileL) { //mono
                        //     for (let i: number = 0; i < outputDataL.length; i++) {
                        //         outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                        //         outputDataR[i] = this.audioFileL[this.audioFileIndex + i];
                        //     }
                        //     this.audioFileIndex += outputDataL.length;
                        //     if (this.audioFileIndex >= this.audioFileL.length) {
                        //         this.audioFileIndex %= this.audioFileL.length;
                        //     }
                        } else {
                            outputDataL.fill(0);
                            outputDataR.fill(0);
                        }

                        this.port.postMessage({
                            type: 2,
                            displayOutput: outputDataL.slice(),
                        });

                        return true;
                    }
                }
                registerProcessor('synth-processor', WorkletProcessor);

            }.toString(), ')()'], { type: 'application/javascript' } ) );

            await this.audioContext.audioWorklet.addModule(url_worklet);
            this.workletNode = new AudioWorkletNode(this.audioContext!, 'synth-processor', {
                numberOfOutputs: 1,
                outputChannelCount: [2],
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                numberOfInputs: 0
            });
            if (!this.splitterNode) this.splitterNode = new ChannelSplitterNode(this.audioContext!, { numberOfOutputs: 2 });
            if (!this.analyserNodeLeft) this.analyserNodeLeft = new AnalyserNode(this.audioContext!, {
                channelCount: 2,
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                fftSize: this.fftSize,
                smoothingTimeConstant: 0.1
            });
            if (!this.analyserNodeRight) this.analyserNodeRight = new AnalyserNode(this.audioContext!, {
                channelCount: 2,
                channelInterpretation: "speakers",
                channelCountMode: "explicit",
                fftSize: this.fftSize,
                smoothingTimeConstant: 0.1
            });
            
            this.workletNode.connect(this.splitterNode);
            this.splitterNode.connect(this.analyserNodeLeft, 0);
            this.splitterNode.connect(this.analyserNodeRight, 1);

            this.workletNode.connect(this.audioContext.destination);
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type == Events.render) {
                    this.analyserNodeLeft!.getFloatTimeDomainData(this.displayTimeLeft);
                    this.analyserNodeRight!.getFloatTimeDomainData(this.displayTimeRight);
                    this.analyserNodeLeft!.getFloatFrequencyData(this.displayFFTLeft);
                    this.analyserNodeRight!.getFloatFrequencyData(this.displayFFTRight);
                } else if (event.data.type == Events.export) {
                    const sampleFrames: number = event.data.L.length;
                    const sampleRate: number = event.data.sampleRate

                    const wavChannelCount: number = 2;
                    const bytesPerSample: number = 2;
                    const bitsPerSample: number = 8 * bytesPerSample;
                    const sampleCount: number = wavChannelCount * sampleFrames;

                    const totalFileSize: number = 44 + sampleCount * bytesPerSample;

                    let index: number = 0;
                    const arrayBuffer: ArrayBuffer = new ArrayBuffer(totalFileSize);
                    const data: DataView = new DataView(arrayBuffer);
                    data.setUint32(index, 0x52494646, false); index += 4;
                    data.setUint32(index, 36 + sampleCount * bytesPerSample, true); index += 4; // size of remaining file
                    data.setUint32(index, 0x57415645, false); index += 4;
                    data.setUint32(index, 0x666D7420, false); index += 4;
                    data.setUint32(index, 0x00000010, true); index += 4; // size of following header
                    data.setUint16(index, 0x0001, true); index += 2; // not compressed
                    data.setUint16(index, wavChannelCount, true); index += 2; // channel count
                    data.setUint32(index, sampleRate, true); index += 4; // sample rate
                    data.setUint32(index, sampleRate * bytesPerSample * wavChannelCount, true); index += 4; // bytes per second
                    data.setUint16(index, bytesPerSample * wavChannelCount, true); index += 2; // block align
                    data.setUint16(index, bitsPerSample, true); index += 2; // bits per sample
                    data.setUint32(index, 0x64617461, false); index += 4;
                    data.setUint32(index, sampleCount * bytesPerSample, true); index += 4;

                    if (bytesPerSample > 1) {
                        // usually samples are signed. 
                        const range: number = (1 << (bitsPerSample - 1)) - 1;
                        for (let i: number = 0; i < sampleFrames; i++) {
                            let valL: number = Math.floor(Math.max(-1, Math.min(1, event.data.L[i])) * range);
                            let valR: number = Math.floor(Math.max(-1, Math.min(1, event.data.R[i])) * range);
                            if (bytesPerSample == 2) {
                                data.setInt16(index, valL, true); index += 2;
                                data.setInt16(index, valR, true); index += 2;
                            } else if (bytesPerSample == 4) {
                                data.setInt32(index, valL, true); index += 4;
                                data.setInt32(index, valR, true); index += 4;
                            } else {
                                throw new Error("unsupported sample size");
                            }
                        }
                    }
                    const blob: Blob = new Blob([arrayBuffer], { type: "audio/wav" });
                    this.save(blob, "reverbTest.wav");
                }
            }
        }
        await this.audioContext.resume();
    }

    public export() {
        this.workletNode?.port.postMessage({ type: Events.export });
    }

    private save(blob: Blob, name: string): void {
        if ((<any>navigator).msSaveOrOpenBlob) {
            (<any>navigator).msSaveOrOpenBlob(blob, name);
            return;
        }

        const anchor: HTMLAnchorElement = document.createElement("a");
        if (anchor.download != undefined) {
            const url: string = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
            anchor.href = url;
            anchor.download = name;
            // Chrome bug regression: We need to delay dispatching the click
            // event. Seems to be related to going back in the browser history.
            // https://bugs.chromium.org/p/chromium/issues/detail?id=825100
            setTimeout(function () { anchor.dispatchEvent(new MouseEvent("click")); }, 0);
        } else {
            const url: string = URL.createObjectURL(blob);
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
            if (!window.open(url, "_blank")) window.location.href = url;
        }
    }
}