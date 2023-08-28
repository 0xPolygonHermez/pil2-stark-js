const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../src/helpers/f3g");
const path = require("path");
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const Logger = require('logplease');

const smSimple = require("../state_machines/sm_simple/sm_simple.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');
const fs = require("fs");

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

    const result = await smSimple.execute(N, cmPols.Simple, F);
    console.log("Result: " + result);

    const res = await verifyPil(F, pil, cmPols , constPols);

    if (res.length != 0 && !["simple5.pil", "simple6.pil"].includes(pilFile)) {
        console.log("Pil does not pass");
        for (let i=0; i<res.length; i++) {
            console.log(res[i]);
        }
        assert(0);
    }

    if (pilFile === "simple5.pil") {
        pil.polIdentities[0].boundary = "firstRow";
    } else if (pilFile === "simple6.pil") {
        pil.polIdentities[0].boundary = "lastRow";
    }
    
    const setup = await starkSetup(constPols, pil, starkStruct, {F});
    
    const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, {logger});

    const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, setup.starkInfo, {logger});

    assert(resV==true);

    if(pilFile !== "simple1.pil") {
        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, {});

        const fileName = await tmp.tmpName();
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl"});

        const input = proof2zkin(resP.proof, setup.starkInfo);
        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    }
}

describe("simple sm", async function () {
    this.timeout(10000000);

    it.only("Simple1", async () => {
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
