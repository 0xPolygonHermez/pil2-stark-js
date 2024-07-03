const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom");

const starkStruct = require("../state_machines/sm_all/all.starkstruct.json");

const smGlobal = require("../state_machines/sm/sm_global.js");
const smPlookup = require("../state_machines/sm_plookup/sm_plookup.js");
const smFibonacci = require("../state_machines/sm_fibonacci/sm_fibonacci.js");
const smPermutation = require("../state_machines/sm_permutation/sm_permutation.js");
const smConnection = require("../state_machines/sm_connection/sm_connection.js");

const Logger = require('logplease');

const { generateStarkProof } = require("./helpers");
const { generateWtnsCols, generateFixedCols } = require("../../src/witness/witnessCalculator.js");

describe("test All sm", async function () {
    this.timeout(10000000);

    it("Testing all", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [1n, 2n, cmPols.Fibonacci.l1[N - 1]], {logger, F, pil2: false, debug: true});
    });

    it("Testing all with permutations and connections stage 2", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [1n, 2n, cmPols.Fibonacci.l1[N - 1]], {logger, F, pil2: false, debug: true, firstPossibleStage: true});
    });

    it("Testing all with imPolynomials in each stage", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = generateWtnsCols(pil.references, pil.references[Object.keys(pil.references)[0]].polDeg, false);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [1n, 2n, cmPols.Fibonacci.l1[N - 1]], {logger, F, pil2: false, debug: true, firstPossibleStage: true, imPolsStages: true});
    });

    it("Testing all with hashCommits set to true", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const N = 2**(starkStruct.nBits);

        const F = new F3g("0xFFFFFFFF00000001");
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_all", "all_main.pil"));
        const constPols = generateFixedCols(pil.references, N, false);

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = generateWtnsCols(pil.references, N, false);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateStarkProof(constPols, cmPols, pil, starkStruct, [1n, 2n, cmPols.Fibonacci.l1[N - 1]], {logger, F, pil2: false, debug: true, hashCommits: true});
    });

});
