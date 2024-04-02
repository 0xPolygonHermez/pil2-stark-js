const { BigBuffer, utils } = require("ffjavascript");
const { Polynomial, Keccak256Transcript, commit, open } = require("shplonkjs");

const { ifft, fft } = require("../../helpers/fft/fft_p.bn128");
const { BigBufferHandler } = require("../../prover/prover_helpers");
const { PILFFLONK_PROTOCOL_ID } = require("../zkey/zkey_constants");

const { stringifyBigInts } = utils;

module.exports.initProverFflonk = async function initProverFflonk(pilInfo, expressionsInfo, zkey, options) {

    const logger = options.logger;

    const ctx = {};

    ctx.prover = "fflonk";

    if (logger && !options.debug) logger.info("PIL-FFLONK PROVER STARTED");

    if (logger && options.debug) logger.info("PIL-FFLONK PROVER CHECK CONSTRAINTS");

    if (zkey.protocolId !== PILFFLONK_PROTOCOL_ID) {
        throw new Error("zkey file is not fflonk");
    }

    ctx.pilInfo = pilInfo;
    ctx.expressionsInfo = expressionsInfo;
    
    ctx.zkey = zkey;
    ctx.curve = ctx.zkey.curve;
    ctx.F = ctx.curve.Fr;
    
    ctx.extendBitsQ = Math.ceil(Math.log2(ctx.pilInfo.qDeg + 1));

    ctx.nBits = ctx.zkey.power;
    ctx.nBitsCoefs = ctx.zkey.power + ctx.pilInfo.nBitsZK;
    ctx.nBitsExt = ctx.zkey.power + ctx.extendBitsQ + ctx.pilInfo.nBitsZK;

    ctx.extendBits = (ctx.nBitsExt - ctx.nBits);

    ctx.N = 1 << ctx.nBits;
    ctx.NCoefs = 1 << ctx.nBitsCoefs;
    ctx.extN = (1 << ctx.nBitsExt);

    ctx.publics = [];

    ctx.challenges = [];

    ctx.calculatedSymbols = [];

    ctx.committedPols = {};
    ctx.nonCommittedPols = [];

    let blindCoefs =  ctx.pilInfo.maxPolsOpenings * (ctx.pilInfo.qDeg + 1);
    ctx.domainSizeQ = ctx.pilInfo.qDeg * ctx.N + blindCoefs;
    ctx.nQ = ctx.zkey.maxQDegree ? Math.ceil((ctx.domainSizeQ - blindCoefs) / (ctx.zkey.maxQDegree * ctx.N)) : 1;

    if (logger && !options.debug) {
        logger.debug("-----------------------------");
        logger.debug("  PIL-FFLONK PROVE SETTINGS");
        logger.debug(`  Curve:         ${ctx.curve.name}`);
        logger.debug(`  Domain size:   ${ctx.N} (2^${ctx.zkey.power})`);
        logger.debug(`  Domaize size coefs: ${ctx.NCoefs} (2^${ctx.nBitsCoefs})`);
        logger.debug(`  Domain size ext: ${ctx.extN} (2^${ctx.nBitsExt})`);
        logger.debug(`  ExtendBits: ${ctx.extendBits}`);
        logger.debug(`  Const  pols:   ${ctx.pilInfo.nConstants}`);
        logger.debug(`  Stage 1 pols:   ${ctx.pilInfo.cmPolsMap.filter(p => p.stage == "cm1").length}`);
        for(let i = 0; i < ctx.pilInfo.nStages - 1; i++) {
            const stage = i + 2;
            logger.debug(`  Stage ${stage} pols:   ${ctx.pilInfo.cmPolsMap.filter(p => p.stage == "cm" + stage).length}`);
        }
        logger.debug(`  Stage Q pols:   ${ctx.nQ}`);
        logger.debug(`  Temp exp pols: ${ctx.pilInfo.cmPolsMap.filter(p => p.stage == "tmpExp").length}`);
        logger.debug("-----------------------------");
    }

    // Reserve big buffers for the polynomial evaluations
    ctx.const_n = new BigBuffer(ctx.pilInfo.nConstants * ctx.N * ctx.F.n8); // Constant polynomials
    ctx.cm1_n = new BigBuffer(ctx.pilInfo.mapSectionsN.cm1 * ctx.N * ctx.F.n8);
    for(let i = 0; i < ctx.pilInfo.nStages - 1; i++) {
        const stage = i + 2;
        ctx[`cm${stage}_n`] = new BigBuffer(ctx.pilInfo.mapSectionsN[`cm${stage}`] * ctx.N * ctx.F.n8);
    }    
    ctx.tmpExp_n = new BigBuffer(ctx.pilInfo.mapSectionsN.tmpExp * ctx.N * ctx.F.n8); // Expression polynomials
    ctx.x_n = new BigBuffer(ctx.N * ctx.F.n8); // Omegas de field extension

    // Reserve big buffers for the polynomial coefficients
    ctx.const_coefs = new BigBuffer(ctx.pilInfo.nConstants * ctx.N * ctx.F.n8); // Constant polynomials
    ctx.cm1_coefs = new BigBuffer(ctx.pilInfo.mapSectionsN.cm1 * ctx.NCoefs * ctx.F.n8);
    for(let i = 0; i < ctx.pilInfo.nStages - 1; i++) {
        const stage = i + 2;
        ctx[`cm${stage}_coefs`] = new BigBuffer(ctx.pilInfo.mapSectionsN[`cm${stage}`] * ctx.NCoefs * ctx.F.n8);
    }  

    ctx.const_n.set(ctx.zkey.constPolsEvals);
    ctx.const_coefs.set(ctx.zkey.constPolsCoefs);

    ctx.x_n.set(ctx.zkey.x_n);

    if(!options.debug) {
        // Reserve big buffers for the polynomial evaluations in the extended
        ctx.const_ext = new BigBuffer(ctx.pilInfo.nConstants * ctx.extN * ctx.F.n8);
        ctx.cm1_ext = new BigBuffer(ctx.pilInfo.mapSectionsN.cm1 * ctx.extN * ctx.F.n8);
        for(let i = 0; i < ctx.pilInfo.nStages - 1; i++) {
            const stage = i + 2;
            ctx[`cm${stage}_ext`] = new BigBuffer(ctx.pilInfo.mapSectionsN[`cm${stage}`] * ctx.extN * ctx.F.n8);
        }
        ctx.q_ext = new BigBuffer(ctx.extN * ctx.F.n8);
        ctx.x_ext = new BigBuffer(ctx.extN * ctx.F.n8); // Omegas a l'extès

        
        // Read const_ext
        ctx.const_ext.set(ctx.zkey.constPolsEvalsExt);

        // Read  x_ext
        ctx.x_ext.set(ctx.zkey.x_ext);
    }
    
    ctx.transcript = new Keccak256Transcript(ctx.curve);

    // Add constant composed polynomials
    if (ctx.pilInfo.nConstants > 0) {
        for (let i = 0; i < ctx.pilInfo.nConstants; i++) {
            const coefs = new BigBuffer(ctx.N * ctx.F.n8);
            for (let j = 0; j < ctx.N; j++) {
                coefs.set(ctx.const_coefs.slice((i + j * ctx.pilInfo.nConstants) * ctx.F.n8, (i + j * ctx.pilInfo.nConstants + 1) * ctx.F.n8), j * ctx.F.n8);
            }
            ctx[ctx.zkey.polsNamesStage[0][i]] = new Polynomial(coefs, ctx.curve, logger);
        }
        
        const cnstCommitPols = Object.keys(ctx.zkey).filter(k => k.match(/^f\d/));
        for (let i = 0; i < cnstCommitPols.length; ++i) {
            const commit = ctx.zkey[cnstCommitPols[i]].commit;
            const pol = new Polynomial(ctx.zkey[cnstCommitPols[i]].pol, ctx.curve, logger);
            console.log(cnstCommitPols[i], ctx.curve.G1.toString(commit));
            ctx.committedPols[`${cnstCommitPols[i]}_0`] = { commit: commit, pol: pol };
        }
    }

    return ctx;
}

module.exports.computeQFflonk = async function computeQ(ctx, options) {
    const logger = options.logger;

    if (logger) logger.debug("Compute Trace Quotient Polynomials");

    ctx["Q"] = await Polynomial.fromEvaluations(ctx.q_ext, ctx.curve, logger);
    ctx["Q"].divZh(ctx.N, 1 << ctx.extendBits);

    if(ctx.nQ > 1) {
        let rand1 = ctx.F.random();
        let rand2 = ctx.F.random();
        for(let i = 0; i < ctx.nQ; ++i) {
            const st = (i * ctx.zkey.maxQDegree * ctx.N) * ctx.F.n8;
            const end = (i == ctx.nQ - 1 ? ctx.domainSizeQ : (i + 1) * ctx.zkey.maxQDegree * ctx.N) * ctx.F.n8;

            let len = end - st;
            let extLen = i == ctx.nQ - 1 ? len : len + 2 * ctx.F.n8;
            let coefs = new BigBuffer(extLen);
            
            coefs.set(ctx["Q"].coef.slice(st, end));

            // Blind Qi polynomials
            if (i > 0) {
                coefs.set(ctx.F.sub(coefs.slice(0, ctx.F.n8), rand1), 0);
                coefs.set(ctx.F.sub(coefs.slice(ctx.F.n8, 2*ctx.F.n8), rand2), ctx.F.n8);
            }

            if (i < ctx.nQ - 1) {
                rand1 = ctx.F.random();
                rand2 = ctx.F.random();
                coefs.set(rand1, len);
                coefs.set(rand2, len + ctx.F.n8);
            }
            
            ctx[`Q${i}`] = new Polynomial(coefs, ctx.curve, logger);

        } 
    } else {
        ctx.nonCommittedPols.push("Q");
    }

    const qStage = ctx.pilInfo.nStages + 1;

    let commitsStageQ = await commit(qStage, ctx.zkey, ctx, ctx.zkey.pTau, ctx.curve, { multiExp: true, logger });
    commitsStageQ.forEach((com) => ctx.committedPols[`${com.index}`] = { commit: com.commit, pol: com.pol });

    commitsStageQ.forEach((com) => console.log(com.index, ctx.curve.G1.toString(com.commit)));

    let commitsTranscript = [];
    if(qStage > 1) commitsTranscript.push({value:ctx.challenges[qStage - 1][ctx.challenges[qStage - 1].length - 1]});

    const stageCommits = [];
    commitsStageQ.forEach((com) => stageCommits.push({value: com.commit, commit: true}));

    if(ctx.pilInfo.hashCommits) {
        const hash = await module.exports.calculateHashFflonk(ctx, stageCommits);
        commitsTranscript.push({ value: hash });
    } else {
        commitsTranscript.push(...stageCommits);
    }

    return commitsTranscript;
}

module.exports.computeOpeningsFflonk = async function computeOpenings(ctx,challenge, logger) {
    if (logger) logger.debug("Open Polynomials");

    const challengeXiSeed = challenge;
    if (logger) logger.debug("··· challenges.xiSeed: " + ctx.F.toString(challengeXiSeed));

    const [cmts, evaluations] = await open(ctx.zkey, ctx.zkey.pTau, ctx, ctx.committedPols, ctx.curve, { logger, xiSeed: challengeXiSeed, nonCommittedPols: ctx.nonCommittedPols});

    if(logger) logger.debug("··· Batched Inverse shplonk: " + ctx.F.toString(evaluations["inv"]));
    // Compute challengeXiSeed 
    let challengeXi = ctx.F.exp(challengeXiSeed, ctx.zkey.powerW);

    const xN = ctx.F.exp(challengeXi, ctx.N);
    const Z = ctx.F.sub(xN, ctx.F.one);

    if(logger) logger.debug("··· Z: " + ctx.F.toString(Z));

    evaluations.invZh = ctx.F.inv(Z);

    if(logger) logger.debug("··· invZh: " + ctx.F.toString(evaluations.invZh));

    ctx.evaluations = evaluations;
    ctx.cmts = cmts;
}

module.exports.genProofFflonk = async function genProof(ctx, logger) {
    if(logger) logger.debug("Generating proof");

    let proof = { polynomials: {}, evaluations: {} };
    proof.protocol = "pilfflonk";
    proof.curve = ctx.curve.name;
    Object.keys(ctx.cmts).forEach(key => {
        proof.polynomials[key] = ctx.curve.G1.toObject(ctx.cmts[key]);
    });

    Object.keys(ctx.evaluations).forEach(key => {
        if (key !== "Q") proof.evaluations[key] = ctx.F.toObject(ctx.evaluations[key]);
    });

    proof = stringifyBigInts(proof);

    // Prepare public inputs
    let publics = stringifyBigInts(ctx.publics.map(p => ctx.F.toObject(p)));

    return {proof, publics};
}

module.exports.setChallengesFflonk = function setChallengesFflonk(stage, ctx, transcript, challenge, options) {
    let qStage = ctx.pilInfo.nStages + 1;

    let nChallengesStage = ctx.pilInfo.challengesMap.filter(c => c.stageNum === stage).length;
 
    ctx.challenges[stage - 1] = [];
    for (let i=0; i<nChallengesStage; i++) {
        if(i > 0) {
            transcript.addScalar(ctx.challenges[stage - 1][i - 1]);
            ctx.challenges[stage - 1][i] = transcript.getChallenge();
        } else {
            ctx.challenges[stage - 1][i] = challenge;
        }
        transcript.reset();
        if (options.logger && !options.debug) options.logger.debug("··· challenges[" + (stage - 1) + "][" + i + "]: " + ctx.F.toString(ctx.challenges[stage - 1][i]));
    }
    return;
}

module.exports.addTranscriptFflonk = function addTranscriptFflonk(transcript, inputs) {
    for(let i = 0; i < inputs.length; i++) {
        if(inputs[i].commit) {
            transcript.addPolCommitment(inputs[i].value);
        } else {
            transcript.addScalar(inputs[i].value);
        }
    } 
}

module.exports.getChallengeFflonk = function getChallengeFflonk(transcript) {
    const nextChallenge = transcript.getChallenge();
    transcript.reset();

    return nextChallenge;
}

module.exports.calculateHashFflonk = async function calculateHashFflonk(ctx, inputs) {
    let transcript = new Keccak256Transcript(ctx.curve);

    for (let i=0; i<inputs.length; i++) {
        if(inputs[i].commit) {
            transcript.addPolCommitment(inputs[i].value);
        } else {
            transcript.addScalar(inputs[i].value);
        }
    }

    return {value: transcript.getChallenge()};
}

module.exports.extendAndCommit = async function extendAndCommit(stage, ctx, options) {
    const logger = options.logger;
    
    const buffFrom = ctx["cm" + stage + "_n"];
    const buffCoefs = ctx["cm" + stage + "_coefs"];
    const buffTo = ctx["cm" + stage + "_ext"];

    const nPols = ctx.pilInfo.mapSectionsN[`cm${stage}`];

    await ifft(buffFrom, nPols, ctx.nBits, buffCoefs, ctx.F);

    for (let i = 0; i < nPols; i++) {
        let nOpenings = findNumberOpenings(ctx.zkey.f, ctx.zkey.polsNamesStage[stage][i], stage);
        for(let j = 0; j < nOpenings; ++j) {
            const b = ctx.F.random();
            let offset1 = (j * nPols + i) * ctx.F.n8; 
            let offsetN = ((j + ctx.N) * nPols + i) * ctx.F.n8; 
            buffCoefs.set(ctx.F.add(buffCoefs.slice(offset1,offset1 + ctx.F.n8), ctx.F.neg(b)), offset1);
            buffCoefs.set(ctx.F.add(buffCoefs.slice(offsetN, offsetN + ctx.F.n8), b), offsetN);
        }
    }

    // Store coefs to context
    for (let i = 0; i < nPols; i++) {
        const coefs = new BigBuffer(ctx.NCoefs * ctx.F.n8);
        for (let j = 0; j < ctx.NCoefs; j++) {
            coefs.set(buffCoefs.slice((i + j * nPols) * ctx.F.n8, (i + j * nPols + 1) * ctx.F.n8), j * ctx.F.n8);
        }
        ctx[ctx.zkey.polsNamesStage[stage][i]] = new Polynomial(coefs, ctx.curve, logger);
    }

    await fft(buffCoefs, nPols, ctx.nBitsExt, buffTo, ctx.F);

    let commits = await commit(stage, ctx.zkey, ctx, ctx.zkey.pTau, ctx.curve, { multiExp: true, logger });
    commits.forEach((com) => ctx.committedPols[`${com.index}`] = { commit: com.commit, pol: com.pol });

    commits.forEach((com) => console.log(com.index, ctx.curve.G1.toString(com.commit)));
    
    let commitsTranscript = [];
    if(stage > 1) commitsTranscript.push({value: ctx.challenges[stage - 1][ctx.challenges[stage - 1].length - 1]});

    const stageCommits = [];
    commits.forEach((com) => stageCommits.push({value: com.commit, commit: true}));

    if(ctx.pilInfo.hashCommits) {
        const hash = await module.exports.calculateHashFflonk(ctx, stageCommits);
        commitsTranscript.push({ value: hash });
    } else {
        commitsTranscript.push(...stageCommits);
    }

    return commitsTranscript;


    function findNumberOpenings(f, name, stage) {
        for(let i = 0; i < f.length; ++i) {
            if(f[i].stages[0].stage != stage) continue;
            for(let j = 0; j < f[i].pols.length; ++j) {
                if(f[i].pols[j] === name) {
                    return f[i].openingPoints.length + 1;
                }
            }
        }
        return 0;
    } 
}
