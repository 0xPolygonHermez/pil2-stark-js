const F3g = require("../../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom2");
const protobuf = require('protobufjs');

const Logger = require('logplease');

const fs = require("fs");
const smSimple = require("../../state_machines/pil2/sm_simple/sm_simple.js");

const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/pil2/piloutInfo");


const { generateStarkProof } = require("../helpers");
const { generateWtnsCols, generateFixedCols } = require("../../../src/witness/witnessCalculator.js");

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
        const tmpPath = path.resolve(__dirname, '../../../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let pilConfig = { piloutDir: tmpPath};
        await compile(F, path.join(__dirname, "../../state_machines/", "pil2", "sm_simple", pilFile), null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
        const pilOutProtoPath = path.resolve(__dirname, '../../../node_modules/pilcom2/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = 0;
        pil.subproofId = 0;

        const cnstPols = generateFixedCols(pil.symbols, pil.numRows);
        getFixedPolsPil2(pil, cnstPols, F);

        const cmPols = generateWtnsCols(1, pil.symbols, pil.numRows);
        
        if(pilFile === "simple2.pil") {
            await smSimple.execute2(pil.numRows, cmPols.Simple, F);
        } else if (pilFile === "simple3.pil") {
            await smSimple.execute3(pil.numRows, cmPols.Simple, F);
        } else {
            await smSimple.execute(pil.numRows, cmPols.Simple, F);
        }
        
        const publics = []; 
        if(pilFile === "simple4.pil") {
            publics.push(cmPols.Simple.b[1]);
            publics.push(cmPols.Simple.a[pil.numRows - 1] * cmPols.Simple.a[pil.numRows - 1] * cmPols.Simple.a[pil.numRows - 1]);
        }
        
        await generateStarkProof(cnstPols, cmPols, pil, starkStruct, publics, {logger, F, pil2: true, debug: true});
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
    it.only("Simple4", async () => {
        await runTest("simple4.pil");
    });
});
