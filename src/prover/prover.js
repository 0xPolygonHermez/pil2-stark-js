const { initProverFflonk, extendAndCommit, computeQFflonk, computeOpeningsFflonk, genProofFflonk, setChallengesFflonk, addTranscriptFflonk, getChallengeFflonk, calculateHashFflonk } = require("../fflonk/helpers/fflonk_prover_helpers");
const { initProverStark, extendAndMerkelize, computeQStark, computeEvalsStark, computeFRIStark, genProofStark, setChallengesStark, computeFRIFolding, computeFRIQueries, calculateHashStark, addTranscriptStark, getChallengeStark, getPermutationsStark } = require("../stark/stark_gen_helpers");
const { calculatePublics, callCalculateExps, applyHints } = require("./prover_helpers");

module.exports = async function proofGen(cmPols, pilInfo, inputs, constTree, constPols, zkey, options) {
    const logger = options.logger;

    let stark;
    if(!zkey && constTree && constPols) {
        stark = true;
    } else if(zkey && !constTree && !constPols) {
        stark = false;
    } else {
        throw new Error("Invalid parameters");
    }

    let ctx = await initProver(pilInfo, constTree, constPols, zkey, stark, options);
    
    if(ctx.prover === "stark") {
        // Read committed polynomials
        cmPols.writeToBigBuffer(ctx.cm1_n, ctx.pilInfo.mapSectionsN.cm1);
    } else {
        // Read committed polynomials
        await cmPols.writeToBigBufferFr(ctx.cm1_n, ctx.F, ctx.pilInfo.mapSectionsN.cm1);
    }
    
    await computePublics(ctx, inputs, stark, options);

    let challenge;
    
    const qStage = ctx.pilInfo.numChallenges.length + 1;

    if(options.debug) ctx.errors = [];

    for(let i = 1; i <= qStage; i++) {
        const stage = i;
        if(stage === qStage && options.debug) continue;
        if(stage !== 1) {
            setChallenges(stage, ctx, ctx.transcript, challenge, options);
        }
        await computeStage(stage, ctx, options);

        if(!options.debug) {
            let commits;
            if(stage === qStage) {
                commits = await computeQ(ctx, options);
            } else {
                commits = await extend(stage, ctx, options);
            }

            addTranscript(ctx.transcript, commits, stark);

            challenge = getChallenge(ctx.transcript, stark);

        } else {
            challenge = ctx.F.random();
        }
    }

    if(options.debug) {
        if (ctx.errors.length != 0) {
            logger.error("Pil does not pass");
            for (let i=0; i<ctx.errors.length; i++) {
                logger.error(ctx.errors[i]);
            }
            return false;
        } else {
            logger.debug("PIL OK!");
        }
        return true;
    };

    if(ctx.prover === "stark") {
        const evalsStage = ctx.pilInfo.numChallenges.length + 2;
        setChallengesStark(evalsStage, ctx, ctx.transcript, challenge, options);

        // STAGE 5. Compute Evaluations
        const evalsCommits = await computeEvalsStark(ctx, options);

        addTranscriptStark(ctx.transcript, evalsCommits, stark);

        challenge = getChallengeStark(ctx.transcript);

        const friStage = ctx.pilInfo.numChallenges.length + 3;
        setChallengesStark(friStage, ctx, ctx.transcript, challenge, options);

        // STAGE 6. Compute FRI
        await computeFRIStark(ctx, options);

        for (let step = 0; step < ctx.pilInfo.starkStruct.steps.length; step++) {

            challenge = getChallengeStark(ctx.transcript);
            ctx.challengesFRISteps.push(challenge);

            if (logger) logger.debug("··· challenges FRI folding step " + step + ": " + ctx.F.toString(challenge));

            const friCommits = await computeFRIFolding(step, ctx, challenge, options);

            addTranscriptStark(ctx.transcript, friCommits, stark);
        }

        const challengeFRIQueries = getChallengeStark(ctx.transcript);
        ctx.challengesFRISteps.push(challengeFRIQueries);

        const friQueries = await getPermutationsStark(ctx, challengeFRIQueries);

        if (logger) logger.debug("··· FRI queries: [" + friQueries.join(",") + "]");
    
        computeFRIQueries(ctx, friQueries);

    } else {
        await computeOpeningsFflonk(ctx, challenge, logger);
    }
    
    const proof = ctx.prover === "stark" ? await genProofStark(ctx, options) : await genProofFflonk(ctx, logger);

    return proof;
}

async function initProver(pilInfo, constTree, constPols, zkey, stark, options) {
    if(stark) {
        return await initProverStark(pilInfo, constPols, constTree, options);
    } else {
        return await initProverFflonk(pilInfo, zkey, options)
    }
}

async function computePublics(ctx, inputs, stark, options) {
    await calculatePublics(ctx, inputs);

    // Transcript publics
    if(!options.debug) {
        let publicsCommits = [];
        if(options.hashCommits) {
            if(!stark) {
                const commitsStage0 = ctx.zkey.f.filter(f => f.stages[0].stage === 0).map(f => `f${f.index}_0`);
                const constInputs = [];
                for(let i = 0; i < commitsStage0.length; ++i) {
                    constInputs.push({commit: true, value: ctx.committedPols[commitsStage0[i]].commit});
                }

                const constRoot = await calculateHash(ctx, constInputs);
                publicsCommits.push({ value: constRoot });

                const publicInputs = [];
                for(let i = 0; i < ctx.publics.length; ++i) {
                    publicInputs.push({value: ctx.publics[i]});
                }
                const publicsRoot = await calculateHash(ctx, publicInputs);
                publicsCommits.push({ value: publicsRoot }); 
            } else {
                publicsCommits.push(ctx.MH.root(ctx.constTree));
                const publicsRoot = await calculateHash(ctx, ctx.publics);
                publicsCommits.push(publicsRoot); 
            }
            

        } else {
            if(stark) {
                publicsCommits.push(ctx.MH.root(ctx.constTree));
                publicsCommits.push(...ctx.publics);
            } else {
                const commitsStage0 = ctx.zkey.f.filter(f => f.stages[0].stage === 0).map(f => `f${f.index}_0`);
                publicsCommits.push(...commitsStage0.map(p => {return { commit: true, value: ctx.committedPols[p].commit }}));
                publicsCommits.push(...ctx.publics.map(p => {return { value: p }}));

            }
        }

        addTranscript(ctx.transcript, publicsCommits, stark);
    }

}

async function computeStage(stage, ctx, options) {
    const logger = options.logger;

    if (logger) logger.debug(`> STAGE ${stage}`);

    const qStage = ctx.pilInfo.numChallenges.length + 1;
    const dom = stage === qStage ? "ext" : "n";

    await callCalculateExps(`stage${stage}`, ctx.pilInfo.code[`stage${stage}`], dom, ctx, options.parallelExec, options.useThreads, false);
    
    await applyHints(stage, ctx);

    //TODO: REMOVE WITH SMARTER LOGIC!
    await callCalculateExps(`stage${stage}`, ctx.pilInfo.code[`stage${stage}`], dom, ctx, options.parallelExec, options.useThreads, false);

    if(options.debug) {
        const nConstraintsStage = ctx.pilInfo.constraints[`stage${stage}`].length;
        for(let i = 0; i < nConstraintsStage; i++) {
            const constraint = ctx.pilInfo.constraints[`stage${stage}`][i];
            if(logger) logger.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);
            await callCalculateExps(`stage${stage}`, constraint, dom, ctx, options.parallelExec, options.useThreads, true);
        }
    }
}

async function computeQ(ctx, options) {
    let commits;
    if(ctx.prover === "stark") {
        commits = await computeQStark(ctx, options);
    } else {
        commits = await computeQFflonk(ctx, options);
    }
    return commits;
}

async function extend(stage, ctx, options) {
    let commits;
    if(ctx.prover === "stark")   {
        commits = await extendAndMerkelize(stage, ctx, options)
    } else {
        commits = await extendAndCommit(stage, ctx, options);
    }
    return commits;
}

async function calculateHash(ctx, inputs) {
    let hash;
    if(ctx.prover === "stark") {
        hash = await calculateHashStark(ctx, inputs);
    } else {
        hash = await calculateHashFflonk(ctx, inputs);
    }
    return hash;
}

function addTranscript(transcript, inputs, stark) {
    if(stark) {
        addTranscriptStark(transcript, inputs);
    } else {
        addTranscriptFflonk(transcript, inputs);
    }
}

function getChallenge(transcript, stark) {
    if(stark) {
        return getChallengeStark(transcript);
    } else {
        return getChallengeFflonk(transcript);
    }
}

function setChallenges(stage, ctx, transcript, challenge, options) {
    if(ctx.prover === "stark") {
        setChallengesStark(stage, ctx, transcript, challenge, options);
    } else {
        setChallengesFflonk(stage, ctx, transcript, challenge, options);
    }
}

module.exports.initProver = initProver;
module.exports.computeStage = computeStage;
module.exports.computeQ = computeQ;
module.exports.extend = extend;
module.exports.setChallenges = setChallenges;
module.exports.getChallenge = getChallenge;
