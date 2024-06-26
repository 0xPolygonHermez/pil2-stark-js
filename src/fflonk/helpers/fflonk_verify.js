const { verifyOpenings, Keccak256Transcript } = require("shplonkjs");
const {utils, getCurveFromName } = require("ffjavascript");
const { fromObjectVk, fromObjectProof } = require("./helpers");
const { calculateHashFflonk } = require("./fflonk_prover_helpers");
const { unstringifyBigInts } = utils;


module.exports = async function fflonkVerify(vk, publicSignals, proof, challenges, fflonkInfo, options) {
    const logger = options.logger;

    const curve = await getCurveFromName(vk.curve);
    const Fr = curve.Fr;
    
    vk = fromObjectVk(curve, vk);
    
    proof = fromObjectProof(curve, proof);

    let publics = [];
    if (publicSignals !== "") {
        publics = unstringifyBigInts(publicSignals).map(p => Fr.e(p));
    }

    const ctx = {};
    ctx.fflonkInfo = fflonkInfo;
    ctx.evals = [];
    ctx.proof = proof;
    ctx.publics = publics;
    ctx.curve = curve;
    ctx.N = 1 << vk.power;
    ctx.nBits = vk.power;

    const domainSize = ctx.N;
    const power = vk.power;

    const nPolsQ = vk.f.filter(fi => fi.stages[0].stage === fflonkInfo.nStages + 1).map(fi => fi.pols).flat(Infinity);

    if (logger) {
        logger.debug("------------------------------");
        logger.debug("  PIL-FFLONK VERIFY SETTINGS");
        logger.debug(`  Curve:         ${curve.name}`);
        logger.debug(`  Domain size:   ${domainSize} (2^${power})`);
        logger.debug(`  Const  pols:   ${fflonkInfo.nConstants}`);
        logger.debug(`  Stage 1 pols:   ${fflonkInfo.mapSectionsN.cm1}`);
        for(let i = 0; i < fflonkInfo.nStages - 1; i++) {
            const stage = i + 2;
            logger.debug(`  Stage ${stage} pols:   ${fflonkInfo.mapSectionsN[`cm${stage}`]}`);
        }
        logger.debug(`  Stage Q pols:   ${nPolsQ.length}`);
        logger.debug("------------------------------");
    }

    if(!challenges) {
        ctx.challenges = [];
        if (logger) logger.debug("Calculating transcript");
        await calculateTranscript(ctx, vk, options);
    } else {
        ctx.challenges = challenges;
    }

    // Store the polynomial commits to its corresponding fi
    for(let i = 0; i < vk.f.length; ++i) {
        if(!proof.polynomials[`f${vk.f[i].index}`]) {
            if(logger) logger.warn(`f${vk.f[i].index} commit is missing`);
            return false;
        }
        vk.f[i].commit = proof.polynomials[`f${vk.f[i].index}`];
    }

    for(let i = 0; i < fflonkInfo.evMap.length; ++i) {
        const ev = fflonkInfo.evMap[i];
        let polName = ev.prime === 0 ? ev.name : ev.prime === 1 ? ev.name + "w" : ev.name + `w${ev.prime}`;
        ctx.evals[i] = proof.evaluations[polName]; 
    }
    
    const execCode = executeCode(curve.Fr, ctx, fflonkInfo.code.qVerifier.code);

    const xN = curve.Fr.exp(ctx.x, ctx.N);
    ctx.Z = curve.Fr.sub(xN, curve.Fr.one);   

    if(!curve.Fr.eq(curve.Fr.mul(ctx.Z, proof.evaluations["invZh"]), curve.Fr.one)) {
        if(logger) logger.warn("Invalid invZh evaluation");
        return false;
    }
   
    const Q = curve.Fr.div(execCode, ctx.Z);

    const nonCommittedPols = [];
    if(vk.maxQDegree === 0) {
        proof.evaluations["Q"] = Q;
        nonCommittedPols.push("Q");
    } else {
        let xAcc = curve.Fr.one;
        let q = curve.Fr.zero;
        for (let i=0; i<nPolsQ.length; i++) {
            q = curve.Fr.add(q, curve.Fr.mul(xAcc, proof.evaluations[`Q${i}`]));
            for(let j = 0; j < vk.maxQDegree; ++j) {
                xAcc = curve.Fr.mul(xAcc, xN);
            }
        }
        if (!curve.Fr.eq(Q, q)) {
            console.log(`Invalid Q.`);
            return false;
        }

    }


    const res = verifyOpenings(vk, proof.polynomials, proof.evaluations, curve, {logger, xiSeed: ctx.challengeXiSeed, nonCommittedPols});
    await curve.terminate();

    return res;
}

async function calculateTranscript(ctx, vk, options) {
    const logger = options.logger;
    const transcript = new Keccak256Transcript(ctx.curve);

    const cnstCommitPols = Object.keys(vk).filter(k => k.match(/^f\d/));

    if(!ctx.fflonkInfo.hashCommits) {
        for(let i = 0; i < cnstCommitPols.length; ++i) {
            transcript.addPolCommitment(vk[cnstCommitPols[i]]);
        }
    
        for (let i=0; i<ctx.publics.length; i++) {
            transcript.addScalar(ctx.publics[i]);
        }

    } else {
        const constInputs = [];

        for(let i = 0; i < cnstCommitPols.length; ++i) {
            constInputs.push({commit: true, value: vk[cnstCommitPols[i]]});
        }

        let constHash = await calculateHashFflonk(ctx, constInputs);
        transcript.addScalar(constHash);
    
        const publicInputs = [];
        for (let i=0; i<ctx.publics.length; i++) {
            publicInputs.push({value: ctx.publics[i]});
        }

        let publicHash = await calculateHashFflonk(ctx, publicInputs);
        transcript.addScalar(publicHash);
    }
   

    for(let i=0; i < ctx.fflonkInfo.nStages; i++) {
        const stage = i + 1;
        const nChallengesStage = ctx.fflonkInfo.challengesMap.filter(c => c.stage === stage).length;
        ctx.challenges[stage - 1] = [];
        for(let j = 0; j < nChallengesStage; ++j) {
            ctx.challenges[stage - 1][j] = transcript.getChallenge();
            if (logger) logger.debug("··· challenges[" + (stage - 1) + "][" + j + "]: " + ctx.curve.Fr.toString(ctx.challenges[stage - 1][j]));
            transcript.reset();
            transcript.addScalar(ctx.challenges[stage - 1][j]);
        }

        const stageCommitPols = vk.f.filter(fi => fi.stages[0].stage === stage).map(fi => ctx.proof.polynomials[`f${fi.index}`]);
        if(!ctx.fflonkInfo.hashCommits) {
            for(let i = 0; i < stageCommitPols.length; i++) {
                transcript.addPolCommitment(stageCommitPols[i]);
            }
        } else {
            const challengeInputs = [];
            for(let i = 0; i < stageCommitPols.length; i++) {
                challengeInputs.push({commit: true, value: stageCommitPols[i]});
            }
            let hash = await calculateHashFflonk(ctx, challengeInputs);

            transcript.addScalar(hash);
        }

    }

    let qStage = ctx.fflonkInfo.nStages;
    ctx.challenges[qStage] = [];
    ctx.challenges[qStage][0] = transcript.getChallenge();
    if (logger) logger.debug("··· challenges[" + qStage + "][0]: " + ctx.curve.Fr.toString(ctx.challenges[qStage][0]));
    transcript.reset();
    transcript.addScalar(ctx.challenges[qStage][0]);

    const stageQCommitPols = vk.f
        .filter(fi => fi.stages[0].stage === ctx.fflonkInfo.nStages + 1)
        .map(fi => ctx.proof.polynomials[`f${fi.index}`]);
    
    if(!ctx.fflonkInfo.hashCommits) {
        for(let i = 0; i < stageQCommitPols.length; i++) {
            transcript.addPolCommitment(stageQCommitPols[i]);
        }
    } else {
        const challengeInputs = [];
        for(let i = 0; i < stageQCommitPols.length; i++) {
            challengeInputs.push({commit: true, value: stageQCommitPols[i]});
        }
        let hash = await calculateHashFflonk(ctx, challengeInputs);
        transcript.addScalar(hash);
    }
   

    ctx.challengeXiSeed = transcript.getChallenge();
    if (logger) logger.debug("··· challengesXiSeed: " + ctx.curve.Fr.toString(ctx.challengeXiSeed));

    let challengeXi = ctx.curve.Fr.exp(ctx.challengeXiSeed, vk.powerW);
    ctx.x = challengeXi;
}

function executeCode(F, ctx, code) {
    const tmp = [];
    for (let i=0; i<code.length; i++) {
        const src = [];
        for (k=0; k<code[i].src.length; k++) {
            src.push(getRef(code[i].src[k]));
        }
        let res;
        switch (code[i].op) {
            case 'add': res = F.add(src[0], src[1]); break;
            case 'sub': res = F.sub(src[0], src[1]); break;
            case 'mul': res = F.mul(src[0], src[1]); break;
            case 'muladd': res = F.add(F.mul(src[0], src[1]), src[2]); break;
            case 'copy': res = src[0]; break;
            default: throw new Error("Invalid op:"+ code[i].op);
        }
        setRef(code[i].dest, res);
    }
    return getRef(code[code.length-1].dest);


    function getRef(r) {
        switch (r.type) {
            case "tmp": return tmp[r.id];
            case "eval": 
                return ctx.evals[r.id];
            case "number": return ctx.curve.Fr.e(`${r.value}`);
            case "public": return ctx.curve.Fr.e(ctx.publics[r.id]);
            case "challenge": return ctx.challenges[r.stage - 1][r.id];
            case "x": return ctx.x;
            default: throw new Error("Invalid reference type get: " + r.type);
        }
    }

    function setRef(r, val) {
        switch (r.type) {
            case "tmp": tmp[r.id] = val; return;
            default: throw new Error("Invalid reference type set: " + r.type);
        }
    }

}
