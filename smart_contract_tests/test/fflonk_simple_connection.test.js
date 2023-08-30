const chai = require("chai");
const assert = chai.assert;
const {F1Field} = require("ffjavascript");
const path = require("path");
const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const smGlobal = require("../../test/state_machines/sm/sm_global.js");
const smSimpleConnection = require("../../test/state_machines/sm_simple_connection/sm_simple_connection.js");

const Logger = require('logplease');

const { generateFflonkProof } = require("./helpers.js");

const fs = require("fs");

describe("Fflonk simple connection sm", async function () {
    this.timeout(10000000);

    before(async () => {
        if (!fs.existsSync(`./tmp/contracts`)){
            fs.mkdirSync(`./tmp/contracts`, {recursive: true});
        }
    })

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-fflonk", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

        const pil = await compile(F, path.join(__dirname, "../../test/state_machines/", "sm_simple_connection", "simple_connection_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smGlobal.buildConstants(N, constPols.Global);
        await smSimpleConnection.buildConstants(N, constPols.SimpleConnection, F);

        const cmPols = newCommitPolsArray(pil, F);

        await smSimpleConnection.execute(N, cmPols.SimpleConnection);

        const res = await verifyPil(F, pil, cmPols , constPols);

        if (res.length != 0) {
            console.log("Pil does not pass");
            for (let i=0; i<res.length; i++) {
                console.log(res[i]);
            }
            assert(0);
        }

        await generateFflonkProof(constPols, cmPols, pil, {F, logger, extraMuls: 1});
    });

});