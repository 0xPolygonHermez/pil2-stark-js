const F3g = require("../../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom2");
const protobuf = require('protobufjs');

const Logger = require('logplease');

const fs = require("fs");
const { newCommitPolsArrayPil2, newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

const smSimple = require("../../state_machines/pil2/sm_simple/sm_simple.js");

const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/pil2/piloutInfo");


const { generateStarkProof } = require("../helpers");

async function runTest(pilFile) {
        const logger = Logger.create("pil-stark", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const starkStruct = {
            nBits: 6,
            nBitsExt: 8,
            nQueries: 32,
            verificationHashType : "GL",
            steps: [
                {nBits: 8},
                {nBits: 3}
            ]
        };

        const F = new F3g("0xFFFFFFFF00000001");
        await compile(F, path.join(__dirname, "../../state_machines/", "pil2", "sm_simple", pilFile));
        
        const piloutEncoded = fs.readFileSync("./tmp/pilout.ptb");
        const PilOut = protobuf.loadSync("./node_modules/pilcom2/src/pilout.proto").lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;

        const cnstPols = newConstantPolsArrayPil2(pil.symbols, pil.numRows, F);
        getFixedPolsPil2(pil, cnstPols, F);

        const cmPols = newCommitPolsArrayPil2(pil.symbols, pil.numRows, F);

        if(pilFile === "simple2.pil") {
            await smSimple.execute2(pil.numRows, cmPols.Simple, F);
        } else if (pilFile === "simple3.pil") {
            await smSimple.execute3(pil.numRows, cmPols.Simple, F);
        } else {
            await smSimple.execute(pil.numRows, cmPols.Simple, F);
        }
        
        await generateStarkProof(cnstPols, cmPols, pil, starkStruct, {logger, F, pil1: false, debug: true});
}

describe("simple sm", async function () {
    this.timeout(10000000);

    it("Simple1", async () => {
        await runTest("simple1.pil");
    });
    it("Simple2", async () => {
        await runTest("simple2.pil");
    });
    it("Simple3", async () => {
        await runTest("simple3.pil");
    });
    it("Simple4", async () => {
        await runTest("simple4.pil");
    });
});
