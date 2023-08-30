const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../src/helpers/f3g");
const path = require("path");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const Logger = require('logplease');

const smFibonacci = require("../state_machines/sm_fibonacci/sm_fibonacci.js");
const { generateStarkProof } = require("./helpers");

describe("test fibonacci sm", async function () {
    this.timeout(10000000);

    it("It should create the pols main", async () => {
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
        const pil = await compile(F, path.join(__dirname, "../state_machines/", "sm_fibonacci", "fibonacci_main2.pil"));

        pil.polIdentities[0].boundary = "everyFrame";
        pil.polIdentities[0].offsetMin = 0;
        pil.polIdentities[0].offsetMax = 1;

        pil.polIdentities[1].boundary = "everyFrame";
        pil.polIdentities[1].offsetMin = 0;
        pil.polIdentities[1].offsetMax = 1;

        pil.polIdentities[2].boundary = "firstRow";
        pil.polIdentities[3].boundary = "firstRow";
        pil.polIdentities[4].boundary = "lastRow";

        
        const constPols =  newConstantPolsArray(pil, F);
        
        const N = 2**(starkStruct.nBits);

        await smFibonacci.buildConstants(N, constPols.Fibonacci);

        const cmPols = newCommitPolsArray(pil, F);

        await smFibonacci.execute(N, cmPols.Fibonacci, [1,2], F);

        const res = await verifyPil(F, pil, cmPols , constPols);

        // if (res.length != 0) {
        //     console.log("Pil does not pass");
        //     for (let i=0; i<res.length; i++) {
        //         console.log(res[i]);
        //     }
        //     assert(0);
        // }

        await generateStarkProof(constPols, cmPols, pil, starkStruct, {logger, F, pil1: true});
    });

});
