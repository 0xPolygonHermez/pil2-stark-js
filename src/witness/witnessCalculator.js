const { BigBuffer } = require("pilcom");
const F3g = require("../helpers/f3g");
const fs= require("fs");

function generateMultiArrayIndexes(symbols, name, lengths, polId, indexes) {
    if (indexes.length === lengths.length) {
        symbols.push({ name, idx: indexes, id: polId });
        return polId + 1;
    }

    for (let i = 0; i < lengths[indexes.length]; i++) {
        polId = generateMultiArrayIndexes(symbols, name, lengths, polId, [...indexes, i]);
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
    
module.exports.generateFixedCols = function generateFixedCols(symbols, degree) {
    const fixedSymbols = [];
    for (let i = 0; i < symbols.length; ++i) {
        if(symbols[i].type !== 1 || symbols[i].stage !== 0) continue;
        if(!symbols[i].dim) {
            fixedSymbols.push({name: symbols[i].name, id: symbols[i].id, idx: []});
        } else {
            generateMultiArrayIndexes(fixedSymbols, symbols[i].name, symbols[i].lengths, symbols[i].id, []);
        }
    }
    
    const fixedCols = new ColsPil2(fixedSymbols, degree);
    return fixedCols;
}

module.exports.generateWtnsCols = function generateWtnsCols(stage, symbols, degree, nCols, buffer) {
    const witnessSymbols = [];
    for (let i = 0; i < symbols.length; ++i) {
        if(symbols[i].type !== 3 || symbols[i].stage !== stage) continue;
        if(!symbols[i].dim) {
            witnessSymbols.push({name: symbols[i].name, id: symbols[i].id, idx: []});
        } else {
            generateMultiArrayIndexes(witnessSymbols, symbols[i].name, symbols[i].lengths, symbols[i].id, []);
        }
    }
    
    const wtnsCols = new ColsPil2(witnessSymbols, degree, nCols, buffer);
    return wtnsCols;
}

class ColsPil2 {
    constructor(symbols, degree, nCols, buffer) {
        this.$$def = {};
        this.$$defArray = [];

        if(!nCols) nCols = symbols.length;

        this.F = new F3g();
        this.$$n = degree;
        this.$$nCols = nCols;
        
        if(!buffer) {
            this.polBuffer = new BigBuffer(this.$$nCols*this.$$n);
        } else {
            this.polBuffer = buffer;
        }

        this.symbols = symbols;
        for(let i = 0; i < symbols.length; ++i) {
            const symbol = symbols[i];
            const name = symbol.name;
            const [nameSpace, namePol] = name.split(".");
            if (!this[nameSpace]) this[nameSpace] = {};
            if (!this.$$def[nameSpace]) this.$$def[nameSpace] = {};
            
            const polProxy = this.createArrayProxy(symbol.id);

            this.$$defArray[symbol.id] = {
            name: name,
            id: symbol.id,
            polDeg: degree
            };

            if (symbol.idx.length > 0) {
                if (!this[nameSpace][namePol]) this[nameSpace][namePol] = [];
                if (!this.$$def[nameSpace][namePol]) this.$$def[nameSpace][namePol] = [];
                setValueMultiArray(this[nameSpace][namePol], symbol.idx, polProxy);
                setValueMultiArray(this.$$def[nameSpace][namePol], symbol.idx, this.$$defArray[symbol.id]);
            } else {
                this[nameSpace][namePol] = polProxy;
                this.$$def[nameSpace][namePol] = this.$$defArray[symbol.id];
            }
        }
    }

    createArrayProxy(symbolId) {
          
        const nCols = this.$$nCols;
        const polBuffer = this.polBuffer;

        return new Proxy([], {
            set(target, prop, value) {
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                polBuffer.setElement(buffIndex,value);
                return true;
            },

            get(target, prop) {
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                return polBuffer.getElement(buffIndex);
            }
        });
    }

    async saveToFile(fileName) {
        const fd =await fs.promises.open(fileName, "w+");

        const MaxBuffSize = 1024*1024*32;  //  256Mb
        const totalSize = this.$$nCols*this.$$n;
        const buff = new BigUint64Array(Math.min(totalSize, MaxBuffSize));

        let p=0;
        for (let i=0; i<totalSize; i++) {
            buff[p++] = (this.polBuffer.getElement(i) < 0n) ? (this.polBuffer.getElement(i) + 0xffffffff00000001n) : this.polBuffer.getElement(i);
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

        const MaxBuffSize = 1024*1024*32;  //  256Mb
        const totalSize = this.$$nCols*this.$$n;
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
                this.polBuffer.setElement(i++, buff[l]);
            }
        }

        await fd.close();
    }

    writeToBigBuffer(buff, nCols) {
        if(!nCols) nCols = this.$$nCols;
        if (typeof buff == "undefined") {
            buff = new BigBuffer(this.$$n*nCols);
        }
        let p=0;
        for (let i=0; i<this.$$n; i++) {
            for(let j = 0; j < this.$$nCols; ++j) {
                let c = i*this.$$nCols + j;
                const value = (this.polBuffer.getElement(c) < 0n) ? (this.polBuffer.getElement(c) + this.F.p) : this.polBuffer.getElement(c);
                buff.setElement(p++, value);
            }
            for(let j = this.$$nCols; j < nCols; ++j) buff.setElement(p++, 0n);

        }
        return buff;
    };

    writeToBuff(buff) {
        buff = this.polBuffer;
        return buff;
    }
}



