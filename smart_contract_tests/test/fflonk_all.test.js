const {F1Field} = require("ffjavascript");
const path = require("path");
const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const smGlobal = require("../../test/state_machines/sm/sm_global.js");
const smPlookup = require("../../test/state_machines/sm_plookup/sm_plookup.js");
const smFibonacci = require("../../test/state_machines/sm_fibonacci/sm_fibonacci.js");
const smPermutation = require("../../test/state_machines/sm_permutation/sm_permutation.js");
const smConnection = require("../../test/state_machines/sm_connection/sm_connection.js");

const Logger = require('logplease');

const fs = require("fs");
const { generateFflonkProof } = require("./helpers.js");


describe("Fflonk All sm", async function () {
    
    before(async () => {
        if (!fs.existsSync(`./tmp/contracts`)){
            fs.mkdirSync(`./tmp/contracts`, {recursive: true});
        }
    })

    this.timeout(10000000);

    it("It should create the pols main", async () => {
        const logger = Logger.create("pil-fflonk", {showTimestamp: false});
        Logger.setLogLevel("DEBUG");

        const F = new F1Field(21888242871839275222246405745257275088548364400416034343698204186575808495617n);

        const pil = await compile(F, path.join(__dirname, "../../test/state_machines/", "sm_all", "all_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smGlobal.buildConstants(N, constPols.Global);
        await smPlookup.buildConstants(N, constPols.Plookup);
        await smFibonacci.buildConstants(N, constPols.Fibonacci);
        await smPermutation.buildConstants(N, constPols.Permutation);
        await smConnection.buildConstants(N, constPols.Connection, F);

        const cmPols = newCommitPolsArray(pil, F);

        await smPlookup.execute(N, cmPols.Plookup);
        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);
        await smPermutation.execute(N, cmPols.Permutation);
        await smConnection.execute(N, cmPols.Connection);

        await generateFflonkProof(constPols, cmPols, pil, {}, {F, logger, extraMuls: 2, maxQDegree: 2, debug: true});
    });

});