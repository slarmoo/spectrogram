export class ResizeableBuffer {
    private size: number = 0;
    private buffer: Float32Array;

    constructor(initialArray?: Float32Array, initialSize?: number) {
        if (initialArray) {
            this.buffer = initialArray;
            this.size = this.buffer.length;
        } else if (initialSize) {
            this.buffer = new Float32Array(initialSize);
            this.size = initialSize;
        } else {
            this.buffer = new Float32Array(4);
        }
        
    }

    public length(): number {
        return this.size;
    }

    public clear() {
        this.size = 0;
    }

    public at(index: number): number {
        return this.buffer[index];
    }

    public getBuffer(): Float32Array {
        return this.buffer.slice(0, this.size);
    }

    public append(value: number) {
        if (this.size >= this.buffer.length) this.resize();

        this.buffer[this.size + 1] = value;
        this.size++;
    }

    public pop(): number {
        this.size--;
        return this.buffer[this.size];
    }

    public set(value: number, index: number) {
        this.buffer[index] = value;
    }

    public concat(addArray: Float32Array) {
        if (this.size + addArray.length > this.buffer.length) {
            this.resize(addArray.length);
        }
        for (let i = 0; i < addArray.length; i++) {
            this.buffer[i + this.size] = addArray[i];
        }
        this.size += addArray.length;
    }

    private resize(by?: number) {
        const newBuffer = new Float32Array(by? this.buffer.length + by : this.buffer.length * 2);
        for (let i = 0; i < this.buffer.length; i++) {
            newBuffer[i] = this.buffer[i];
        }
        this.buffer = newBuffer;
    }
}