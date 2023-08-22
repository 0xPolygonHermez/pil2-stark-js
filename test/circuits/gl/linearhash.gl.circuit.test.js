const path = require("path");
const buildPoseidon = require("../../../src/helpers/hash/poseidon/poseidon");
const LinearHash = require("../../../src/helpers/hash/linearhash/linearhash");
const LinearHashGPU = require("../../../src/helpers/hash/linearhash/linearhash_gpu");

const tmp = require('temporary');
const fs = require("fs");
const ejs = require("ejs");

const wasm_tester = require("circom_tester").wasm;

describe("Linear Hash Circuit Test", function () {
    let circuit;

    let template;

    this.timeout(10000000);

    before( async() => {
        template = await fs.promises.readFile(path.join(__dirname, "circom", "linearhash.test.circom.ejs"), "utf8");
    });


    describe("Non GPU Linear Hash", () => { 
        it("Should calculate linear hash of 9 complex elements", async () => {    
            const content = ejs.render(template, {n: 9, dirName:path.join(__dirname, "circom"), linearHashDir: "linearhash"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});
            
            const poseidon = await buildPoseidon();
    
            const input={
                in: [
                    [1n,2n,3n],
                    [4n,5n,6n],
                    [7n,8n,9n],
                    [10n,11n,12n],
                    [13n,14n,15n],
                    [16n,17n,18n],
                    [19n,20n,21n],
                    [22n,23n,24n],
                    [25n,26n,27n]
                ]
            };
    
            const w1 = await circuit.calculateWitness(input, true);
    
            const lh = new LinearHash(poseidon);
    
            const res = lh.hash(input.in);
    
            await circuit.assertOut(w1, {out: res});
        });
    
        it("Should calculate linear hash of 1 complex elements", async () => {
            const content = ejs.render(template, {n: 1, dirName:path.join(__dirname, "circom"), linearHashDir: "linearhash"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});
    
            const poseidon = await buildPoseidon();
    
            const input={
                in: [
                    [1n,2n,3n]
                ]
            };
    
            const w1 = await circuit.calculateWitness(input, true);
    
            const lh = new LinearHash(poseidon);
    
            const res = lh.hash(input.in);
    
            await circuit.assertOut(w1, {out: res});
        });
    });

    describe("GPU Linear Hash", () => { 
        it("Should calculate linear hash of 9 complex elements", async () => {    
            const content = ejs.render(template, {n: 9, dirName:path.join(__dirname, "circom"), linearHashDir: "linearhash_gpu"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});
            
            const poseidon = await buildPoseidon();
    
            const input={
                in: [
                    [1n,2n,3n],
                    [4n,5n,6n],
                    [7n,8n,9n],
                    [10n,11n,12n],
                    [13n,14n,15n],
                    [16n,17n,18n],
                    [19n,20n,21n],
                    [22n,23n,24n],
                    [25n,26n,27n]
                ]
            };
    
            const w1 = await circuit.calculateWitness(input, true);
    
            const lh = new LinearHashGPU(poseidon);
    
            const res = lh.hash(input.in);
    
            await circuit.assertOut(w1, {out: res});
        });
    
        it("Should calculate linear hash of 1 complex elements", async () => {
            const content = ejs.render(template, {n: 1, dirName:path.join(__dirname, "circom"), linearHashDir: "linearhash_gpu"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});
    
            const poseidon = await buildPoseidon();
    
            const input={
                in: [
                    [1n,2n,3n]
                ]
            };
    
            const w1 = await circuit.calculateWitness(input, true);
    
            const lh = new LinearHashGPU(poseidon);
    
            const res = lh.hash(input.in);
    
            await circuit.assertOut(w1, {out: res});
        });
    });
    
});
