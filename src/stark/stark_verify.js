const FRI = require("./fri.js");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const { assert } = require("chai");
const buildPoseidonGL = require("../helpers/hash/poseidon/poseidon");
const { calculateTranscript, calculateFRIQueries } = require("./calculateTranscriptVerify");

module.exports = async function starkVerify(proof, proofValues, publics, constRoot, challenges, starkInfo, verifierInfo, options = {}) {
    const logger = options.logger;

    const starkStruct = starkInfo.starkStruct;

    const poseidon = await buildPoseidonGL();

    const F = poseidon.F;

    ctx = {
        evals: proof.evals,
        airgroupValues: proof.airgroupValues,
        airValues: proof.airValues,
        publics,
        proofValues,
        starkInfo,
        proof,
        F,
    };
    
    const nBits = starkStruct.nBits;
    const N = 1 << nBits;
    const extendBits = starkStruct.nBitsExt - starkStruct.nBits;

    const nQueries = starkInfo.starkStruct.nQueries;
    const steps = starkInfo.starkStruct.steps;
    const verificationHashType = (starkInfo.starkStruct.verificationHashType) || "GL";
    let merkleTreeArity;
    let merkleTreeCustom;
    let MH;
    if (verificationHashType == "GL") {
        MH = await buildMerkleHashGL(starkStruct.splitLinearHash);
    } else if (verificationHashType == "BN128") {
        merkleTreeArity = starkStruct.merkleTreeArity;
        merkleTreeCustom = starkStruct.merkleTreeCustom;
        MH = await buildMerkleHashBN128(merkleTreeArity, merkleTreeCustom);
    } else {
        throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
    }
    assert(nBits+extendBits == steps[0].nBits, "First step must be just one");
   
    const qStage = starkInfo.nStages + 1;

    if (logger) {
        logger.debug("-----------------------------");
        logger.debug("  PIL-STARK VERIFY SETTINGS");
        logger.debug(`  Blow up factor: ${extendBits}`);
        logger.debug(`  Number queries: ${nQueries}`);
        logger.debug(`  VerificationType: ${starkStruct.verificationHashType}`);
        logger.debug(`  Number Stark steps: ${starkStruct.steps.length}`);
        logger.debug(`  Hash Commits: ${starkInfo.starkStruct.hashCommits || false}`);
        logger.debug(`  Domain size: ${N} (2^${nBits})`);
        logger.debug(`  Const  pols:   ${starkInfo.nConstants}`);
        for(let i = 0; i < starkInfo.nStages; i++) {
            const stage = i + 1;
            logger.debug(`  Stage ${stage} pols:   ${starkInfo.cmPolsMap.filter(p => p.stage == stage).length}`);
        }
        logger.debug(`  Stage ${qStage} pols:   ${starkInfo.cmPolsMap.filter(p => p.stage == qStage).length}`);
        logger.debug("-----------------------------");
    }

    if(!challenges) {
        ctx.challenges = [];
        if (logger) logger.debug("Calculating transcript");
        const challenges = await calculateTranscript(F, starkInfo, proof, publics, constRoot, options);
        ctx.challenges = challenges.challenges;
        ctx.challengesFRISteps = challenges.challengesFRISteps;
    } else {
        ctx.challenges = challenges.challenges;
        ctx.challengesFRISteps = challenges.challengesFRISteps;
        if(logger) {
            for(let i=0; i < starkInfo.nStages; i++) {
                for(let j = 0; j < starkInfo.challengesMap.filter(c => c.stage === i + 1).length; ++j) {
                    logger.debug("··· challenges[" + i + "][" + j + "]: " + F.toString(ctx.challenges[i][j]));
                }
            }
            let qStage = starkInfo.nStages;
            logger.debug("··· challenges[" + qStage + "][0]: " + F.toString(ctx.challenges[qStage][0]));
    
            let evalsStage = starkInfo.nStages + 1;
            logger.debug("··· challenges[" + evalsStage + "][0]: " + F.toString(ctx.challenges[evalsStage][0]));
    
            let friStage = starkInfo.nStages + 2;
            logger.debug("··· challenges[" + friStage + "][0]: " + F.toString(ctx.challenges[friStage][0]));
            logger.debug("··· challenges[" + friStage + "][1]: " + F.toString(ctx.challenges[friStage][1]));
            for (let step=0; step<ctx.challengesFRISteps.length; step++) {
                logger.debug("··· challenges FRI folding step " + step + ": " + F.toString(ctx.challengesFRISteps[step]));
            }
            logger.debug("··· challenge FRI permutations: " + F.toString(ctx.challengesFRISteps[ctx.challengesFRISteps.length - 1]));
        }
    }

    ctx.friQueries = await calculateFRIQueries(starkInfo, ctx.challengesFRISteps[starkInfo.starkStruct.steps.length], options);

    if (logger) logger.debug("Verifying evaluations");

    let evalsStage = ctx.starkInfo.nStages + 1;
    const xi = ctx.challenges[evalsStage][0];

    const xN = F.exp(xi, N);
    
    const zh = F.sub(xN, 1n);
    ctx.Z = F.inv(zh);
    
    if(starkInfo.boundaries.map(b => b.name).includes("firstRow")) {
        ctx.Z_fr = F.mul(zh, F.inv(F.sub(xi, 1n)));
    }

    if(starkInfo.boundaries.map(b => b.name).includes("lastRow")) {
        let root = F.one;
        for(let i = 0; i < N - 1; ++i) {
            root = F.mul(root, F.w[nBits]);
        }
        ctx.Z_lr = F.mul(zh,F.inv(F.sub(xi, root)));
    }

    if(starkInfo.boundaries.map(b => b.name).includes("everyFrame")) {
        const constraintFrames = starkInfo.boundaries.filter(b => b.name === "everyFrame");
        for(let i = 0; i < constraintFrames.length; ++i) {
            ctx["Z_frame" + i] = F.one;
            const frame = constraintFrames[i];
            for(let j = 0; j < frame.offsetMin; ++j) {
                let root = F.one;
                for(let k = 0; k < j; ++k) {
                    root = F.mul(root, F.w[nBits]);
                }
                ctx["Z_frame" + i] = F.mul(ctx["Z_frame" + i], F.sub(xi, root));
            }
            for(let j = 0; j < frame.offsetMax; ++j) {
                let root = F.one;
                for(let k = 0; k < (N - j - 1); ++k) {
                    root = F.mul(root, F.w[nBits]);
                }
                ctx["Z_frame" + i] = F.mul(ctx["Z_frame" + i], F.sub(xi, root));
            }  
        }   
    }

    const res=module.exports.executeCode(F, ctx, verifierInfo.qVerifier.code);

    let xAcc = 1n;
    let q = 0n;
    let qIndex = starkInfo.cmPolsMap.findIndex(p => p.stage === qStage && p.stageId === 0);
    for (let i=0; i<starkInfo.qDeg; i++) {
        const evId = starkInfo.evMap.findIndex(e => e.type === "cm" && e.id === qIndex + i);
        q = F.add(q, F.mul(xAcc, ctx.evals[evId]));
        xAcc = F.mul(xAcc, xN);
    }

    if (!F.eq(res, q)) {
        if(logger) logger.warn("Invalid evaluations");
        return false;
    }
    
    const computeQuery = (query, idx) => {    
        const ctxQry = {};
        for(let i = 0; i < starkInfo.nStages; ++i) {
            const stage = i + 1;
            ctxQry[`cm${stage}`] = query[i][0];
        }
        ctxQry[`cm${qStage}`] = query[starkInfo.nStages][0];
        for(let i = 0; i < starkInfo.customCommits.length; ++i) {
            ctxQry[`custom_${starkInfo.customCommits[i].name}_0`] = query[starkInfo.nStages + 2 + i][0];
        }
        ctxQry.consts = query[starkInfo.nStages + 1][0];
        ctxQry.evals = ctx.evals;
        ctxQry.airgroupValues = ctx.airgroupValues;
        ctxQry.airValues = ctx.airValues;
        ctxQry.publics = ctx.publics;
        ctxQry.proofValues = ctx.proofValues;
        ctxQry.challenges = ctx.challenges;
        ctxQry.starkInfo = starkInfo;

        const x = F.mul(F.shift, F.exp(F.w[nBits + extendBits], idx));
	
        ctxQry.xDivXSubXi = {};
        for(let i = 0; i < starkInfo.openingPoints.length; ++i) {
            const opening = Number(starkInfo.openingPoints[i]);

            let w = 1n;
            for(let j = 0; j < Math.abs(opening); ++j) {
                w = F.mul(w, F.w[nBits]);
            }
            if(opening < 0) {
                w = F.div(1n, w);
            }

            ctxQry.xDivXSubXi[i] = F.div(x, F.sub(x, F.mul(ctxQry.challenges[evalsStage][0], w)));
        }

        return module.exports.executeCode(F, ctxQry, verifierInfo.queryVerifier.code);
    }

    for(let i = 0; i < starkInfo.nStages; ++i) {
        if(logger) logger.debug("Verifying MH stage " + (i + 1));
        const stage = i + 1;
        for(let q = 0; q < nQueries; ++q) {
            const query = proof.queries.polQueries[q];
            let res = MH.verifyGroupProof(proof[`root${stage}`], query[i][1], ctx.friQueries[q], query[i][0]);
            if (!res) {
                if(logger) logger.warn(`Invalid root${stage}`);
                return false;
            }
        }
    }

    if(logger) logger.debug("Verifying MH stage Q");
    for(let i = 0; i < nQueries; ++i) {
        const query = proof.queries.polQueries[i];
        let res = MH.verifyGroupProof(proof[`root${qStage}`], query[starkInfo.nStages][1], ctx.friQueries[i], query[starkInfo.nStages][0]);
        if (!res) {
            if(logger) logger.warn(`Invalid rootQ`);
            return false;
        }
    }

    if(logger) logger.debug("Verifying MH const tree");
    for(let i = 0; i < nQueries; ++i) {
        const query = proof.queries.polQueries[i];
        let res = MH.verifyGroupProof(constRoot, query[starkInfo.nStages + 1][1], ctx.friQueries[i], query[starkInfo.nStages + 1][0]);
        if (!res) {
            if(logger) logger.warn(`Invalid constRoot`);
            return false;
        }
    }

    for(let i = 0; i < starkInfo.customCommits.length; ++i) {
        if(logger) logger.debug("Verifying MH custom commit " + starkInfo.customCommits[i].name);
        let root = [];
        for(let j = 0; j < starkInfo.customCommits[i].publicValues.length; ++j) {
            const publicId = starkInfo.customCommits[i].publicValues[j].idx;
            root.push(publics[publicId]);
        }
        for(let q = 0; q < nQueries; ++q) {
            const query = proof.queries.polQueries[q];
            let res = MH.verifyGroupProof(root, query[starkInfo.nStages + 2 + i][1], ctx.friQueries[q], query[starkInfo.nStages + 2 + i][0]);
            if (!res) {
                if(logger) logger.warn(`Invalid root_${starkInfo.customCommits[i].name}_0`);
                return false;
            }
        }
    }

    if(logger) logger.debug("Computing queries");
    let queryVals = [];
    for(let i = 0; i < nQueries; ++i) {
        queryVals[i] = computeQuery(proof.queries.polQueries[i], ctx.friQueries[i]);
    }

    const fri = new FRI( nQueries, steps, MH, logger );

    if(logger) logger.debug("Verifying queries");
    if(starkInfo.starkStruct.steps.length == 1) {
        if(!fri.verifyStepFRI(0, ctx.friQueries, queryVals, proof.fri[0])) return false;
    } else {
        if(!fri.verifyStepFRI(0, ctx.friQueries, queryVals, proof.fri[0].polQueries.map(p => p[0]))) return false;
    }
    
    if(!fri.verifyMH(ctx.friQueries, proof.fri)) return false;
    
    for (let si=1; si< starkInfo.starkStruct.steps.length; si++) {
        let nextVals = fri.computeNextStepFRI(si, ctx.challengesFRISteps,ctx.friQueries, proof.fri);
        
        if (si < starkInfo.starkStruct.steps.length - 1) {
            if(!fri.verifyStepFRI(si, ctx.friQueries, nextVals, proof.fri[si].polQueries.map(p => p[0]))) return false;
        } else {
            if(!fri.verifyStepFRI(si, ctx.friQueries, nextVals, proof.fri[si])) return false;
        }
    }

    if(!fri.verifyFinalPol(proof.fri[starkInfo.starkStruct.steps.length - 1])) return false;
    
    return true;
    
}

module.exports.executeCode = function executeCode(F, ctx, code, global) {
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
            case "cm": {
                let pol = ctx.starkInfo.cmPolsMap[r.id];
                return extractVal(ctx["cm" + pol.stage], pol.stagePos, r.dim);
            }
            case "custom": {
                let pol = ctx.starkInfo.customCommitsMap[r.commitId][r.id];
                return extractVal(ctx[`custom_${ctx.starkInfo.customCommits[r.commitId].name}_0`], pol.stagePos, r.dim);
            }
            case "tmp": return tmp[r.id];
            case "const": return ctx.consts[r.id];
            case "eval": return ctx.evals[r.id];
            case "number": return BigInt(r.value);
            case "public": return BigInt(ctx.publics[r.id]);
            case "proofvalue": return ctx.proofValues[r.id];
            case "challenge": return ctx.challenges[r.stage - 1][r.stageId];
            case "airgroupvalue": {
                return global ? ctx.airgroupValues[r.airgroupId][r.id] : ctx.airgroupValues[r.id];
            }
            case "airvalue": return ctx.airValues[r.id];
            case "xDivXSubXi": return ctx.xDivXSubXi[r.id];
            case "x": {
                let evalsStage = ctx.starkInfo.nStages + 1;
                return ctx.challenges[evalsStage][0];
            }
            case "Zi": {
                const boundary = ctx.starkInfo.boundaries[r.boundaryId];
                if(boundary.name === "everyRow") {
                    return ctx.Z;
                } else if (boundary.name === "firstRow") {
                    return ctx.Z_fr;
                } else if (boundary.name === "lastRow") {
                    return ctx.Z_lr;
                } else if (boundary.name === "everyFrame") {
                    const boundaryId = ctx.starkInfo.boundaries.filter(b => b.name === "everyFrame").findIndex(b => b.offsetMin === boundary.offsetMin && b.offsetMax === boundary.offsetMax);
                    return ctx[`Z_frame${boundaryId}`];
                } else {
                    throw new Error("Invalid boundary: " + r.boundary);
                }
            }
            default: throw new Error("Invalid reference type get: " + r.type);
        }
    }

    function extractVal(arr, pos, dim) {
        if (dim==1) {
            return arr[pos];
        } else if (dim==3) {
            return arr.slice(pos, pos+3);
        } else {
            throw new Error("Invalid dimension");
        }
    }

    function setRef(r, val) {
        switch (r.type) {
            case "tmp": tmp[r.id] = val; return;
            default: throw new Error("Invalid reference type set: " + r.type);
        }
    }

}

