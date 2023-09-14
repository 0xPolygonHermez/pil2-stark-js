const chai = require("chai");
const expect = chai.expect;
const path = require("path");

const { fflonkSetup, fflonkProve, pilInfo, exportFflonkCalldata, exportPilFflonkVerifier, fflonkVerificationKey, readPilFflonkZkeyFile} = require("pil-stark");

const fs = require("fs");
const {ethers, run} = require("hardhat");


module.exports.generateFflonkProof = async function generateFflonkProof(constPols, cmPols, pil, options) {
    const logger = options.logger;
    const debug = options.debug;
    const extraMuls = options.extraMuls || 0;
    const maxQDegree = options.maxQDegree;
    const F = options.F;

    const ptauFile =  path.join(__dirname, "../../", "tmp", "powersOfTau28_hez_final_19.ptau");
    const zkeyFilename =  path.join(__dirname, "../../", "tmp", "fflonk_all.zkey");

    const fflonkInfo = pilInfo(F, pil, false);

    await fflonkSetup(constPols, zkeyFilename, ptauFile, fflonkInfo, {extraMuls, maxQDegree, logger});

    const zkey = await readPilFflonkZkeyFile(zkeyFilename, {logger});

    const vk = await fflonkVerificationKey(zkey, {logger});

    if(debug) {
        const optionsPilVerify = {logger, debug, useThreads: false, parallelExec: false};
        const pilVerification = await fflonkProve(zkey, cmPols, fflonkInfo, optionsPilVerify);
        assert(pilVerification==true);
    }

    const {proof, publics} = await fflonkProve(zkey, cmPols, fflonkInfo, {logger});

    const proofInputs = await exportFflonkCalldata(vk, proof, publics, {logger})
    const verifierCode = await exportPilFflonkVerifier(vk, fflonkInfo, {logger});

    fs.writeFileSync("./tmp/contracts/pilfflonk_verifier_all.sol", verifierCode.verifierPilFflonkCode, "utf-8");
    fs.writeFileSync("./tmp/contracts/shplonk_verifier_all.sol", verifierCode.verifierShPlonkCode, "utf-8");

    await run("compile");

    const ShPlonkVerifier = await ethers.getContractFactory("./tmp/contracts/shplonk_verifier_all.sol:ShPlonkVerifier");
    const shPlonkVerifier = await ShPlonkVerifier.deploy();

    let shPlonkAddress = (await shPlonkVerifier.deployed()).address;

    const PilFflonkVerifier = await ethers.getContractFactory("./tmp/contracts/pilfflonk_verifier_all.sol:PilFflonkVerifier");
    const pilFflonkVerifier = await PilFflonkVerifier.deploy(shPlonkAddress);

    await pilFflonkVerifier.deployed();

    if(publics.length > 0) {
        const inputs = proofInputs.split("],[")
        .map((str, index) => (index === 0 ? str + ']' : '[' + str))
        .map(str => JSON.parse(str));
        expect(await pilFflonkVerifier.verifyProof(...inputs)).to.equal(true);

    } else {
        expect(await pilFflonkVerifier.verifyProof(JSON.parse(proofInputs))).to.equal(true);

    }
}