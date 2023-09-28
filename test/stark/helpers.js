const chai = require("chai");
const assert = chai.assert;
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin, challenges2zkin } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const tmp = require('tmp-promise');
const fs = require("fs");
const { pilInfo } = require("../../index.js");
const { calculateTranscript } = require("../../src/stark/calculateTranscriptVerify.js");

module.exports.generateStarkProof = async function generateStarkProof(constPols, cmPols, pil, starkStruct, options) {
    const logger = options.logger;
    const debug = options.debug;
    const hashCommits = options.hashCommits;
    const vadcop = options.vadcop;
    const F = options.F;
    const pil1 = options.pil1;
    const skip = options.skip || false;

    if(debug) {
        const verificationHashType = "GL";
        const splitLinearHash = false;

        const optionsPilVerify = {logger, debug: true, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};

        const starkInfo = pilInfo(F, pil, true, pil1, debug, {});
        const pilVerification = await starkGen(cmPols, constPols, {}, starkInfo, optionsPilVerify);
        assert(pilVerification==true);
    }

    const setup = await starkSetup(constPols, pil, starkStruct, {F, pil1});

    const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, {logger, hashCommits});

    const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, [], setup.starkInfo, {logger, hashCommits});

    assert(resV==true);

    if(!skip) {
        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, {hashCommits, vadcop});

        const fileName = await tmp.tmpName();
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl", verbose: true});

        let input = proof2zkin(resP.proof, setup.starkInfo);

        if(vadcop) {
            const challenges = await calculateTranscript(F, setup.starkInfo, resP.proof, resP.publics, {hashCommits});
            input = challenges2zkin(challenges, setup.starkInfo, input);
        }

        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    }
}