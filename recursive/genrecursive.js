const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { Transcript } = require('./templates/transcript');

module.exports.genRecursive = async function genRecursive(template, subproofId, airId, vks, starkInfo, globalInfo, hasCompressor) {
    if(subproofId === undefined) throw new Error("subproofId is undefined");
    if(airId === undefined && !["recursive2", "recursivef"].includes(template)) throw new Error("airId is undefined");
    if(!["compressor", "recursive1", "recursive2", "recursivef"].includes(template)) throw new Error(`Invalid template: ${template}`);

    let verifierCircuitName;
    if((template === "recursive1" && !hasCompressor) || template === "compressor") { 
        verifierCircuitName = `basic_stark_subproof${subproofId}_air${airId}`;
    } else {
        if(template === "recursive1") {
            verifierCircuitName = `compressor_subproof${subproofId}_air${airId}`;
        } else if (template === "recursive2") {
            verifierCircuitName = `recursive1_subproof${subproofId}`;
        } else if (template === "recursivef") {
            verifierCircuitName = `recursive2_subproof${subproofId}`;
        }
    }

    starkInfo.finalSubproofId = subproofId;

    if(!globalInfo) throw new Error("Global info is undefined");
    if(!globalInfo.nPublics) throw new Error("Global info does not contain number of publics");
    if(!globalInfo.numChallenges) throw new Error("Global info does not contain number of challenges");
    if(!globalInfo.aggTypes) throw new Error("Global info does not contain number of aggregation types");
    if(!globalInfo.stepsFRI) {
        if(globalInfo.starkStruct.steps) {
            globalInfo.stepsFRI = globalInfo.starkStruct.steps;
        } else {
            throw new Error("Global info does not contain number of fri steps");
        }
    } 

    const nPublics = globalInfo.nPublics;
    const nChallengesStages = globalInfo.numChallenges;
    const stepsFRI = globalInfo.stepsFRI;
    const aggTypes = globalInfo.aggTypes;


    const templateRecursive = await fs.promises.readFile(path.join(__dirname, "templates", `${template}.circom.ejs`), "utf8");

    hasCompressor = template !== "recursive1" ? false : hasCompressor;

    const aggregationTypes = aggTypes[starkInfo.finalSubproofId];
    const nSubAirValues = aggregationTypes.length;

    const obj = {
        starkInfo,
        vks,
        hasCompressor,
        nPublics,
        nSubAirValues,
        aggregationTypes,
        nChallengesStages,
        stepsFRI,
    };

    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
        obj.circuitType = Number(subproofId);

        obj.transcriptPublics = new Transcript("publics");
        obj.transcriptEvals = new Transcript("evals");
        obj.transcriptFinalPol = new Transcript("finalPol");

    }

    obj.verifierCircuitName = verifierCircuitName;
    
    const verifier = ejs.render(templateRecursive,  obj);

    return verifier;
}