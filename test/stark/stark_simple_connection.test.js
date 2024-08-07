const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smSimpleConnection = require("../state_machines/sm_simple_connection/sm_simple_connection.js");

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/witness/witnessCalculator.js");

describe("test simple connection sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 2,
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
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple_connection", "simple_connection_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smSimpleConnection.buildConstants(N, constPols.SimpleConnection, F);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smSimpleConnection.execute(N, cmPols.SimpleConnection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [], {logger, F, pil2: false, debug: true});
    });

});