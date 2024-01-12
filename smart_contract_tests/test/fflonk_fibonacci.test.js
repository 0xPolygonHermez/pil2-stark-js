const {F1Field} = require("ffjavascript");
const path = require("path");
const { newConstantPolsArray, newCommitPolsArray, compile } = require("pilcom");

const smFibonacci = require("../../test/state_machines/sm_fibonacci/sm_fibonacci.js");

const Logger = require('logplease');

const { generateFflonkProof } = require("./helpers.js");

const fs = require("fs");

describe("Fflonk Fibonacci sm", async function () {
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

        const pil = await compile(F, path.join(__dirname, "../../test/state_machines/", "sm_fibonacci", "fibonacci_main.pil"));
        const constPols =  newConstantPolsArray(pil, F);

        const N = pil.references[Object.keys(pil.references)[0]].polDeg;

        await smFibonacci.buildConstants(N, constPols.Fibonacci);

        const cmPols = newCommitPolsArray(pil, F);

        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);

        await generateFflonkProof(constPols, cmPols, pil, {}, {F, logger, extraMuls: 1, debug: true});

    });

});