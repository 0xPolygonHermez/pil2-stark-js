const {F1Field} = require("ffjavascript");
const path = require("path");
const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const smGlobal = require("../../test/state_machines/sm/sm_global.js");
const smPermutation = require("../../test/state_machines/sm_permutation/sm_permutation.js");

const Logger = require('logplease');

const { generateFflonkProof } = require("./helpers.js");

const fs = require("fs");

describe("Fflonk permutation sm", async function () {
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

        const pil = await compile(F, path.join(__dirname, "../../test/state_machines/", "sm_permutation", "permutation_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smGlobal.buildConstants(N, constPols.Global);
        await smPermutation.buildConstants(N, constPols.Permutation);

        const cmPols = newCommitPolsArray(pil, F);

        await smPermutation.execute(N, cmPols.Permutation);

        await generateFflonkProof(constPols, cmPols, pil, {}, {F, logger, extraMuls: 1, debug: true});

    });

});