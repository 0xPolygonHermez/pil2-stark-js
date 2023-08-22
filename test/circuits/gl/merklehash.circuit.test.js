const chai = require("chai");
const path = require("path");
const MerkleHash = require("../../../src/helpers/hash/merklehash/merklehash.js");
const buildPoseidon = require("../../../src/helpers/hash/poseidon/poseidon");

const tmp = require('temporary');
const fs = require("fs");
const ejs = require("ejs");

const assert = chai.assert;

const wasm_tester = require("circom_tester").wasm;

function getBits(idx, nBits) {
    res = [];
    for (let i=0; i<nBits; i++) {
        res[i] = (idx >> i)&1 ? 1n : 0n;
    }
    return res;
}

describe("Merkle Hash Circuit Test", function () {
    let circuit;

    let template;

    this.timeout(10000000);

    before( async() => {
        template = await fs.promises.readFile(path.join(__dirname, "circom", "merklehash.test.circom.ejs"), "utf8");
    });
    
    describe("Non GPU Merkle Hash", () => { 
        it("Should calculate merklehash hash of 9 complex elements", async () => {
            const content = ejs.render(template, {dirName:path.join(__dirname, "circom"), merkleHashDir: "merklehash"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});

            const poseidon = await buildPoseidon();

            let MH = new MerkleHash(poseidon);

            const NPols = 9;
            const nBits = 5;
            const idx = 9;
    
            const N = 1<<nBits;
    
            const pols = [];
            for (let i=0; i<NPols;i++) {
                pols[i] = [];
                for (let j=0; j<N; j++) {
                    pols[i][j] = [];
                    for (let k=0; k<3; k++) {
                        pols[i][j][k] = BigInt(i*1000+j*10+k+1);
                    }
                }
            }
    
            const tree = await MH.merkelize(pols, 3, NPols, N);
    
            proof = MH.getGroupProof(tree, idx);
    
            const calcRoot = MH.calculateRootFromGroupProof(proof[1], idx, proof[0]);
            const root = MH.root(tree);
            for (let i=0; i<4; i++) {
                assert(root[i] == calcRoot[i]);
            }
    
            const input={
                values: proof[0],
                siblings: proof[1],
                key: getBits(idx, nBits),
                enable: 1,
                root: MH.root(tree),
            };
            const w1 = await circuit.calculateWitness(input, true);
    
            await circuit.assertOut(w1, {});
        });
    });

    describe("GPU Merkle Hash", () => { 
        it("Should calculate merkle hash of 9 complex elements", async () => {
            const content = ejs.render(template, {dirName:path.join(__dirname, "circom"), merkleHashDir: "merklehash_gpu"});
            const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
            await fs.promises.writeFile(circuitFile, content);
            circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks", verbose: true});

            const poseidon = await buildPoseidon();

            let MH = new MerkleHash(poseidon, true);

            const NPols = 9;
            const nBits = 5;
            const idx = 9;
    
            const N = 1<<nBits;
    
            const pols = [];
            for (let i=0; i<NPols;i++) {
                pols[i] = [];
                for (let j=0; j<N; j++) {
                    pols[i][j] = [];
                    for (let k=0; k<3; k++) {
                        pols[i][j][k] = BigInt(i*1000+j*10+k+1);
                    }
                }
            }
    
            const tree = await MH.merkelize(pols, 3, NPols, N);
    
            proof = MH.getGroupProof(tree, idx);
    
            const calcRoot = MH.calculateRootFromGroupProof(proof[1], idx, proof[0]);
            const root = MH.root(tree);
            for (let i=0; i<4; i++) {
                assert(root[i] == calcRoot[i]);
            }
    
            const input={
                values: proof[0],
                siblings: proof[1],
                key: getBits(idx, nBits),
                enable: 1,
                root: MH.root(tree),
            };
            const w1 = await circuit.calculateWitness(input, true);
    
            await circuit.assertOut(w1, {});
        });
    });
    
});
