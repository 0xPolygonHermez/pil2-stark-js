
const buildMerkleHashGL = require("../helpers/hash/merklehash/merklehash_p.js");
const buildMerkleHashBN128 = require("../helpers/hash/merklehash/merklehash_bn128_p.js");
const Transcript = require("../helpers/transcript/transcript");
const TranscriptBN128 = require("../helpers/transcript/transcript.bn128");
const F3g = require("../helpers/f3g.js");

const { buildZhInv, buildOneRowZerofierInv, buildFrameZerofierInv } = require("../helpers/polutils.js");
const buildPoseidonGL = require("../helpers/hash/poseidon/poseidon");
const buildPoseidonBN128 = require("circomlibjs").buildPoseidon;
const FRI = require("./fri.js");
const _ = require("json-bigint");
const { interpolate, ifft, fft } = require("../helpers/fft/fft_p.js");
const {BigBuffer} = require("pilcom");
const { callCalculateExps, getPolRef, getPol } = require("../prover/prover_helpers.js");
const { setSymbolCalculated } = require("../prover/symbols_helpers.js");
const { C } = require("../helpers/hash/poseidon/poseidon_constants_opt.js");

module.exports.initProverStark = async function initProverStark(pilInfo, expressionsInfo, constPols, constTree, options = {}) {
    const ctx = {};

    const logger = options.logger;

    ctx.prover = "stark";

    if (logger && !options.debug) logger.info("PIL-STARK PROVER STARTED");

    if (logger && options.debug) logger.info("PIL-STARK PROVER CHECK CONSTRAINTS");

    ctx.F = new F3g();

    ctx.trees = {};

    ctx.constTree = constTree;

    ctx.pilInfo = pilInfo;
    ctx.expressionsInfo = expressionsInfo;
    ctx.nBits = ctx.pilInfo.starkStruct.nBits;
    
    ctx.N = 1 << ctx.pilInfo.starkStruct.nBits;
    ctx.tmp = [];
    ctx.challenges = [];
    ctx.challengesFRISteps = [];

    ctx.calculatedSymbols = {};

    if(ctx.pilInfo.nPublics > 0) {
        ctx.calculatedSymbols.public = new Array(ctx.pilInfo.nPublics).fill(false);
    }

    if(ctx.pilInfo.nConstants > 0) {
        ctx.calculatedSymbols.const = new Array(ctx.pilInfo.nConstants).fill(false);
    }

    if(ctx.pilInfo.nSubAirValues > 0) {
        ctx.calculatedSymbols.subproofValue = new Array(ctx.pilInfo.nSubAirValues).fill(false);
    }

    const nChallenges = ctx.pilInfo.challengesMap.length;
    ctx.calculatedSymbols.challenge = new Array(nChallenges).fill(false);
    
    ctx.calculatedSymbols.cm = new Array(ctx.pilInfo.cmPolsMap.length).fill(false);
    
    ctx.publics = [];

    ctx.subAirValues = new Array(pilInfo.nSubAirValues).fill(0n) || [];

    ctx.challenges[0] = [];

    if(!options.debug) {
        ctx.nBitsExt = ctx.pilInfo.starkStruct.nBitsExt;
        ctx.extN = 1 << ctx.pilInfo.starkStruct.nBitsExt;
        ctx.extendBits = ctx.nBitsExt - ctx.nBits;
    }

    const qStage = ctx.pilInfo.nStages + 1;
    
    if (logger && !options.debug) {
        logger.debug("-----------------------------");
        logger.debug("  PIL-STARK PROVE SETTINGS");
        logger.debug(`  Blow up factor: ${ctx.extendBits}`);
        logger.debug(`  Number queries: ${ctx.pilInfo.starkStruct.nQueries}`);
        logger.debug(`  Number Stark steps: ${ctx.pilInfo.starkStruct.steps.length}`);
        logger.debug(`  VerificationType: ${ctx.pilInfo.starkStruct.verificationHashType}`);
        logger.debug(`  Hash Commits: ${ctx.pilInfo.starkStruct.hashCommits || false}`);
        logger.debug(`  Domain size: ${ctx.N} (2^${ctx.nBits})`);
        logger.debug(`  Domain size ext: ${ctx.extN} (2^${ctx.nBitsExt})`);
        logger.debug(`  Const  pols:   ${ctx.pilInfo.nConstants}`);
        logger.debug(`  Stage 1 pols:   ${ctx.pilInfo.cmPolsMap.filter(p => p.stage === `cm1`).length}`);
        for(let i = 0; i < ctx.pilInfo.nStages - 1; i++) {
            const stage = i + 2;
            logger.debug(`  Stage ${stage} pols:   ${ctx.pilInfo.cmPolsMap.filter(p => p.stage === `cm${stage}`).length}`);
        }
        logger.debug(`  Stage ${qStage} pols:   ${ctx.pilInfo.cmPolsMap.filter(p => p.stage === `cm${qStage}`).length}`);
        logger.debug(`  Temp exp pols: ${ctx.pilInfo.cmPolsMap.filter(p => p.stage === "tmpExp").length}`);
        logger.debug("-----------------------------");   
    }

    let verificationHashType;
    let splitLinearHash;
    if(!options.debug) {
        verificationHashType = ctx.pilInfo.starkStruct.verificationHashType;
        splitLinearHash = ctx.pilInfo.starkStruct.splitLinearHash;
    } else {
        verificationHashType = options.verificationHashType || "GL";
        splitLinearHash = options.splitLinearHash || false;
    }

    if (verificationHashType == "GL") {
        const poseidon = await buildPoseidonGL();
        ctx.MH = await buildMerkleHashGL(splitLinearHash);
        ctx.transcript = new Transcript(poseidon);
    } else if (verificationHashType == "BN128") {
        const poseidonBN128 = await buildPoseidonBN128();
        let transcriptArity = ctx.pilInfo.starkStruct.merkleTreeCustom ? ctx.pilInfo.starkStruct.merkleTreeArity : 16;
        ctx.MH = await buildMerkleHashBN128(ctx.pilInfo.starkStruct.merkleTreeArity, ctx.pilInfo.starkStruct.merkleTreeCustom);
        ctx.transcript = new TranscriptBN128(poseidonBN128, transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ verificationHashType);
    }

    ctx.const_n = new BigBuffer(ctx.pilInfo.nConstants*ctx.N);
    for(let i = 0; i < ctx.pilInfo.nStages; i++) {
        const stage = i + 1;
        ctx[`cm${stage}_n`] = new BigBuffer(ctx.pilInfo.mapSectionsN[`cm${stage}`]*ctx.N);
    }
    ctx.tmpExp_n = new BigBuffer(ctx.pilInfo.mapSectionsN.tmpExp*ctx.N);
    ctx.x_n = new BigBuffer(ctx.N);

    // Build x_n
    let xx = ctx.F.one;
    for (let i=0; i<ctx.N; i++) {
        ctx.x_n.setElement(i,xx);
        xx = ctx.F.mul(xx, ctx.F.w[ctx.nBits])
    }

    // Read const coefs
    constPols.writeToBigBuffer(ctx.const_n);

    for(let i = 0; i < ctx.pilInfo.nConstants; i++) {
       setSymbolCalculated(ctx, {op: "const", stage: 0, id: i}, options);
    }

    if(!options.debug) {
        ctx.const_ext = constTree.elements;
        for(let i = 0; i < ctx.pilInfo.nStages; i++) {
            const stage = i + 1;
            ctx[`cm${stage}_ext`] = new BigBuffer(ctx.pilInfo.mapSectionsN[`cm${stage}`]*ctx.extN);
        }
        ctx["cm" + qStage + "_ext"] = new BigBuffer(ctx.pilInfo.mapSectionsN["cm" + qStage]*ctx.extN);
        ctx.q_ext = new BigBuffer(ctx.pilInfo.qDim*ctx.extN);
        ctx.f_ext = new BigBuffer(3*ctx.extN);
        ctx.x_ext = new BigBuffer(ctx.extN);
        ctx.Zi_ext = new BigBuffer(ctx.pilInfo.boundaries.length*ctx.extN);

        ctx.xDivXSubXi_ext = new BigBuffer(3*ctx.extN*ctx.pilInfo.openingPoints.length);
        
        // Build x_ext
        let x_ext = ctx.F.shift;
        for (let i=0; i<ctx.extN; i++) {
            ctx.x_ext.setElement(i, x_ext);
            x_ext = ctx.F.mul(x_ext, ctx.F.w[ctx.nBitsExt]);
        }

        const ZhInv = new BigBuffer(ctx.extN);
        buildZhInv(ZhInv, 0, ctx.F, ctx.nBits, ctx.nBitsExt, true);    
        
        for(let i = 0; i < ctx.pilInfo.boundaries.length; i++) {
            const boundary = ctx.pilInfo.boundaries[i];
            if(boundary.name === "everyRow") {
                buildZhInv(ctx.Zi_ext, i*ctx.extN, ctx.F, ctx.nBits, ctx.nBitsExt, true);    
            } else if (boundary.name === "firstRow") {
                buildOneRowZerofierInv(ctx.Zi_ext, i*ctx.extN, ctx.F, ctx.nBits, ctx.nBitsExt, 0, true);
            } else if (boundary.name === "lastRow") {
                buildOneRowZerofierInv(ctx.Zi_ext, i*ctx.extN, ctx.F, ctx.nBits, ctx.nBitsExt, ctx.N - 1, true);
            } else if (boundary.name === "everyFrame") {
                buildFrameZerofierInv(ctx.Zi_ext, i*ctx.extN, ctx.F, ZhInv, ctx.nBits, ctx.nBitsExt, boundary, true);
            }
        }

        ctx.fri = new FRI( ctx.pilInfo.starkStruct, ctx.MH );
    }
    
    return ctx;
}

module.exports.computeQStark = async function computeQStark(ctx, options) {
    const logger = options.logger;
    
    if (logger) logger.debug("Compute Trace Quotient Polynomials");

    const qStage = ctx.pilInfo.nStages + 1;
    const qq1 = new BigBuffer(ctx.pilInfo.qDim*ctx.extN);
    const qq2 = new BigBuffer(ctx.pilInfo.qDim*ctx.pilInfo.qDeg*ctx.extN);
    
    await ifft(ctx.q_ext, ctx.pilInfo.qDim, ctx.nBitsExt, qq1);

    let curS = 1n;
    const shiftIn = ctx.F.exp(ctx.F.inv(ctx.F.shift), ctx.N);
    for (let p =0; p<ctx.pilInfo.qDeg; p++) {
        for (let i=0; i<ctx.N; i++) {
            for (let k=0; k<ctx.pilInfo.qDim; k++) {
                const indexqq2 = i*ctx.pilInfo.qDim*ctx.pilInfo.qDeg + ctx.pilInfo.qDim*p + k;
                const indexqq1 = p*ctx.N*ctx.pilInfo.qDim + i*ctx.pilInfo.qDim + k;
                qq2.setElement(indexqq2, ctx.F.mul(qq1.getElement(indexqq1), curS));
            }
        }
        curS = ctx.F.mul(curS, shiftIn);
    }

    await fft(qq2, ctx.pilInfo.qDim * ctx.pilInfo.qDeg, ctx.nBitsExt, ctx["cm" + qStage + "_ext"]);

    if (logger) logger.debug("··· Merkelizing Q polynomial tree");

    const nPolsQ = ctx.pilInfo.mapSectionsN["cm" + qStage] || 0;
    ctx.trees[qStage] = await ctx.MH.merkelize(ctx["cm" + qStage + "_ext"], nPolsQ, ctx.extN);
    const root = ctx.MH.root(ctx.trees[qStage]);
    if (options.logger && !options.debug) {
        if(ctx.pilInfo.starkStruct.verificationHashType === "GL") {
            options.logger.debug("··· Root stage " + qStage + ": " + ctx.F.toString(root[0]) + " " + ctx.F.toString(root[1]) + " " + ctx.F.toString(root[2]) + " " + ctx.F.toString(root[3]));
        } else {
            options.logger.debug("··· Root stage " + qStage + ": " + ctx.F.toString(root));
        }
    }

    return [root];
}

module.exports.computeEvalsStark = async function computeEvalsStark(ctx, options) {
    if (options.logger) options.logger.debug("Compute Evals");

    let evalsStage = ctx.pilInfo.nStages + 1;
    let xiChallenge = ctx.challenges[evalsStage][0];

    let LEv = [];
    for(let i = 0; i < ctx.pilInfo.openingPoints.length; i++) {
        const opening = Number(ctx.pilInfo.openingPoints[i]);
        LEv[i] = new Array(ctx.N);
        LEv[i][0] = 1n;
        let w = 1n;
        for(let j = 0; j < Math.abs(opening); ++j) {
            w = ctx.F.mul(w, ctx.F.w[ctx.nBits]);
        }
        if(opening < 0) w = ctx.F.div(1n, w);
        const xi = ctx.F.div(ctx.F.mul(xiChallenge, w), ctx.F.shift);
        for (let k=1; k<ctx.N; k++) {
            LEv[i][k] = ctx.F.mul(LEv[i][k-1], xi);
        }
        LEv[i] = ctx.F.ifft(LEv[i]);
    }

    ctx.evals = [];
    for (let i=0; i<ctx.pilInfo.evMap.length; i++) {
        const ev = ctx.pilInfo.evMap[i];
        let p;
        if (ev.type == "const") {
            p = {
                buffer: ctx.const_ext,
                deg: ctx.extN,
                offset: ev.id,
                size: ctx.pilInfo.nConstants,
                dim: 1
            };
        } else if (ev.type == "cm") {
            p = getPolRef(ctx, ev.id, "ext");
        } else {
            throw new Error("Invalid ev type: "+ ev.type);
        }
        let acc = 0n;
        for (let k=0; k<ctx.N; k++) {
            let v;
            if (p.dim==1) {
                v = p.buffer.getElement((k<<ctx.extendBits)*p.size + p.offset);
            } else {
                v = [
                    p.buffer.getElement((k<<ctx.extendBits)*p.size + p.offset),
                    p.buffer.getElement((k<<ctx.extendBits)*p.size + p.offset+1),
                    p.buffer.getElement((k<<ctx.extendBits)*p.size + p.offset+2)
                ];
            }
            acc = ctx.F.add(acc, ctx.F.mul(v, LEv[ctx.pilInfo.openingPoints.findIndex(p => p === ev.prime)][k]));
        }
        ctx.evals[i] = acc;
    }

    if(ctx.pilInfo.starkStruct.hashCommits) {
        const evalsHash = await module.exports.calculateHashStark(ctx, ctx.evals);
        return [evalsHash];
    } else {
        return ctx.evals;
    }
}

module.exports.computeFRIStark = async function computeFRIStark(ctx, options) {
    const logger = options.logger;

    if (logger) logger.debug("Compute FRI");

    const stage = ctx.pilInfo.nStages + 2;

    ctx.friPol = [];
    ctx.friProof = [];
    ctx.friTrees = [];

    const s0_trees = [];
    for(let i = 0; i < ctx.pilInfo.nStages + 1; ++i) s0_trees.push(ctx.trees[i + 1]);
    s0_trees.push(ctx.constTree);
    ctx.friTrees[0] = s0_trees;
    ctx.friProof[0] = {};

    for(let i = 0; i < ctx.pilInfo.openingPoints.length; i++) {
        const opening = ctx.pilInfo.openingPoints[i];

        let w = 1n;
        for(let j = 0; j < Math.abs(opening); ++j) {
            w = ctx.F.mul(w, ctx.F.w[ctx.nBits]);
        }
        if(opening < 0) w = ctx.F.div(1n, w);

        let evalsStage = ctx.pilInfo.nStages + 1;
        let xiChallenge = ctx.challenges[evalsStage][0];

        let xi = ctx.F.mul(xiChallenge, w);

        let den = new Array(ctx.extN);
        let x = ctx.F.shift;

        for (let k=0; k < ctx.extN; k++) {
            den[k] = ctx.F.sub(x, xi);
            x = ctx.F.mul(x, ctx.F.w[ctx.nBitsExt])
        }
        den = ctx.F.batchInverse(den);
        x = ctx.F.shift;
        for (let k=0; k < ctx.extN; k++) {
            const v = ctx.F.mul(den[k], x);
            ctx.xDivXSubXi_ext.setElement(3*(k*ctx.pilInfo.openingPoints.length + i), v[0]);
            ctx.xDivXSubXi_ext.setElement(3*(k*ctx.pilInfo.openingPoints.length + i) + 1, v[1]);
            ctx.xDivXSubXi_ext.setElement(3*(k*ctx.pilInfo.openingPoints.length + i) + 2,v[2]);
    
            x = ctx.F.mul(x, ctx.F.w[ctx.nBitsExt])
        }
    }

    await callCalculateExps(stage, ctx.expressionsInfo.stagesCode[stage - 1], "ext", ctx, options.parallelExec, options.useThreads, false);

    ctx.friPol[0] = new Array(ctx.extN);
    for (let i=0; i<ctx.extN; i++) {
        ctx.friPol[0][i] = [
            ctx.f_ext.getElement(i*3),
            ctx.f_ext.getElement(i*3 + 1),
            ctx.f_ext.getElement(i*3 + 2),
        ];
    }
}

module.exports.computeFRIFolding = async function computeFRIFolding(step, ctx, challenge, options) {
    let stepProof = await ctx.fri.fold(step, ctx.friPol[step], challenge);

    ctx.friPol[step+1] = stepProof.pol;
    ctx.friProof[step+1] = stepProof.proof;
    if(step < ctx.pilInfo.starkStruct.steps.length - 1) {
        ctx.friTrees[step+1] = stepProof.tree;
    }

    if (step+1 < ctx.pilInfo.starkStruct.steps.length) {
        return [ctx.friProof[step+1].root];
    } else {
        if(ctx.pilInfo.starkStruct.hashCommits) {
            const lastPolHash = await module.exports.calculateHashStark(ctx, ctx.friPol[step+1]);
            return [lastPolHash];
        } else {
            return ctx.friPol[step+1];
        }
    }
}

module.exports.computeFRIQueries = function computeFRIQueries(ctx, friQueries) {
    ctx.fri.proofQueries(ctx.friProof, ctx.friTrees, friQueries);
}

module.exports.genProofStark = async function genProof(ctx, options) {
    const logger = options.logger;

    if(logger) logger.debug("Generating proof");
    
    const proof = {
        evals: ctx.evals,
        subAirValues: ctx.subAirValues,
        fri: ctx.friProof
    };

    for(let i = 0; i < ctx.pilInfo.nStages + 1; ++i) {
        const stage = i + 1;
        proof["root" + stage] = ctx.MH.root(ctx.trees[stage]);
    }

    const publics = ctx.publics;

    const res = {proof, publics};

    res.challenges = ctx.challenges;
    res.challengesFRISteps = ctx.challengesFRISteps;

    return res;
}

module.exports.extendAndMerkelize = async function  extendAndMerkelize(stage, ctx, options) {
    const logger = options.logger;

    const buffFrom = ctx["cm" + stage + "_n"];
    const buffTo = ctx["cm" + stage + "_ext"];

    const nPols = ctx.pilInfo.mapSectionsN["cm" + stage] || 0;
    
    if (logger) logger.debug("··· Interpolating " + stage);
    await interpolate(buffFrom, nPols, ctx.nBits, buffTo, ctx.nBitsExt);
    
    if (logger) logger.debug("··· Merkelizing Stage " + stage);
    ctx.trees[stage] = await ctx.MH.merkelize(buffTo, nPols, ctx.extN);

    const root = ctx.MH.root(ctx.trees[stage]);
    if (options.logger && !options.debug) {
        if(ctx.pilInfo.starkStruct.verificationHashType === "GL") {
            options.logger.debug("··· Root stage " + stage + ": " + ctx.F.toString(root[0]) + " " + ctx.F.toString(root[1]) + " " + ctx.F.toString(root[2]) + " " + ctx.F.toString(root[3]));
        } else {
            options.logger.debug("··· Root stage " + stage + ": " + ctx.F.toString(root));
        }
    }

    return [root];
}

module.exports.setChallengesStark = function setChallengesStark(stage, ctx, transcript, challenge, options) {
    let nChallengesStage;

    let qStage = ctx.pilInfo.nStages + 1;

    nChallengesStage = ctx.pilInfo.challengesMap.filter(c => c.stageNum === stage).length;

    ctx.challenges[stage - 1] = [];
    for (let i=0; i<nChallengesStage; i++) {
        if(i > 0 || !challenge) {
            ctx.challenges[stage - 1][i] = transcript.getField();
        } else {
            ctx.challenges[stage - 1][0] = challenge;
        }
        if (options.logger && !options.debug) options.logger.debug("··· challenges[" + (stage - 1) + "][" + i + "]: " + ctx.F.toString(ctx.challenges[stage - 1][i]));
            }

    if(stage < qStage) {
        for(let i = 0; i < ctx.pilInfo.challengesMap.length; i++) {
            if(ctx.pilInfo.challengesMap[i].stageNum === stage) {
                setSymbolCalculated(ctx, { op: "challenge", stage, id: i}, options);
            }
        }
    }
    
    return;
}

module.exports.calculateHashStark = async function calculateHashStark(ctx, inputs) {
    const verificationHashType = ctx.pilInfo.starkStruct.verificationHashType;
    let transcript;
    if (verificationHashType == "GL") {
        const poseidon = await buildPoseidonGL();
        transcript = new Transcript(poseidon);
    } else if (verificationHashType == "BN128") {
        let transcriptArity = ctx.pilInfo.starkStruct.merkleTreeCustom ? ctx.pilInfo.starkStruct.merkleTreeArity : 16;
        const poseidonBN128 = await buildPoseidonBN128();
        transcript = new TranscriptBN128(poseidonBN128, transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ verificationHashType);
    }

    for (let i=0; i<inputs.length; i++) {
        transcript.put(inputs[i]);
    }

    const hash = transcript.getState();    
    return hash;
}

module.exports.addTranscriptStark = function addTranscriptStark(transcript, inputs) {
    for(let i = 0; i < inputs.length; i++) {
        transcript.put(inputs[i]);
    }
}

module.exports.getChallengeStark = function getChallengeStark(transcript) {
    return transcript.getField();
}

module.exports.getPermutationsStark = async function getPermutationsStark(ctx, challenge) {
    const verificationHashType = ctx.pilInfo.starkStruct.verificationHashType;
    let transcript;
    if (verificationHashType == "GL") {
        const poseidon = await buildPoseidonGL();
        transcript = new Transcript(poseidon);
    } else if (verificationHashType == "BN128") {
        let transcriptArity = ctx.pilInfo.starkStruct.merkleTreeCustom ? ctx.pilInfo.starkStruct.merkleTreeArity : 16;
        const poseidonBN128 = await buildPoseidonBN128();
        transcript = new TranscriptBN128(poseidonBN128, transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ verificationHashType);
    }

    transcript.put(challenge);

    const friQueries = transcript.getPermutations(ctx.pilInfo.starkStruct.nQueries, ctx.pilInfo.starkStruct.steps[0].nBits, ctx.pilInfo.maxExtendedBits);
    
    return friQueries;
}

module.exports.printPolRoot = async function printPolRoot(ctx, polId, options) {
    let MH = await buildMerkleHashGL(false);

    const cmPol = ctx.pilInfo.cmPolsMap[polId];
    let p = getPolRef(ctx, polId, "n");
    let pol = getPol(ctx, polId, "n");

    const tree = await MH.merkelize(pol.flat(), p.dim, ctx.N);
    const rootN = MH.root(tree);
    options.logger.debug("··· " + cmPol.name + " " + ": " + ctx.F.toString(rootN[0]) + " " + ctx.F.toString(rootN[1]) + " " + ctx.F.toString(rootN[2]) + " " + ctx.F.toString(rootN[3]));  
    options.logger.debug('---------------------------');
    
}