const chai = require("chai");
const assert = chai.assert;
const {F1Field} = require("ffjavascript");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const smGlobal = require("../state_machines/sm/sm_global.js");
const smSimplePlookup = require("../state_machines/sm_simple_plookup/sm_simple_plookup.js");

const Logger = require('logplease');

const { generateFflonkProof } = require("./helpers.js");

describe("Fflonk simple plookup sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-fflonk", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_simple_plookup", "simple_plookup_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smGlobal.buildConstants(N, constPols.Global);
        await smSimplePlookup.buildConstants(N, constPols.SimplePlookup);

        const cmPols = newCommitPolsArray(pil, F);

        await smSimplePlookup.execute(N, cmPols.SimplePlookup);

        const res = await verifyPil(F, pil, cmPols , constPols);

        if (res.length != 0) {
            console.log("Pil does not pass");
            for (let i=0; i<res.length; i++) {
                console.log(res[i]);
            }
            assert(0);
        }

        await generateFflonkProof(constPols, cmPols, pil, {F, logger, extraMuls: 0});
    });
});
