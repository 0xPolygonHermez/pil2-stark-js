const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { Transcript } = require('./templates/transcript');

module.exports.genRecursive = async function genRecursive(template, subproofId, subproofName, vks, starkInfo, globalInfo, hasCompressor) {
    if(!subproofName) throw new Error("Verifier circuit name must be provided");
    if(!["compressor", "recursive1", "recursive2", "recursivef"].includes(template)) throw new Error(`Invalid template: ${template}`);

    let verifierCircuitName;
    if((template === "recursive1" && !hasCompressor) || template === "compressor") { 
        verifierCircuitName = subproofName;
    } else {
        if(template === "recursive1") {
            verifierCircuitName = `compressor_${subproofName}`;
        } else if (template === "recursive2") {
            verifierCircuitName = `recursive1_${subproofName}`;
        } else if (template === "recursivef") {
            verifierCircuitName = `recursive2_${subproofName}`;
        } else if (template === "final") {
            verifierCircuitName = `recursivef_${subproofName}`;
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
    const nSubproofValues = aggregationTypes.length;

    const obj = {
        starkInfo,
        vks,
        hasCompressor,
        nPublics,
        nSubproofValues,
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