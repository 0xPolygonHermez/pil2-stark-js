const path = require("path");
const F3g = require("../../../src/helpers/f3g");

const wasm_tester = require("circom_tester").wasm;

const tmp = require('temporary');
const fs = require("fs");
const ejs = require("ejs");

describe("GL in BN128 circuit", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
        template = await fs.promises.readFile(path.join(__dirname, "circom", "gl.bn128.test.circom.ejs"), "utf8");
    });

    it("Should check a basefield multiplication", async () => {
        const content = ejs.render(template, {glName: "GLMul", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            ina: F.e(-2),
            inb: F.e(-1)
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out: 2n});

    });
    it("Should check a complex multiplication", async () => {
        const content = ejs.render(template, {glName: "GLCMul", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            ina: F.e([-2, 3, -35]),
            inb: F.e([-1,-33, 4])
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out: F.mul(input.ina, input.inb)});
    });

    it("Should check a basefield multiplication addition", async () => {
        const content = ejs.render(template, {glName: "GLMulAdd", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            ina: F.e(-2),
            inb: F.e(-1),
            inc: F.e(444)
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out: 446n});

    });
    it("Should check a complex multiplication addition", async () => {
        const content = ejs.render(template, {glName: "GLCMulAdd", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            ina: F.e([-2, 3, -35]),
            inb: F.e([-1,-33, 4]),
            inc: F.e([5,-8, -99])
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out: F.add(F.mul(input.ina, input.inb), input.inc)});
    });

    it("Should check a basefield inv", async () => {
        const content = ejs.render(template, {glName: "GLInv", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            in: F.e(2),
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out: F.inv(input.in)});

    });
    it("Should check a complex inv", async () => {
        const content = ejs.render(template, {glName: "GLCInv", dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        circuit = await wasm_tester(circuitFile, {O:1, verbose:false, include: ["circuits.bn128", "node_modules/circomlib/circuits"]});

        const F = new F3g();

        const input={
            in: F.e([-2, 3, -35]),
        };

        const w = await circuit.calculateWitness(input, true);

        await circuit.assertOut(w, {out:  F.inv(input.in)});

    });

});
