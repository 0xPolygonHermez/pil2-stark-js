const { initProverFflonk, extendAndCommit, computeQFflonk, computeOpeningsFflonk, genProofFflonk, setChallengesFflonk, calculateChallengeFflonk } = require("../fflonk/helpers/fflonk_prover_helpers");
const { initProverStark, extendAndMerkelize, computeQStark, computeEvalsStark, computeFRIStark, genProofStark, setChallengesStark, calculateChallengeStark, computeFRIProof } = require("../stark/stark_gen_helpers");
const { calculatePublics, callCalculateExps, applyHints } = require("./prover_helpers");

module.exports = async function proofGen(cmPols, pilInfo, constTree, constPols, zkey, options) {
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
   
    calculatePublics(ctx);

    let challenge;
    
    const qStage = ctx.pilInfo.numChallenges.length + 1;

    for(let i = 1; i <= qStage; i++) {
        const stage = i;
        if(stage !== 1) {
            setChallenges(stage, ctx, challenge, logger);
        }
        await computeStage(stage, ctx, options);
        if(stage === qStage) {
            await computeQ(ctx, logger);
        } else {
            await extend(stage, ctx, logger);
        }
        challenge = await getChallenge(stage, ctx);
    }

    if(ctx.prover === "stark") {
        setChallengesStark(ctx.pilInfo.numChallenges.length + 2, ctx, challenge, logger);

        // STAGE 5. Compute Evaluations
        await computeEvalsStark(ctx, logger);

        challenge = await calculateChallengeStark(ctx.pilInfo.numChallenges.length + 2, ctx);

        setChallengesStark(ctx.pilInfo.numChallenges.length + 3, ctx, challenge, logger);

        // STAGE 6. Compute FRI
        await computeFRIStark(ctx, options);

        await computeFRIProof(ctx);
    } else {
        await computeOpeningsFflonk(ctx, challenge, logger);
    }
    
    const {proof, publics} = ctx.prover === "stark" ? await genProofStark(ctx, logger) : await genProofFflonk(ctx, logger);

    return {proof, publics};
}

async function initProver(pilInfo, constTree, constPols, zkey, stark, options) {
    if(stark) {
        return await initProverStark(pilInfo, constPols, constTree, options);
    } else {
        return await initProverFflonk(pilInfo, zkey, options)
    }
}

async function computeStage(stage, ctx, options) {
    const logger = options.logger;

    if (logger) logger.debug(`> STAGE ${stage}`);

    const dom = stage === ctx.pilInfo.numChallenges.length + 1 ? "ext" : "n";

    await callCalculateExps(`stage${stage}`, dom, ctx, options.parallelExec, options.useThreads);

    await applyHints(stage, ctx);
}

async function computeQ(ctx, logger) {
    if(ctx.prover === "stark") {
        await computeQStark(ctx, logger);
    } else {
        await computeQFflonk(ctx, logger);
    }
}

async function extend(stage, ctx, logger) {
    if(ctx.prover === "stark")   {
        await extendAndMerkelize(stage, ctx, logger)
    } else {
        await extendAndCommit(stage, ctx, logger);
    }
}

async function getChallenge(stage, ctx) {
    if(ctx.prover === "stark") {
        return calculateChallengeStark(stage, ctx);
    } else {
        return calculateChallengeFflonk(stage, ctx);
    }
}

function setChallenges(stage, ctx, challenge, logger) {
    if(ctx.prover === "stark") {
        setChallengesStark(stage, ctx, challenge, logger);
    } else {
        setChallengesFflonk(stage, ctx, challenge, logger);
    }
}

module.exports.initProver = initProver;
module.exports.computeStage = computeStage;
module.exports.computeQ = computeQ;
module.exports.extend = extend;
module.exports.setChallenges = setChallenges;
module.exports.getChallenge = getChallenge;