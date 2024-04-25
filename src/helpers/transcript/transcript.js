
class Transcript {
    constructor(poseidon) {
        this.poseidon = poseidon;
        this.F = poseidon.F;
        this.state = [this.F.zero, this.F.zero, this.F.zero, this.F.zero];
        this.pending = [];
        this.out = [];
    }

    getState() {
        if(this.pending.length > 0) {
            this.updateState();
        }
        return this.state;
    }

    getField() {
        return [this.getFields1(), this.getFields1(), this.getFields1()];
    }

    getFields1() {
        if (this.out.length == 0) {
            this.updateState();
        }
        const res = this.out.shift();
        return res;
    }

    put(a) {
        if (Array.isArray(a)) {
            for (let i=0; i<a.length; i++) {
                this._add1(a[i]);
            }
        } else {
            this._add1(a);
        }
    }

    updateState() {
        while (this.pending.length<8) {
            this.pending.push(0n);
        }
        this.out = this.poseidon(this.pending, this.state, 12);
        this.pending = [];
        this.state = this.out.slice(0, 4);
    }

    _add1(a) {
        this.out = [];
        this.pending.push(a);
        if (this.pending.length == 8) {
            this.out = this.poseidon(this.pending, this.state, 12);
            this.pending = [];
            this.state = this.out.slice(0, 4);
        }
    }

    getPermutations(n, nBits, nBitsMax) {
        if(nBitsMax == undefined) nBitsMax = nBits;
        const res = [];
        const totalBits = n*nBitsMax;
        const NFields = Math.floor((totalBits - 1)/63)+1;
        const fields = [];
        for (let i=0; i<NFields; i++) {
            fields[i] = this.getFields1();
        }
        let curField =0;
        let curBit = 0n;
        for (let i=0; i<n; i++) {
            let a = 0;
            curBit += BigInt(nBitsMax - nBits);
            if(curBit >= 63n) {
                curBit -= 63n;
                curField ++;
            }
            for (let j=0; j<nBits; j++) {
                const bit = (fields[curField] >> curBit) & 1n;
                if (bit) a = a + (1<<j);
                curBit ++;
                if (curBit == 63) {
                    curBit = 0n;
                    curField ++;
                }
            }
            res.push(a);
        }
        return res;
    }

}

module.exports = Transcript;