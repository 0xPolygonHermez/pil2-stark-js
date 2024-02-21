const chai = require("chai");
const assert = chai.assert;
const path = require("path");

const pilInfo = require("../../src/pil_info/pil_info.js");
const fflonkSetup  = require("../../src/fflonk/helpers/fflonk_setup.js");
const fflonkProve = require("../../src/fflonk/helpers/fflonk_prover.js");
const fflonkVerify  = require("../../src/fflonk/helpers/fflonk_verify.js");
const fflonkVerificationKey = require("../../src/fflonk/helpers/fflonk_verification_key.js");
const { readPilFflonkZkeyFile } = require("../../src/fflonk/zkey/zkey_pilfflonk.js");

module.exports.generateFflonkProof = async function generateFflonkProof(constPols, cmPols, pil, inputs, options) {
    const logger = options.logger;
    const debug = options.debug;
    const extraMuls = options.extraMuls || 0;
    const maxQDegree = options.maxQDegree;
    const hashCommits = options.hashCommits;
    const pil2 = options.pil2 || false;
    const F = options.F;

    const ptauFile =  path.join(__dirname, "../../", "tmp", "powersOfTau28_hez_final_19.ptau");
    const zkeyFilename =  path.join(__dirname, "../../", "tmp", "fflonk_all.zkey");

    const fflonkInfo = pilInfo(F, pil, false, pil2);

    await fflonkSetup(constPols, zkeyFilename, ptauFile, fflonkInfo, {extraMuls, logger, maxQDegree});

    const zkey = await readPilFflonkZkeyFile(zkeyFilename, {logger});

    const vk = await fflonkVerificationKey(zkey, {logger});

    const {proof, publics} = await fflonkProve(zkey, cmPols, fflonkInfo, inputs, {logger, hashCommits});

    const isValid = await fflonkVerify(vk, publics, proof, [], fflonkInfo, {logger, hashCommits});

    assert(isValid);
}