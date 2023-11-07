const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { Transcript } = require("./templates/transcript");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_genfinal.js -g globalinfo.json -s recursivef_stark_infos.json -o <final.circom> ")
    .alias("s", "starkinfos").array("s")
    .alias("v", "verifierCircuitsName").array("s")
    .alias("g", "globalinfo")
    .alias("o", "output")
    .argv;

async function run() {
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.circom";
    
    const starkInfoRecursivesF = [];

    for(let i = 0; i < argv.starkinfos.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(argv.starkinfos[i], "utf8"));
        if(!starkInfo.finalSubproofId) throw new Error("Stark info " + i + " does not contain final subproof id");
        starkInfoRecursivesF.push(starkInfo);
    }

    if(!argv.verifierCircuitsName) throw new Error("Verifier circuits names missing");

    const verifierCircuitsName = [];
    for(let i = 0; i < argv.starkinfos.length; i++) {
        verifierCircuitsName.push(argv.verifierCircuitsName);
    }

    if(starkInfoRecursivesF.length !== verifierCircuitsName.length) throw new Error("starkInfoRecursivesF and verifierCircuitsName lengths must match");

    const globalInfoFile = typeof(argv.globalinfo) === "string" ? argv.globalinfo.trim() : "mycircuit.globalinfo.json";
    const globalInfo = JSON.parse(await fs.promises.readFile(globalInfoFile, "utf8"));

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
    const stepsFRI = globalInfo.starkStruct.steps;
    const aggregationTypes = globalInfo.aggTypes;
    
    const template = await fs.promises.readFile(path.join(__dirname, "templates", `final.circom.ejs`), "utf8");

    const obj = {
        starkInfoRecursivesF,
        nPublics,
        nChallengesStages,
        stepsFRI,
        aggregationTypes,
        verifierCircuitsName,
        transcript: new Transcript,
    };

    
    
    const verifier = ejs.render(template ,  obj);

    await fs.promises.writeFile(outputFile, verifier, "utf8");

    console.log("file Generated Correctly");

}
run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
