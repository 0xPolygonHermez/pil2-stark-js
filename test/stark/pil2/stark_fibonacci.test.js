const F3g = require("../../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom2");
const protobuf = require('protobufjs');

const Logger = require('logplease');

const fs = require("fs");
const { newCommitPolsArrayPil2, newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

const smFibonacci = require("../../state_machines/pil2/sm_fibonacci/sm_fibonacci.js");

const { generateStarkProof } = require("../helpers");
const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/pil2/piloutInfo");

describe("test fibonacci pil2 sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 6,
            nBitsExt: 8,
            nQueries: 32,
            verificationHashType : "GL",
            steps: [
                {nBits: 8},
                {nBits: 5},
                {nBits: 3}
            ]
        };

        const F = new F3g("0xFFFFFFFF00000001");
        await compile(F, path.join(__dirname, "../../state_machines/", "pil2", "sm_fibonacci", "fibonacci.pil"));
        
        const piloutEncoded = fs.readFileSync("./tmp/pilout.ptb");
        const PilOut = protobuf.loadSync("./node_modules/pilcom2/src/pilout.proto").lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = 0;
        pil.subproofId = 0;

        const cnstPols = newConstantPolsArrayPil2(pil.symbols, pil.numRows, F);
        getFixedPolsPil2(pil, cnstPols, F);

        const cmPols = newCommitPolsArrayPil2(pil.symbols, pil.numRows, F);
        await smFibonacci.execute(pil.numRows, cmPols.Fibonacci, F);

        const inputs = { in1: 1n, in2: 2n, mod: 5n };
        await generateStarkProof(cnstPols, cmPols, pil, starkStruct, inputs, {logger, F, pil1: false, debug: true});
    });
});
