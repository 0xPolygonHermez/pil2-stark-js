const fs = require("fs");
const version = require("../package").version;

const F3g = require("./helpers/f3g.js");
const pilInfo = require("./pil_info/pil_info.js");
const { compile } = require("pilcom");
const { compile: compilePil2 } = require("pilcom2");

const argv = require("yargs")
    .version(version)
    .usage("node main_genstarkinfo.js -p <pil.json> [-P <pilconfig.json] -s <starkstruct.json> -i <starkinfo.json>")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("s", "starkstruct")
    .alias("i", "starkinfo")
    .argv;

async function run() {
    const F = new F3g();

    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};

    const starkStructFile = typeof(argv.starkstruct) === "string" ?  argv.starkstruct.trim() : "mycircuit.stark_struct.json";
    const starkInfoFile = typeof(argv.starkinfo) === "string" ?  argv.starkinfo.trim() : "mycircuit.starkinfo.json";

    const pil2 = argv.pil2 || false;

    let pil;
    if(pil2) {
        pil = await compilePil2(F, pilFile, null, pilConfig);
    } else {
        pil = await compile(F, pilFile, null, pilConfig);
    }

    const starkStruct = JSON.parse(await fs.promises.readFile(starkStructFile, "utf8"));

    const starkInfo = pilInfo(F, pil, true, !pil2, false, starkStruct);

    await fs.promises.writeFile(starkInfoFile, JSON.stringify(starkInfo, null, 1), "utf8");

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

