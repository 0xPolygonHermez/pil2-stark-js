const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const Logger = require('logplease');

const smGlobal = require("../state_machines/sm/sm_global.js");
const smConnection = require("../state_machines/sm_connection/sm_connection.js");

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/witness/witnessCalculator.js");

describe("test connection sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 10,
            nBitsExt: 11,
            nQueries: 8,
            verificationHashType : "GL",
            steps: [
                {nBits: 11},
                {nBits: 3}
            ]
        };

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_connection", "connection_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [], {logger, F, pil2: false, debug: true});
    });

});
