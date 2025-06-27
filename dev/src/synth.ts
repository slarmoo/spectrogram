import { ResizeableBuffer } from "./resizableBuffer";

export class Synth {
    public isPlaying: boolean = false;
    private initialized: boolean = false;

    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;

    //visuals
    public displayOutput: ResizeableBuffer | null = null;
    public bufferSize: number = Math.pow(2, 11);

    public async initializeFileData(data: ArrayBuffer) {
        await this.activate();
        const buffer: AudioBuffer = await this.audioContext!.decodeAudioData(data);

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'initialize',
                audioFileL: buffer.getChannelData(0),
                audioFileR: buffer.getChannelData(1),
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
                                outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                                outputDataR[i] = this.audioFileR[this.audioFileIndex + i];
                            }
                            this.audioFileIndex += outputDataL.length;
                            if (this.audioFileIndex >= this.audioFileL.length) {
                                this.audioFileIndex %= this.audioFileL.length;
                            }
                        } else if (this.isPlaying && this.audioFileL) { //mono
                            for (let i: number = 0; i < outputDataL.length; i++) {
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
                            type: 'render',
                            displayOutput: outputDataL.slice(),
                        });

                        return true;
                    }
                }
                registerProcessor('synth-processor', WorkletProcessor);

            }.toString(), ')()'], { type: 'application/javascript' } ) );

            await this.audioContext.audioWorklet.addModule(url_worklet);
            this.workletNode = new AudioWorkletNode(this.audioContext, 'synth-processor', {numberOfOutputs: 1, outputChannelCount: [2]});
            
            this.workletNode.connect(this.audioContext.destination);
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type == 'render') {
                    console.log(this.displayOutput, this.displayOutput?.length(), this.bufferSize)
                    if (this.displayOutput != null && this.displayOutput.length() < this.bufferSize) {
                        this.displayOutput.concat(event.data.displayOutput);
                    } else {
                        this.displayOutput = new ResizeableBuffer(event.data.displayOutput);
                    }
                    
                }
            }
        }
        await this.audioContext.resume();
    }

}