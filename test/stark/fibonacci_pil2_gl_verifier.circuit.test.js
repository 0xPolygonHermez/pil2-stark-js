const path = require("path");
const fs = require("fs");
const pil2circom = require("../../src/pil2circom");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const proof2zkin = require("../../src/proof2zkin").proof2zkin;
const F3g = require("../../src/helpers/f3g");
const { calculateTranscript } = require("../../src/stark/calculateTranscriptVerify");
const { challenges2zkinCircom } = require("../../src/proof2zkin");

const wasm_tester = require("circom_tester").wasm;

describe("Stark Verification Circuit Test", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
    });

    it("Should test circom circuit", async () => {

        const circomFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.verifier.circom");
        const verKeyFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.verkey.json");
        const starkInfoFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.starkinfo.json");
        const expressionsInfoFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.expressionsinfo.json");
        const proofFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.proof.json");
        const publicsFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.public.json")
        const zkInputFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.zkinput.json")


        const verKey = JSONbig.parse(await fs.promises.readFile(verKeyFile, "utf8"));
        const constRoot = [];
        for (let i=0; i<4; i++) {
            constRoot[i] = BigInt(verKey.constRoot[i]);
        }
        const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
        const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));
        const publics = JSONbig.parse(await fs.promises.readFile(publicsFile, "utf8"));

        const circuitSrc = await pil2circom(constRoot, starkInfo, expressionsInfo);

        await fs.promises.writeFile(circomFile, circuitSrc, "utf8");

        console.log("Start compiling...");
        circuit = await wasm_tester(circomFile, {O:1, prime: "goldilocks", verbose: true, include: "circuits.gl"});
        console.log("End compiling...");

        const proof= JSONbig.parse( await fs.promises.readFile(proofFile, "utf8") );
        const input = proof2zkin(proof, starkInfo);
        input.publics = publics;

        console.log("Start wc...");
        await fs.promises.writeFile(zkInputFile, JSONbig.stringify(input, null, 1), "utf8");
        console.log("End wc...");

        const w = await circuit.calculateWitness(input, true);

    });

    it("Should test circom circuit by setting input challenges true and not calculating transcript", async () => {

        const circomFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.verifier.circom");
        const verKeyFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.verkey.json");
        const starkInfoFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.starkinfo.json");
        const expressionsInfoFile = path.join(__dirname, "../../","tmp", "fibonacci.pil2.expressionsinfo.json");
        const proofFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.proof.json");
        const publicsFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.public.json")
        const zkInputFile = path.join(__dirname, "../../", "tmp", "fibonacci.pil2.zkinput.json")


        const F = new F3g("0xFFFFFFFF00000001");
        const verKey = JSONbig.parse(await fs.promises.readFile(verKeyFile, "utf8"));
        const constRoot = [];
        for (let i=0; i<4; i++) {
            constRoot[i] = BigInt(verKey.constRoot[i]);
        }
        const starkInfo = JSON.parse(await fs.promises.readFile(starkInfoFile, "utf8"));
        const expressionsInfo = JSON.parse(await fs.promises.readFile(expressionsInfoFile, "utf8"));
        const publics = JSONbig.parse(await fs.promises.readFile(publicsFile, "utf8"));
        const proof= JSONbig.parse( await fs.promises.readFile(proofFile, "utf8") );

        const challenges = await calculateTranscript(F, starkInfo, proof, publics, constRoot, {});

        const circuitSrc = await pil2circom(constRoot, starkInfo, expressionsInfo, { inputChallenges: true });

        await fs.promises.writeFile(circomFile, circuitSrc, "utf8");

        console.log("Start compiling...");
        circuit = await wasm_tester(circomFile, {O:1, prime: "goldilocks", verbose: true, include: "circuits.gl"});
        console.log("End compiling...");

        const input = proof2zkin(proof, starkInfo);
        challenges2zkinCircom(challenges, starkInfo, input);
        
        input.publics = publics;

        console.log("Start wc...");
        await fs.promises.writeFile(zkInputFile, JSONbig.stringify(input, null, 1), "utf8");
        console.log("End wc...");

        const w = await circuit.calculateWitness(input, true);

    });
});
