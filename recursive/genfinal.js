const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { Transcript } = require('./templates/transcript');

module.exports.genFinal = async function genFinal(globalInfo, starkInfoRecursivesF) {

    if(!globalInfo) throw new Error("Global info is undefined");
    if(!globalInfo.nPublics) throw new Error("Global info does not contain number of publics");
    if(!globalInfo.numChallenges) throw new Error("Global info does not contain number of challenges");
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
    const aggregationTypes = globalInfo.aggTypes;
    
    const template = await fs.promises.readFile(path.join(__dirname, "templates", `final.circom.ejs`), "utf8");

    const obj = {
        starkInfoRecursivesF,
        nPublics,
        nChallengesStages,
        stepsFRI,
        aggregationTypes,
        transcript: new Transcript,
    };
    
    
    const verifier = ejs.render(template ,  obj);

    return verifier;
}