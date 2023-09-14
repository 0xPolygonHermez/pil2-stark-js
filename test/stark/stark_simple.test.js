const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const Logger = require('logplease');

const smSimple = require("../state_machines/sm_simple/sm_simple.js");

const { generateStarkProof } = require("./helpers");

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

    const constPols =  newConstantPolsArray(pil, F);

    const N = 2**(starkStruct.nBits);

    await smSimple.buildConstants(N, constPols.Simple);

    const cmPols = newCommitPolsArray(pil, F);

    await smSimple.execute(N, cmPols.Simple, F);

    if (pilFile === "simple5.pil") {
        pil.polIdentities[0].boundary = "firstRow";
    } else if (pilFile === "simple6.pil") {
        pil.polIdentities[0].boundary = "lastRow";
    }
    
    const skipVerifierCircom = pilFile === "simple1.pil" ? true : false;
    await generateStarkProof(constPols, cmPols, pil, starkStruct, {logger, F, pil1: true, skip: skipVerifierCircom, debug: true});
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
