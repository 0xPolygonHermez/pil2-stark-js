const chai = require("chai");
const assert = chai.assert;
const { F1Field } = require("ffjavascript");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const smSimple = require("../state_machines/sm_simple/sm_simple.js");

const Logger = require("logplease");
Logger.setLogLevel("DEBUG");

const { generateFflonkProof } = require("./helpers.js");

describe("simple sm", async function () {
    this.timeout(10000000);

    it("Simple1", async () => {
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

    async function runTest(pilFile) {
        const logger = Logger.create("pil-fflonk", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);
    
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple", `${pilFile}.pil`));
        const constPols =  newConstantPolsArray(pil, F);
    
        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smSimple.buildConstants(N, constPols.Simple);
    
        const cmPols = newCommitPolsArray(pil, F);
    
        await smSimple.execute(N, cmPols.Simple, F);
    
        const res = await verifyPil(F, pil, cmPols , constPols);
    
        if (res.length != 0) {
            console.log("Pil does not pass");
            for (let i=0; i<res.length; i++) {
                console.log(res[i]);
            }
            assert(0);
        }
    
        await generateFflonkProof(constPols, cmPols, pil, {F, logger, extraMuls: 0, maxQDegree: 1});
    }
});
