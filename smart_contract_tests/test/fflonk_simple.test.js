const {F1Field} = require("ffjavascript");
const path = require("path");
const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const smSimple = require("../../test/state_machines/sm_simple/sm_simple.js");

const { generateFflonkProof } = require("./helpers.js");

const fs = require("fs");

const Logger = require('logplease');

async function runTest(pilFile) {
    const logger = Logger.create("pil-fflonk", {showTimestamp: false});
    Logger.setLogLevel("DEBUG");

    const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

    const pil = await compile(F, path.join(__dirname, "../../test/state_machines/", "sm_simple", `${pilFile}.pil`));
    const constPols =  newConstantPolsArray(pil, F);
    
    const N = pil.references[Object.keys(pil.references)[0]].polDeg;

    await smSimple.buildConstants(N, constPols.Simple);

    const cmPols = newCommitPolsArray(pil, F);

    await smSimple.execute(N, cmPols.Simple, F);

    await generateFflonkProof(constPols, cmPols, pil, {F, logger, extraMuls: 0, debug: true});
}



describe("simple sm", async function () {
    this.timeout(10000000);

    before(async () => {
        if (!fs.existsSync(`./tmp/contracts`)){
            fs.mkdirSync(`./tmp/contracts`, {recursive: true});
        }
    })

    it.skip("Simple1", async () => {
        await runTest("simple1");
    });
    it("Simple2", async () => {
        await runTest("simple2");
    });
    it("Simple2p", async () => {
        await runTest("simple2p");
    });
    it("Simple3", async () => {
        await runTest("simple3");
    });
    it("Simple4", async () => {
        await runTest("simple4");
    });
    it("Simple4p", async () => {
        await runTest("simple4p");
    });

});
