const Transcript = require("../helpers/transcript/transcript");
const TranscriptBN128 = require("../helpers/transcript/transcript.bn128");
const FRI = require("./fri.js");
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const { assert } = require("chai");
const buildPoseidonGL = require("../helpers/hash/poseidon/poseidon");
const buildPoseidonBN128 = require("circomlibjs").buildPoseidon;

module.exports = async function starkVerify(proof, publics, constRoot, starkInfo, options = {}) {
    const logger = options.logger;

    const starkStruct = starkInfo.starkStruct;

    const poseidon = await buildPoseidonGL();

    let MH;
    let transcript;
    if (starkStruct.verificationHashType == "GL") {
        const poseidonGL = await buildPoseidonGL();
        MH = await buildMerkleHashGL(starkStruct.splitLinearHash);
        transcript = new Transcript(poseidonGL);
    } else if (starkStruct.verificationHashType == "BN128") {
        const poseidonBN128 = await buildPoseidonBN128();
        let arity = options.arity || 16;
        let custom = options.custom || false; 
        let transcriptArity = custom ? arity : 16;   
        MH = await buildMerkleHashBN128(arity, custom);
        transcript = new TranscriptBN128(poseidonBN128, transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ starkStruct.verificationHashType);
    }

    const nBits = starkStruct.nBits;
    const N = 1 << nBits;
    const extendBits = starkStruct.nBitsExt - starkStruct.nBits;

    assert(nBits+extendBits == starkStruct.steps[0].nBits, "First step must be just one");

    if (logger) {
        logger.debug("-----------------------------");
        logger.debug("  PIL-STARK VERIFY SETTINGS");
        logger.debug(`  Blow up factor: ${extendBits}`);
        logger.debug(`  Number queries: ${starkStruct.nQueries}`);
        logger.debug(`  Number Stark steps: ${starkStruct.steps.length}`);
        logger.debug(`  VerificationType: ${starkStruct.verificationHashType}`);
        logger.debug(`  Domain size: ${N} (2^${nBits})`);
        logger.debug(`  Const  pols:   ${starkInfo.nConstants}`);
        logger.debug(`  Stage 1 pols:   ${starkInfo.cmPolsMap.filter(p => p.stage == "cm1").length}`);
        for(let i = 0; i < starkInfo.nLibStages; i++) {
            const stage = i + 2;
            logger.debug(`  Stage ${stage} pols:   ${starkInfo.cmPolsMap.filter(p => p.stage == "cm" + stage).length}`);
        }
        logger.debug(`  Stage Q pols:   ${starkInfo.cmPolsMap.filter(p => p.stage == "cmQ").length}`);
        logger.debug("-----------------------------");
    }

    const F = poseidon.F;

    ctx = {
        challenges: [],
        evals: proof.evals,
        publics: publics,
        starkInfo: starkInfo,
    };

    for (let i=0; i<publics.length; i++) {
        transcript.put(publics[i]);
    }

    transcript.put(proof.root1);

    for(let i=0; i < starkInfo.nLibStages; i++) {
        const stage = i + 2;
        const challengesStage = starkInfo.challengesMap.filter(c => c.stage == stage);
        for(let j = 0; j < challengesStage.length; ++j) {
            const index = challengesStage[j].globalId;
            ctx.challenges[index] = transcript.getField();
            if (logger) logger.debug("··· challenges[" + index + "]: " + F.toString(ctx.challenges[index]));
        }
        transcript.put(proof["root" + stage]);
    }
    
    let qChallengeId = starkInfo.challengesMap.findIndex(c => c.stage === "Q" && c.stageId === 0);
    ctx.challenges[qChallengeId] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + qChallengeId + "]: " + F.toString(ctx.challenges[qChallengeId]));
    transcript.put(proof.rootQ);


    let xiChallengeId = starkInfo.challengesMap.findIndex(c => c.stage === "evals" && c.stageId === 0);
    ctx.challenges[xiChallengeId] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + xiChallengeId + "]: " + F.toString(ctx.challenges[xiChallengeId]));
    for (let i=0; i<ctx.evals.length; i++) {
        transcript.put(ctx.evals[i]);
    }

    let vf1ChallengeId = starkInfo.challengesMap.findIndex(c => c.stage === "fri" && c.stageId === 0);
    let vf2ChallengeId = starkInfo.challengesMap.findIndex(c => c.stage === "fri" && c.stageId === 1);
    ctx.challenges[vf1ChallengeId] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + vf1ChallengeId + "]: " + F.toString(ctx.challenges[vf1ChallengeId]));

    ctx.challenges[vf2ChallengeId] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + vf2ChallengeId + "]: " + F.toString(ctx.challenges[vf2ChallengeId]));

    if (logger) logger.debug("Verifying evaluations");

    const xi = ctx.challenges[xiChallengeId];

    const xN = F.exp(xi, N);
    ctx.Z = F.inv(F.sub(xN, 1n));
    
    if(starkInfo.boundaries.includes("firstRow")) {
        ctx.Z_fr = F.inv(F.sub(xi, 1n));
    }

    if(starkInfo.boundaries.includes("lastRow")) {
        let root = F.one;
        for(let i = 0; i < N - 1; ++i) {
            root = F.mul(root, F.w[nBits]);
        }
        ctx.Z_lr = F.inv(F.sub(xi, root));
    }

    if(starkInfo.boundaries.includes("everyFrame")) {
        for(let i = 0; i < starkInfo.constraintFrames.length; ++i) {
            ctx["Z_frame" + i] = ctx.Z;
            const frame = starkInfo.constraintFrames[i];
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

    const res=executeCode(F, ctx, starkInfo.code.qVerifier.code);

    let xAcc = 1n;
    let q = 0n;
    for (let i=0; i<starkInfo.qDeg; i++) {
        const evId = starkInfo.evMap.findIndex(e => e.type === "cm" && e.id === starkInfo.qs[i]);
        q = F.add(q, F.mul(xAcc, ctx.evals[evId]));
        xAcc = F.mul(xAcc, xN);
    }

    if (!F.eq(res, q)) {
        if(logger) logger.warn("Invalid evaluations");
        return false;
    }

    const fri = new FRI( starkStruct, MH );

    if(logger) logger.debug("Verifying queries");

    const checkQuery = (query, idx) => {
        if(logger) logger.debug("Verifying query: " + idx);

        let res = MH.verifyGroupProof(constRoot, query[0][1], idx, query[0][0]);
        if (!res) {
            if(logger) logger.warn(`Invalid constRoot`);
            return false;
        }

        res = MH.verifyGroupProof(proof.root1, query[1][1], idx, query[1][0]);
        if (!res) {
            if(logger) logger.warn(`Invalid root1`);
            return false;
        }
    
        for(let i = 0; i < starkInfo.nLibStages; ++i) {
            const stage = i + 2;
            let res = MH.verifyGroupProof(proof[`root${stage}`], query[stage][1], idx, query[stage][0]);
            if (!res) {
                if(logger) logger.warn(`Invalid root${stage}`);
                return false;
            }
        }
        
        res = MH.verifyGroupProof(proof.rootQ, query[starkInfo.nLibStages + 2][1], idx, query[starkInfo.nLibStages + 2][0]);
        if (!res) {
            if(logger) logger.warn(`Invalid rootQ`);
            return false;
        }
        
        const ctxQry = {};
        ctxQry.consts = query[0][0];
        ctxQry.tree1 = query[1][0];
        for(let i = 0; i < starkInfo.nLibStages; ++i) {
            const stage = i + 2;
            ctxQry[`tree${stage}`] = query[i + 2][0];
        }
        ctxQry.treeQ = query[starkInfo.nLibStages + 2][0];
        ctxQry.evals = ctx.evals;
        ctxQry.publics = ctx.publics;
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

            ctxQry.xDivXSubXi[i] = F.div(x, F.sub(x, F.mul(ctxQry.challenges[xiChallengeId], w)));
        }

        const vals = [executeCode(F, ctxQry, starkInfo.code.queryVerifier.code)];

        return vals;
    }

    return fri.verify(transcript, proof.fri, checkQuery);

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

        if (r.type.startsWith("tree")) {
            return extractVal(ctx[r.type], r.treePos, r.dim);
        }
        
        switch (r.type) {
            case "tmp": return tmp[r.id];
            case "const": return ctx.consts[r.id];
            case "eval": return ctx.evals[r.id];
            case "number": return BigInt(r.value);
            case "public": return BigInt(ctx.publics[r.id]);
            case "challenge": return ctx.challenges[r.id];
            case "xDivXSubXi": return ctx.xDivXSubXi[r.id];
            case "x": return ctx.challenges[ctx.starkInfo.challengesMap.findIndex(c => c.stage === "evals" && c.stageId === 0)];
            case "Zi": {
                if(r.boundary === "everyRow") {
                    return ctx.Z;
                } else if (r.boundary === "firstRow") {
                    return ctx.Z_fr;
                } else if (r.boundary === "lastRow") {
                    return ctx.Z_lr;
                } else if (r.boundary === "everyFrame") {
                    return ctx[`Z_frame${r.frameId}`];
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

