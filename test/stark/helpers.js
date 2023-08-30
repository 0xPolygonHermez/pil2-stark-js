const chai = require("chai");
const assert = chai.assert;
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');
const fs = require("fs");

module.exports.generateStarkProof = async function generateStarkProof(constPols, cmPols, pil, starkStruct, options) {
    const logger = options.logger;
    const F = options.F;
    const pil1 = options.pil1;
    const skip = options.skip || false;

    const setup = await starkSetup(constPols, pil, starkStruct, {F, pil1});

    const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, {logger});

    const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, setup.starkInfo, {logger});

    assert(resV==true);

    if(!skip) {
        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, {});

        const fileName = await tmp.tmpName();
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl", verbose: true});

        const input = proof2zkin(resP.proof, setup.starkInfo);
        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    }
}