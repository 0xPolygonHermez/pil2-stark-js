const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPermutation = require("../state_machines/sm_simple_permutation/sm_simple_permutation.js");

const { generateStarkProof } = require("./helpers");


describe("test simple permutation sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 3,
            nBitsExt: 4,
            nQueries: 8,
            verificationHashType : "GL",
            steps: [
                {nBits: 4},
                {nBits: 3}
            ]
        };

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple_permutation", "simple_permutation_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = 2**(starkStruct.nBits);

        await smGlobal.buildConstants(N,constPols.Global);
        await smPermutation.buildConstants(N,constPols.SimplePermutation);

        const cmPols = newCommitPolsArray(pil, F);

        await smPermutation.execute(N, cmPols.SimplePermutation);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [], {logger, F, pil2: false, debug: true});
    });

});
