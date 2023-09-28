const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPlookup = require("../state_machines/sm_plookup/sm_plookup.js");
const smFibonacci = require("../state_machines/sm_fibonacci/sm_fibonacci.js");
const smPermutation = require("../state_machines/sm_permutation/sm_permutation.js");
const smConnection = require("../state_machines/sm_connection/sm_connection.js");

const Logger = require('logplease');

const { generateStarkProof } = require("./helpers");

describe("test All sm", async function () {
    this.timeout(10000000);

    it("Testing all", async () => {
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
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = 2**(starkStruct.nBits);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = newCommitPolsArray(pil, F);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, {logger, F, pil1: true, debug: true});
    });

    it("Testing all with hashCommits set to true", async () => {
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
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = 2**(starkStruct.nBits);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = newCommitPolsArray(pil, F);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, {logger, F, pil1: true, debug: true, hashCommits: true, vadcop: true});
    });

});
