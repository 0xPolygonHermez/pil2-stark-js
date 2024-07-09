const chai = require("chai");
const assert = chai.assert;
const starkSetup = require("../../src/stark/stark_setup.js");
const starkGen = require("../../src/stark/stark_gen.js");
const starkVerify = require("../../src/stark/stark_verify.js");

const pil2circom = require("../../src/pil2circom");
const { proof2zkin, challenges2zkinCircom } = require("../../src/proof2zkin");
const wasm_tester = require("circom_tester/wasm/tester");
const fs = require("fs");
const { pilInfo } = require("../../index.js");
const { calculateTranscript } = require("../../src/stark/calculateTranscriptVerify.js");

module.exports.generateStarkProof = async function generateStarkProof(constPols, cmPols, pil, starkStruct, inputs, options) {
    const logger = options.logger;

    const debug = options.debug;
    const F = options.F;
    const pil2 = options.pil2;
    const skip = options.skip || false;
    const hashCommits = options.hashCommits || false;
    
    if(debug) {
        const verificationHashType = "GL";
        const splitLinearHash = false;

        const optionsPilVerify = {logger, debug: true, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};

        const {pilInfo: starkInfo, expressionsInfo} = pilInfo(F, pil, true, pil2, {}, {debug: debug});
        const pilVerification = await starkGen(cmPols, constPols, {}, starkInfo, expressionsInfo, inputs, optionsPilVerify);
        assert(pilVerification==true);
    }

    const setup = await starkSetup(constPols, pil, {...starkStruct, hashCommits}, {...options, debug: false});

    const resP = await starkGen(cmPols, constPols, setup.constTree, setup.starkInfo, setup.expressionsInfo, inputs, {...options, debug: false});

    const resV = await starkVerify(resP.proof, resP.publics, setup.constRoot, { challenges: resP.challenges, challengesFRISteps: resP.challengesFRISteps }, setup.starkInfo, setup.verifierInfo, {...options, debug: false});

    assert(resV==true);

    if(!skip) {
        const verifier = await pil2circom(setup.constRoot, setup.starkInfo, setup.verifierInfo);

        // const fileName = await tmp.tmpName();
        const fileName = "tmp/all.test.verifier.circom";
        await fs.promises.writeFile(fileName, verifier, "utf8");

        const circuit = await wasm_tester(fileName, {O:1, prime: "goldilocks", include: "circuits.gl", verbose: true});

        let input = proof2zkin(resP.proof, setup.starkInfo);

        if(options.inputChallenges) {
            const challenges = await calculateTranscript(F, setup.starkInfo, resP.proof, resP.publics, setup.constRoot, {logger});
            input = challenges2zkinCircom(challenges, setup.starkInfo, input);
        }

        input.publics = resP.publics;

        await circuit.calculateWitness(input, true);

        await fs.promises.unlink(fileName);
    }
}
