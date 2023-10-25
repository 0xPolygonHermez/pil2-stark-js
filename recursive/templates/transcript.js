class Transcript {
    constructor(name) {
        this.state = ["0", "0", "0", "0"];
        this.pending = [];
        this.out = [];
        this.stCnt =0;
        this.hCnt =0;
        this.hiCnt =0;
        this.n2bCnt =0;
        this.lastCodePrinted = 0;
        this.name = name;

        this.code = [];
    }


    getField(v) {
        this.code.push(`${v} <== [${this.getFields1()}, ${this.getFields1()}, ${this.getFields1()}];`);    
    }

    getHash(v) {
        this.code.push(`${v} <== [${this.getFields1()}, ${this.getFields1()}, ${this.getFields1()}, ${this.getFields1()}];`);    
    }

    updateState()  {
        let signalName = "transcriptHash";
        if(this.name) signalName += "_" + this.name;
        if(this.hCnt > 0) {
            const firstUnused = Math.max(this.hiCnt, 4);
            if(firstUnused < 12) {
                this.code.push(`for(var i = ${firstUnused}; i < 12; i++){
        _ <== ${signalName}_${this.hCnt -1}[i]; // Unused transcript values 
    }`)
            }  
        }
        this.code.push(`\n    signal ${signalName}_${this.hCnt++}[12] <== Poseidon(12)([${this.pending.join(',')}], [${this.state.join(',')}]);`);
        for (let i=0; i<12; i++) {
            this.out[i] = `${signalName}_${this.hCnt-1}[${i}]`;
        }
        for (let i=0; i<4; i++) {
            this.state[i] = `${signalName}_${this.hCnt-1}[${i}]`;
        } 
        this.pending = [];
        this.hiCnt = 0;
    }

    getFields1() {
        if (this.out.length == 0) {
            while (this.pending.length<8) {
                this.pending.push("0");
            }
            this.updateState();
        }
        const res = this.out.shift();
        this.hiCnt++;
        return res;
    }

    put(a, l) {
        if (typeof l !== "undefined") {
            for (let i=0; i<l; i++) {
                this._add1(`${a}[${i}]`);
            }
        } else {
            this._add1(a);
        }
    }

    _add1(a) {
        this.out = [];
        this.pending.push(a);
        if (this.pending.length == 8) {
            this.updateState();
        }
    }

    getPermutations(v, n, nBits) {
        let signalName = "transcriptHash";
        if(this.name) signalName += "_" + this.name;
        const totalBits = n*nBits;
        const n2b = [];
        for (let i=0; i<NFields; i++) {
            const f = this.getFields1();
            n2b[i] = `transcriptN2b_${this.n2bCnt++}`;
            this.code.push(`signal ${n2b[i]}[64] <== Num2Bits_strict()(${f});`);
        }
        if(this.hiCnt < 12) {
            this.code.push(`for(var i = ${this.hiCnt}; i < 12; i++){
        _ <== ${signalName}_${this.hCnt - 1}[i]; // Unused transcript values        
    }\n`)
        }
        this.code.push(`// From each transcript hash converted to bits, we assign those bits to queriesFRI[q] to define the query positions`)
        this.code.push(`var q = 0; // Query number `)
        this.code.push(`var b = 0; // Bit number `)
        for(let i = 0; i<NFields; i++) {
            const nBits = i + 1 == NFields ? totalBits - 63*i : 63;
            this.code.push(`for(var j = 0; j < ${nBits}; j++) {
        ${v}[q][b] <== ${n2b[i]}[j];
        b++;
        if(b == ${starkStruct.steps[0].nBits}) {
            b = 0; 
            q++;
        }
    }`);
            if(nBits === 63) {
                this.code.push(`_ <== ${n2b[i]}[63]; // Unused last bit\n`); 
            } else {
                this.code.push(`for(var j = ${nBits}; j < 64; j++) {
        _ <== ${n2b[i]}[j]; // Unused bits        
    }`);
            }
        }
    }

    getCode() {
        for (let i=this.lastCodePrinted; i<this.code.length; i++) this.code[i] = "    "+this.code[i];
        let code = this.code.slice(this.lastCodePrinted, this.code.length).join("\n");
        this.lastCodePrinted = this.code.length;
        return code;
    }
}

module.exports.Transcript = Transcript;