const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node main_genfinal.js -s recursivef_stark_infos.json -b <starkinfobasic.json> -o <final.circom> ")
    .alias("s", "starkinfos").array("s")
    .alias("b", "starkinfobasics").array("b")
    .alias("o", "output")
    .argv;

async function run() {
    const outputFile = typeof(argv.output) === "string" ?  argv.output.trim() : "mycircuit.circom";
    
    if(argv.starkinfobasics.length !== argv.starkinfos.length) throw new Error("Lengths mismatch");

    const starkInfoRecursivesF = [];
    const starkInfoBasics = [];

    for(let i = 0; i < argv.starkinfos.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(argv.starkinfos[i], "utf8"));
        starkInfoRecursivesF.push(starkInfo);
    }

    for(let i = 0; i < argv.starkinfobasics.length; i++) {
        const starkInfoBasic = JSON.parse(await fs.promises.readFile(argv.starkinfobasics[i], "utf8"));
        starkInfoBasics.push(starkInfoBasic);
    }
    
    const template = await fs.promises.readFile(path.join(__dirname, "templates", `final.circom.ejs`), "utf8");

    const obj = {
        starkInfoRecursivesF,
        starkInfoBasics,
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
