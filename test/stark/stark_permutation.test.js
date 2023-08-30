const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPermutation = require("../state_machines/sm_permutation/sm_permutation.js");

const { generateStarkProof } = require("./helpers");

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

        await generateStarkProof(constPols, cmPols, pil, starkStruct, {logger, F, pil1: true});
    });

});
