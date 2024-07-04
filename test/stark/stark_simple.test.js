const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const Logger = require('logplease');

const smSimple = require("../state_machines/sm_simple/sm_simple.js");

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/setup/witness/witnessCalculator.js");

async function runTest(pilFile) {
    const logger = Logger.create("pil-stark", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    const starkStruct = {
        "nBits": 3,
        "nBitsExt": 4,
        "nQueries": 8,
        "verificationHashType": "GL",
        "steps": [
            {"nBits": 4},
            {"nBits": 3},
            {"nBits": 2}
        ]
    };

    const F = new F3g("0xFFFFFFFF00000001");
    const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple", pilFile));

    const N = 2**(starkStruct.nBits);

    const constPols = generateFixedCols(pil.references, N, false);

    await smSimple.buildConstants(N, constPols.Simple);

    const cmPols = generateWtnsCols(pil.references, N, false);

    await smSimple.execute(N, cmPols.Simple, F);

    if (pilFile === "simple5.pil") {
        pil.polIdentities[0].boundary = "firstRow";
    } else if (pilFile === "simple6.pil") {
        pil.polIdentities[0].boundary = "lastRow";
    }

    let inputs = pilFile === "simple2p.pil" ? [cmPols.Simple.b[N - 1], cmPols.Simple.b[N - 2]] : [];
    
    const skipVerifierCircom = pilFile === "simple1.pil" ? true : false;
    await generateStarkProof(constPols, cmPols, pil, starkStruct, inputs, {logger, F, pil2: false, skip: skipVerifierCircom, debug: true});
}

describe("simple sm", async function () {
    this.timeout(10000000);

    it("Simple1", async () => {
        await runTest("simple1.pil");
    });
    it("Simple2", async () => {
        await runTest("simple2.pil");
    });
    it("Simple2p", async () => {
        await runTest("simple2p.pil");
    });
    it("Simple3", async () => {
        await runTest("simple3.pil");
    });
    it("Simple4", async () => {
        await runTest("simple4.pil");
    });
    it("Simple4p", async () => {
        await runTest("simple4p.pil");
    });
    it("Simple5", async () => {
        await runTest("simple5.pil");
    });
    it("Simple6", async () => {
        await runTest("simple6.pil");
    });
});
