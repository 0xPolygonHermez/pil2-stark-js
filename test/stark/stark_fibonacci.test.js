const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../src/helpers/f3g");
const path = require("path");
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const { newConstantPolsArray, newCommitPolsArray, compile, verifyPil } = require("pilcom");

const Logger = require('logplease');

const smFibonacci = require("../state_machines/sm_fibonacci/sm_fibonacci.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');
const fs = require("fs");

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

        const setup = await starkSetup(constPols, pil, true, starkStruct, {F});

        const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, {logger});

        const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, setup.starkInfo, {logger});

        assert(resV==true);

        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, {});

        const fileName = await tmp.tmpName();
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl", verbose: true});

        const input = proof2zkin(resP.proof, setup.starkInfo);
        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    });

});
