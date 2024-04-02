const fs = require("fs");
const version = require("../package").version;

const F3g = require("./helpers/f3g.js");
const pilInfo = require("./pil_info/pil_info.js");
const { compile } = require("pilcom");
const { compile: compilePil2 } = require("pilcom2");
const protobuf = require('protobufjs');
const path = require('path');

const argv = require("yargs")
    .version(version)
    .usage("node main_genstarkinfo.js -p <pil.json> [-P <pilconfig.json] -s <starkstruct.json> -i <starkinfo.json> [--vadcop <boolean>] [--hashCommits <boolean>] [--arity <number>] [--custom <boolean>] [--pil2] [--subproofId <number>] [--airId <number>]")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkstruct")
    .alias("i", "starkinfo")
    .alias("e", "expressionsinfo")
    .alias("n", "pil2")
    .alias("c", "custom")
    .alias("v", "vadcop")
    .alias("h", "hashcommits")
    .alias("m", "impolsstages")
    .string("subproofId")
    .string("airId")
    .string("arity")
    .argv;

async function run() {
    const F = new F3g();

    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};

    const starkStructFile = typeof(argv.starkstruct) === "string" ?  argv.starkstruct.trim() : "mycircuit.stark_struct.json";
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";
    const expressionsInfoFile = typeof(argv.expressionsinfo) === "string" ?  argv.expressionsinfo.trim() : "mycircuit.expressionsinfo.json";

    const pil2 = argv.pil2 || false;

    let pil;
    if(pil2) {
        const tmpPath = path.resolve(__dirname, '../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        pilConfig.piloutDir = tmpPath;
        await compilePil2(F, pilFile, null, pilConfig);
        const piloutEncoded = fs.readFileSync(path.join(tmpPath, "pilout.ptb"));
        const pilOutProtoPath = path.resolve(__dirname, '../node_modules/pilcom2/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        const subproofId = argv.subproofId || 0;
        const airId = argv.airId || 0;

        pil = pilout.subproofs[subproofId].airs[airId];
        pil.symbols = pilout.symbols;
        pil.numChallenges = pilout.numChallenges;
        pil.hints = pilout.hints;
        pil.airId = airId;
        pil.subproofId = subproofId;
    } else {
        pil = await compile(F, pilFile, null, pilConfig);
    }

    const starkStruct = JSON.parse(await fs.promises.readFile(starkStructFile, "utf8"));

    const options = {};
    if(starkStruct.verificationHashType === "BN128") {
        options.arity = Number(argv.arity) || 16;
        options.custom = argv.custom || false;
    }
    
    options.isVadcop = argv.vadcop || false;
    options.hashCommits = argv.hashcommits || false;
    options.imPolsStages = argv.impolsstages || false;

    console.log(options);

    const {pilInfo: starkInfo, expressionsInfo} = pilInfo(F, pil, true, pil2, starkStruct, options);

    await fs.promises.writeFile(starkInfoFile, JSON.stringify(starkInfo, null, 1), "utf8");
    
    await fs.promises.writeFile(expressionsInfoFile, JSON.stringify(expressionsInfo, null, 1), "utf8");

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

