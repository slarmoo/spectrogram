export class Synth {
    // private sampleRate: number = 44100;
    private bufferSize: number = 1024;
    public isPlaying: boolean = false;

    private audioContext: AudioContext | null = null;
    private scriptNode: ScriptProcessorNode | null = null;

    public audioFileL: Float32Array | null = null;
    public audioFileR: Float32Array | null = null;

    public displayOutput: Float32Array | null = null;

    private audioFileIndex: number = 0;

    public async initializeFileData(data: ArrayBuffer) {
        this.activate();
        const buffer: AudioBuffer = await this.audioContext!.decodeAudioData(data);
        this.audioFileL = buffer.getChannelData(0);
        this.audioFileR = buffer.getChannelData(1);
        this.audioFileIndex = 0;
        if (!this.isPlaying) {
            this.togglePause();
        }
    }

    public togglePause() {
        this.isPlaying = !this.isPlaying && this.audioFileL != null;
        if (this.isPlaying) {
            this.activate();
        }
    }

    private activate() {
        if (this.audioContext == null || this.scriptNode == null || this.scriptNode.bufferSize != this.bufferSize) {
            if (this.scriptNode != null) this.deactivate();
            const latencyHint: AudioContextLatencyCategory = "balanced";
            this.audioContext = this.audioContext || new AudioContext({ latencyHint: latencyHint });
            // this.sampleRate = this.audioContext.sampleRate;
            this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 0, 2);
            this.scriptNode.onaudioprocess = this.audioProcessCallback;
            this.scriptNode.channelCountMode = "explicit";
            this.scriptNode.channelInterpretation = "speakers";
            this.scriptNode.connect(this.audioContext.destination);
        }
        this.audioContext.resume();
    }

    private deactivate(): void {
        if (this.audioContext != null && this.scriptNode != null) {
            this.scriptNode.disconnect(this.audioContext.destination);
            this.scriptNode = null;
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    private synthesize(outputDataL: Float32Array, outputDataR: Float32Array, outputBufferLength: number) {
        if (this.audioFileL) {
            for (let i: number = 0; i < outputBufferLength; i++) {
                outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                outputDataR[i] = this.audioFileL[this.audioFileIndex + i];
            }
            this.audioFileIndex += outputBufferLength;
            if (this.audioFileIndex >= this.audioFileL.length) {
                this.audioFileIndex %= this.audioFileL.length;
            }
            this.displayOutput = outputDataL.slice();
        }
    }

    private audioProcessCallback = (audioProcessingEvent: AudioProcessingEvent): void => {
        const outputBuffer: AudioBuffer = audioProcessingEvent.outputBuffer;
        const outputDataL: Float32Array = outputBuffer.getChannelData(0);
        const outputDataR: Float32Array = outputBuffer.getChannelData(1);
        if (!this.isPlaying) {
            this.deactivate();
        } else {
            this.synthesize(outputDataL, outputDataR, outputBuffer.length);
        }
    }
}