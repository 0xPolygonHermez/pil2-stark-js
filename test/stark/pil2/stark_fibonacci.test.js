const chai = require("chai");
const assert = chai.assert;
const F3g = require("../../../src/helpers/f3g");
const path = require("path");

const { compile } = require("pilcom2");
const protobuf = require('protobufjs');

const Logger = require('logplease');

const fs = require("fs");
const { newCommitPolsArrayPil2 } = require("pilcom/src/polsarray");

const smFibonacci = require("../../state_machines/sm_fibonacci_pil2/sm_fibonacci.js");

const { getFixedPolsPil2 } = require("../../../src/pil_info/helpers/getPiloutInfo");

const starkSetup = require("../../../src/stark/stark_setup.js");
const starkGen = require("../../../src/stark/stark_gen.js");
const starkVerify = require("../../../src/stark/stark_verify.js");

const pil2circom = require("../../../src/pil2circom");
const { proof2zkin } = require("../../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');


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
        await compile(F, path.join(__dirname, "../../state_machines/", "sm_fibonacci_pil2", "fibonacci.pil"));
        
        const piloutEncoded = fs.readFileSync("./tmp/pilout.ptb");
        const PilOut = protobuf.loadSync("./node_modules/pilcom2/src/pilout.proto").lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const pil = pilout.subproofs[0].airs[0];
        pil.symbols = pilout.symbols;
              
        const constPols = getFixedPolsPil2(pil, F);

        const cmPols = newCommitPolsArrayPil2(pil.symbols, pil.numRows, F);
        await smFibonacci.execute(pil.numRows, cmPols.Fibonacci, F);

        const setup = await starkSetup(constPols, pil, starkStruct, {F, pil1: false});

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