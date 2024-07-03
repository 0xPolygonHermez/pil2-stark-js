const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPermutation = require("../state_machines/sm_permutation/sm_permutation.js");

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/witness/witnessCalculator.js");

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

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_permutation", "permutation_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPermutation.buildConstants(N, constPols.Permutation);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smPermutation.execute(N, cmPols.Permutation);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [], {logger, F, pil2: false, debug: true});
    });

});
