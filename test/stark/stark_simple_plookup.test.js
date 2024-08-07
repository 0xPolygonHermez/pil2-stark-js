const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smSimplePlookup = require("../state_machines/sm_simple_plookup/sm_simple_plookup.js");

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/witness/witnessCalculator.js");

describe("test stark simple plookup sm", async function () {
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
                {nBits: 2}
            ]
        };

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple_plookup", "simple_plookup_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smSimplePlookup.buildConstants(N, constPols.SimplePlookup);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smSimplePlookup.execute(N, cmPols.SimplePlookup);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [], {logger, F, pil2: false, debug: true});
    });

});
