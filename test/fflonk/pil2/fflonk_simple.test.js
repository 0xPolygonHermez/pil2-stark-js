const { F1Field } = require("ffjavascript");
const path = require("path");

const smSimple = require("../../state_machines/pil2/sm_simple/sm_simple.js");

const Logger = require("logplease");
Logger.setLogLevel("DEBUG");

const fs = require("fs");

const { generateFflonkProof } = require("../helpers.js");

const protobuf = require('protobufjs');

const compilePil2 = require("pil2-compiler/src/compiler.js");
const { newCommitPolsArrayPil2, newConstantPolsArrayPil2 } = require("pilcom/src/polsarray");

const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/pil2/piloutInfo");

async function runTest(pilFile) {
    const logger = Logger.create("pil-fflonk", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

    const tmpPath = path.resolve(__dirname, '../../../tmp');
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    let pilConfig = { piloutDir: tmpPath};
    await compile(F, path.join(__dirname, "../../state_machines/", "pil2", "sm_simple", pilFile), null, pilConfig);
    
    const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
    const pilOutProtoPath = path.resolve(__dirname, '../../../node_modules/pil2-compiler/src/pilout.proto');
    const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
    let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
    
    const pil = pilout.subproofs[0].airs[0];
    pil.symbols = pilout.symbols;
    pil.numChallenges = pilout.numChallenges;

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

    await generateFflonkProof(cnstPols, cmPols, pil, {}, {F, logger, extraMuls: 0, maxQDegree: 1, pil2: true, debug: true});
}

describe("simple sm", async function () {
    this.timeout(10000000);

    it("Simple1", async () => {
        await runTest("simple1.pil");
    });
    it.skip("Simple2", async () => {
        await runTest("simple2.pil");
    });
    it("Simple3", async () => {
        await runTest("simple3.pil");
    });
});
