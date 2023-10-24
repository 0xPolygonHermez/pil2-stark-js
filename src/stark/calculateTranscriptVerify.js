const Transcript = require("../helpers/transcript/transcript");
const TranscriptBN128 = require("../helpers/transcript/transcript.bn128");
const buildPoseidonGL = require("../helpers/hash/poseidon/poseidon");
const { calculateHashStark } = require("./stark_gen_helpers");
const buildPoseidonBN128 = require("circomlibjs").buildPoseidon;

module.exports.calculateTranscript = async function calculateTranscript(F, starkInfo, proof, publics, constRoot, options) {
    let challenges = [];
    let transcript;
    if (starkInfo.starkStruct.verificationHashType == "GL") {
        const poseidonGL = await buildPoseidonGL();
        transcript = new Transcript(poseidonGL);
    } else if (starkInfo.starkStruct.verificationHashType == "BN128") {
        const poseidonBN128 = await buildPoseidonBN128();
        let arity = options.arity || 16;
        let custom = options.custom || false; 
        options.transcriptArity = custom ? arity : 16;   
        transcript = new TranscriptBN128(poseidonBN128, options.transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ starkInfo.starkStruct.verificationHashType);
    }
    
    const logger = options.logger;

    const ctx = {
        pilInfo: starkInfo,
        arity: options.transcriptArity,
    };

    transcript.put(constRoot);
    if(!options.hashCommits) {
        for (let i=0; i<publics.length; i++) {
            transcript.put(publics[i]);
        }
    } else {
        const commitsHash = await calculateHashStark(ctx, publics);
        transcript.put(commitsHash);
    }

    for(let i=0; i < starkInfo.numChallenges.length; i++) {
        const stage = i + 1;
        const nChallengesStage = starkInfo.numChallenges[i];
        challenges[stage - 1] = [];
        for(let j = 0; j < nChallengesStage; ++j) {
            challenges[stage - 1][j] = transcript.getField();
            if (logger) logger.debug("··· challenges[" + (stage - 1) + "][" + j + "]: " + F.toString(challenges[stage - 1][j]));
        }
        transcript.put(proof["root" + stage]);
    }
    
    let qStage = starkInfo.numChallenges.length;
    challenges[qStage] = [];
    challenges[qStage][0] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + qStage + "][0]: " + F.toString(challenges[qStage][0]));
    transcript.put(proof.rootQ);
    
    let evalsStage = starkInfo.numChallenges.length + 1;
    challenges[evalsStage] = [];
    challenges[evalsStage][0] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + evalsStage + "][0]: " + F.toString(challenges[evalsStage][0]));
    
    if(!options.hashCommits) {
        for (let i=0; i<proof.evals.length; i++) {
            transcript.put(proof.evals[i]);
        }
    } else {
        const commitsHash = await calculateHashStark(ctx, proof.evals);
        transcript.put(commitsHash);
    }

    let friStage = starkInfo.numChallenges.length + 2;
    challenges[friStage] = [];
    challenges[friStage][0] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + friStage + "][0]: " + F.toString(challenges[friStage][0]));

    challenges[friStage][1] = transcript.getField();
    if (logger) logger.debug("··· challenges[" + friStage + "][1]: " + F.toString(challenges[friStage][1]));


    let challengesFRISteps = [];
    for (let step=0; step<starkInfo.starkStruct.steps.length; step++) {
        challengesFRISteps[step] = transcript.getField();
        if (logger) logger.debug("··· challenges FRI folding step " + step + ": " + F.toString(challengesFRISteps[step]));

        if (step < starkInfo.starkStruct.steps.length - 1) {
            transcript.put(proof.fri[step+1].root);
        } else {
            if(!options.hashCommits) {
                for (let i=0; i<proof.fri[proof.fri.length-1].length; i++) {
                    transcript.put(proof.fri[proof.fri.length-1][i]);
                }
            } else {
                const commitsHash = await calculateHashStark(ctx,proof.fri[proof.fri.length-1]);
                transcript.put(commitsHash);
            }
        }
    }

    challengesFRISteps[starkInfo.starkStruct.steps.length] = transcript.getField();

    if (logger) logger.debug("··· challenge FRI permutations: " + F.toString(challengesFRISteps[starkInfo.starkStruct.steps.length]));

    return {challenges, challengesFRISteps};
}

module.exports.calculateFRIQueries = async function calculateFRIQueries(starkInfo, challenge, options) {
    const logger = options.logger;
    let transcriptFRIQuery;
    if (starkInfo.starkStruct.verificationHashType == "GL") {
        const poseidonGL = await buildPoseidonGL();
        transcriptFRIQuery = new Transcript(poseidonGL);
    } else if (starkInfo.starkStruct.verificationHashType == "BN128") {
        const poseidonBN128 = await buildPoseidonBN128();
        transcriptFRIQuery = new TranscriptBN128(poseidonBN128, options.transcriptArity);
    } else {
        throw new Error("Invalid Hash Type: "+ starkInfo.starkStruct.verificationHashType == "GL");
    }

    transcriptFRIQuery.put(challenge);

    let friQueries = transcriptFRIQuery.getPermutations(starkInfo.starkStruct.nQueries, starkInfo.starkStruct.steps[0].nBits);
    if (logger) logger.debug("··· FRI queries: [" + friQueries.join(",") + "]");

    return friQueries;
}