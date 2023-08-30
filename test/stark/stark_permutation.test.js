const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../src/helpers/f3g");
const path = require("path");
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPermutation = require("../state_machines/sm_permutation/sm_permutation.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');
const fs = require("fs");

describe("test permutation sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 8,
            nBitsExt: 9,
            nQueries: 8,
            verificationHashType : "GL",
            steps: [
                {nBits: 9},
                {nBits: 3}
            ]
        };

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_permutation", "permutation_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = 2**(starkStruct.nBits);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPermutation.buildConstants(N, constPols.Permutation);

        const cmPols = newCommitPolsArray(pil, F);

        await smPermutation.execute(N, cmPols.Permutation);

        const res = await verifyPil(F, pil, cmPols, constPols);

        if (res.length != 0) {
            console.log("Pil does not pass");
            for (let i=0; i<res.length; i++) {
                console.log(res[i]);
            }
            assert(0);
        }

        const setup = await starkSetup(constPols, pil, starkStruct, {F, pil1: true});

        const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, {logger});

        const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, setup.starkInfo, {logger});

        assert(resV==true);

        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, {});

        const fileName = await tmp.tmpName();
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl"});

        const input = proof2zkin(resP.proof, setup.starkInfo);
        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    });

});
