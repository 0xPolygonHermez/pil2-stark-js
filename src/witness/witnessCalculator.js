const { BigBuffer } = require("pilcom");
const F3g = require("../helpers/f3g");
const fs= require("fs");

function generateMultiArrayIndexes(symbols, name, lengths, polId, stage, indexes = []) {
    if (indexes.length === lengths.length) {
        symbols.push({ name, lengths: indexes, id: polId, stage, });
        return polId + 1;
    }

    for (let i = 0; i < lengths[indexes.length]; i++) {
        polId = generateMultiArrayIndexes(symbols, name, lengths, polId, stage, [...indexes, i]);
    }

    return polId; 
}

function setValueMultiArray(arr, indexes, value) {
    if (indexes.length === 1) {
        arr[indexes[0]] = value;
    } else {
        const nextIndex = indexes[0];
        if (!Array.isArray(arr[nextIndex])) arr[nextIndex] = [];
        setValueMultiArray(arr[nextIndex], indexes.slice(1), value);
    } 
}
    
module.exports.generateFixedCols = function generateFixedCols(symbols, degree, fromPilout = true) {
    const fixedSymbols = [];
    for (let i = 0; i < symbols.length; ++i) {
        const name = symbols[i].name;
        const stage = symbols[i].stage;
        const id = fromPilout ? symbols[i].id : symbols[i].stageId;
        const lengths = symbols[i].lengths || [];
        if(fromPilout && (symbols[i].type !== 1 || stage !== 0)) continue;
        if(!lengths.length) {
            fixedSymbols.push({name, id, stage, lengths});
        } else {
            generateMultiArrayIndexes(fixedSymbols, name, lengths, id, stage);
        }
    }
    
    const fixedCols = new ColsPil2(fixedSymbols, degree, true);
    return fixedCols;
}

module.exports.generateWtnsCols = function generateWtnsCols(symbols, degree, fromPilout = true, nCols, buffer) {
    const witnessSymbols = [];
    for (let i = 0; i < symbols.length; ++i) {
        if(fromPilout && symbols[i].type !== 3) continue;
        const name = symbols[i].name;
        const stage = symbols[i].stage;
        const id = fromPilout ? symbols[i].id : symbols[i].stageId;
        const lengths = symbols[i].lengths || [];
        if(!lengths.length) {
            witnessSymbols.push({name, id, lengths: [], stage });
        } else {
            generateMultiArrayIndexes(witnessSymbols, name, lengths, id, stage);
        }
    }
    
    const wtnsCols = new ColsPil2(witnessSymbols, degree, false, nCols, buffer);
    return wtnsCols;
}

class ColsPil2 {
    constructor(symbols, degree, constants = false, nCols = {}, buffers = {}) {
        this.$$def = {};
        this.$$defArray = [];

        this.F = new F3g();
        this.$$n = degree;
        this.$$nCols = {};
        this.$$buffers = {};
        this.$$nStages = Object.keys(nCols).length != 0 ? Object.keys(nCols).length : constants ? 0 : 1;
        
        const initialStage = constants ? 0 : 1;
        for(let s = initialStage; s <= this.$$nStages; ++s) {
            let st = "cm" + s;
            if(nCols[st]) {
                this.$$nCols[st] =  nCols[st];
            } else {
                let nColsStage = 0;
                for(let i = 0; i < symbols.length; ++i) {
                    if(symbols[i].stage == s) nColsStage++;
                }
                this.$$nCols[st] = nColsStage;
            }            
            this.$$buffers[st] = buffers[st] ? buffers[st] : new BigBuffer(this.$$nCols[st]*this.$$n);
        }

        this.$$constants = constants;

        this.symbols = symbols;
        for(let i = 0; i < symbols.length; ++i) {
            const symbol = symbols[i];
            const name = symbol.name;
            const [nameSpace, namePol] = name.split(".");
            if (!this[nameSpace]) this[nameSpace] = {};
            if (!this.$$def[nameSpace]) this.$$def[nameSpace] = {};
            
            const polProxy = this.createArrayProxy(symbol.stage, symbol.id);

            this.$$defArray[symbol.id] = {
            name: name,
            id: symbol.id,
            stage: symbol.stage,
            polDeg: degree
            };

            if (symbol.lengths.length > 0) {
                if (!this[nameSpace][namePol]) this[nameSpace][namePol] = [];
                if (!this.$$def[nameSpace][namePol]) this.$$def[nameSpace][namePol] = [];
                setValueMultiArray(this[nameSpace][namePol], symbol.lengths, polProxy);
                setValueMultiArray(this.$$def[nameSpace][namePol], symbol.lengths, this.$$defArray[symbol.id]);
            } else {
                this[nameSpace][namePol] = polProxy;
                this.$$def[nameSpace][namePol] = this.$$defArray[symbol.id];
            }
        }
    }

    createArrayProxy(stage, symbolId) {
          
        const nCols = this.$$nCols["cm" + stage];
        const buff = this.$$buffers["cm" + stage];
        const N = this.$$n;

        return new Proxy([], {
            set(target, prop, value) {
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                buff.setElement(buffIndex,value);
                return true;
            },

            get(target, prop) {
                if (prop === 'length') {
                    return N; // Return the degree for 'length' property
                }
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                return buff.getElement(buffIndex);
            }
        });
    }

    async saveToFile(fileName) {
        const fd =await fs.promises.open(fileName, "w+");

        const st = this.$$constants ? "cm0" : "cm1";

        const MaxBuffSize = 1024*1024*32;  //  256Mb
        const totalSize = this.$$nCols[st]*this.$$n;
        const buff = new BigUint64Array(Math.min(totalSize, MaxBuffSize));

        let p=0;
        for (let i=0; i<totalSize; i++) {
            buff[p++] = (this.$$buffers[st].getElement(i) < 0n) ? (this.$$buffers[st].getElement(i) + 0xffffffff00000001n) : this.$$buffers[st].getElement(i);
            if (p == buff.length) {
                const buff8 = new Uint8Array(buff.buffer);
                await fd.write(buff8);
                p=0;
            }
            
        }

        if (p) {
            const buff8 = new Uint8Array(buff.buffer, 0, p*8);
            await fd.write(buff8);
        }

        await fd.close();
    }

    async loadFromFile(fileName) {

        const fd =await fs.promises.open(fileName, "r");
        
        const st = this.$$constants ? "cm0" : "cm1";

        const MaxBuffSize = 1024*1024*32;  //  256Mb
        const totalSize = this.$$nCols[st]*this.$$n;
        const buff = new BigUint64Array(Math.min(totalSize, MaxBuffSize));
        const buff8 = new Uint8Array(buff.buffer);

        let i=0;
        let p=0;
        let n;
        for (let k=0; k<totalSize; k+= n) {
            console.log(`loading ${fileName}.. ${k/1024/1024} of ${totalSize/1024/1024}` );
            n= Math.min(buff.length, totalSize-k);
            const res = await fd.read({buffer: buff8, offset: 0, position: p, length: n*8});
            if (n*8 != res.bytesRead) console.log(`n: ${n*8} bytesRead: ${res.bytesRead} div: ${res.bytesRead/8}`);
            n = res.bytesRead/8;
            p += n*8;
            for (let l=0; l<n; l++) {
                this.$$buffers[st].setElement(i++, buff[l]);
            }
        }

        await fd.close();
    }

    writeToBigBuffer(buff, nCols) {
        const st = this.$$constants ? "cm0" : "cm1";

        if(!nCols) nCols = this.$$nCols[st];
        if (typeof buff == "undefined") {
            buff = new BigBuffer(this.$$n*nCols);
        }
        let p=0;
        for (let i=0; i<this.$$n; i++) {
            for(let j = 0; j < this.$$nCols[st]; ++j) {
                let c = i*this.$$nCols[st] + j;
                const value = (this.$$buffers[st].getElement(c) < 0n) ? (this.$$buffers[st].getElement(c) + this.F.p) : this.$$buffers[st].getElement(c);
                buff.setElement(p++, value);
            }
            for(let j = this.$$nCols[st]; j < nCols; ++j) buff.setElement(p++, 0n);

        }
        return buff;
    };

    writeToBuff(buff) {
        const st = this.$$constants ? "cm0" : "cm1";

        buff = this.$$buffers[st];
        return buff;
    }
}



