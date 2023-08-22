const path = require("path");
const { buildPoseidon } = require("circomlibjs");
const LinearHash = require("../../../src/helpers/hash/linearhash/linearhash.bn128");

const tmp = require('temporary');
const fs = require("fs");
const ejs = require("ejs");

const wasm_tester = require("circom_tester").wasm;

describe("Linear Hash Circuit Test", function () {
    let circuit;

    let template;

    this.timeout(10000000);

    before( async() => {
        template = await fs.promises.readFile(path.join(__dirname, "circom", "linearhash.bn128.custom.test.circom.ejs"), "utf8");
    });

    it("Should calculate linear hash of 9 complex elements and arity 16", async () => {
        const content = ejs.render(template, {n: 9, arity: 16, dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128.custom", "node_modules/circomlib/circuits"]});

        const poseidon = await buildPoseidon();
        const F = poseidon.F;

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

        const lh = new LinearHash(poseidon, 16, true);

        const res = lh.hash(input.in);

        await circuit.assertOut(w1, {out: F.toObject(res)});
    });
    it("Should calculate linear hash of 100 complex elements with arity 16", async () => {
        const content = ejs.render(template, {n: 100, arity: 16, dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128.custom", "node_modules/circomlib/circuits"]});

        const poseidon = await buildPoseidon();
        const F = poseidon.F;

        const input={
            in: []
        };

        for (let i=0; i<100; i++) {
            input.in.push([i, i*1000, i*1000000])
        }

        const w1 = await circuit.calculateWitness(input, true);

        const lh = new LinearHash(poseidon, 16, true);

        const res = lh.hash(input.in);

        await circuit.assertOut(w1, {out: F.toObject(res)});
    });

    it("Should calculate linear hash of 110 complex elements with arity 4", async () => {
        const content = ejs.render(template, {n: 110, arity: 4, dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128.custom", "node_modules/circomlib/circuits"]});

        const poseidon = await buildPoseidon();
        const F = poseidon.F;

        const input={
            in: []
        };

        for (let i=0; i<110; i++) {
            input.in.push([i, i*1000, i*1000000])
        }

        const w1 = await circuit.calculateWitness(input, true);

        const lh = new LinearHash(poseidon, 4, true);

        const res = lh.hash(input.in);

        await circuit.assertOut(w1, {out: F.toObject(res)});
    });
});
