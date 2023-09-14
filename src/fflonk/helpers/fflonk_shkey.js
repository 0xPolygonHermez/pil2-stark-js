const {setup} = require("shplonkjs");
const {Scalar} = require("ffjavascript");

module.exports = async function fflonkShkey(ptauFile, fflonkInfo, options) {
    const logger = options.logger;

    if(logger) logger.info("> Starting fflonk shkey generation");

    const nStages = fflonkInfo.numChallenges.length + 1;
    let fiNames = {};
    let fiIndex = 0;

    const polDefs = [];
    for(let i = 0; i < fflonkInfo.openingPoints.length; ++i) {
        let opening = fflonkInfo.openingPoints[i];
        polDefs[opening] = [];
    }

    const pilPower = fflonkInfo.pilPower;
    const domainSize = 2 ** pilPower;

    let polsNames = {};
    let fiMap = {};

    for(let i = 0; i < nStages; ++i) {
        polsNames[i] = [];
        fiMap[i] = {};
    }

    polsNames[nStages] = [];

    for(let i = 0; i < fflonkInfo.constPolsMap.length; ++i) {
        const polInfo = fflonkInfo.constPolsMap[i];
        setPolDefs("const", 0, polInfo.name, i, domainSize);
    }

    for(let i = 0; i < fflonkInfo.cmPolsMap.length; ++i) {
        const polInfo = fflonkInfo.cmPolsMap[i];
        if(polInfo.stage === "tmpExp") continue;
        const stage = Number(polInfo.stage.slice(2));
        setPolDefs("cm", stage, polInfo.name, i, domainSize);
    }
        
    fixFIndex();

    let maxQDegree = options.maxQDegree || 0;

    const blindCoefs = fflonkInfo.maxPolsOpenings * (fflonkInfo.qDeg + 1);
    const domainSizeQ = fflonkInfo.qDeg * domainSize + blindCoefs;
    
    if(!maxQDegree || (domainSizeQ - blindCoefs) <= maxQDegree * domainSize) {
        maxQDegree = 0;
        polDefs[0].push({name: "Q", stage: nStages, degree: domainSizeQ, fi: fiIndex});
        polsNames[nStages].push("Q")
    } else if((domainSizeQ - blindCoefs) / domainSize > maxQDegree) {
        const nQ = Math.ceil((domainSizeQ - blindCoefs) / (maxQDegree * domainSize));
        for(let i = 0; i < nQ; ++i) {
            let degree = i === nQ - 1 ? domainSizeQ - i*maxQDegree*domainSize : maxQDegree * domainSize + 2;
        
            polDefs[0].push({name: `Q${i}`, stage: nStages, degree: degree, fi: fiIndex});
            polsNames[nStages].push(`Q${i}`)
        } 
    }
    
    const config = {
        power: pilPower, 
        polDefs,
        extraMuls: options.extraMuls || 0,
        openBy: "custom",
    }

    if(logger) logger.info("Starting shPlonk setup...");
    
    const {zkey: shkey, PTau, curve} =await setup(config, ptauFile, logger);

    if(logger) logger.info("ShPlonk setup done.");

    shkey.polsNamesStage = polsNames;
    
    shkey.nPublics = fflonkInfo.nPublics;

    shkey.maxQDegree = maxQDegree;
    
    delete shkey.X_2;
    
    if(logger) logger.info("> Fflonk shkey generation finished");
    
    const roots = Object.keys(shkey).filter(k => k.match(/^w\d/));    
    for(let i = 0; i < roots.length; ++i) {
        shkey[roots[i]] = curve.Fr.toObject(shkey[roots[i]]);
    }

    shkey.primeQ = curve.q;
    shkey.n8q = (Math.floor((Scalar.bitLength(shkey.primeQ) - 1) / 64) + 1) * 8;

    shkey.primeR = curve.r;
    shkey.n8r = (Math.floor((Scalar.bitLength(shkey.primeR) - 1) / 64) + 1) * 8;

    return { zkey: shkey, PTau, curve };

    function setPolDefs(type, stage, name, id, domainSize) {
        if(!["const", "cm"].includes(type)) throw new Error("Invalid type");
        if(fflonkInfo.evMap.find(ev => ev.type === type && ev.id === id)) {
            let degree = domainSize;
          
            const openings = fflonkInfo.evMap.filter(ev => ev.type === type && ev.id === id).map(ev => ev.prime).sort((a,b) => a - b);

            if(type === "cm") {
                degree += openings.length + 1;
            }

            const openName = openings.join(",");

            if(!fiMap[stage][openName]) fiMap[stage][openName] = 0;
            ++fiMap[stage][openName];

            polsNames[stage].push(name);
            for(let i = 0; i < fflonkInfo.openingPoints.length; ++i) {
                const opening = fflonkInfo.openingPoints[i];
                polDefs[opening].push({name: name, stage: stage, degree: degree, open: openName})
            }
        } else {
            polsNames[stage].push(name);
        }
    }

    // TODO: Needs to be done again
    function fixFIndex(minPols = 3) {
        for(let stage = 0; stage < nStages; ++stage) {
            const openings = Object.keys(fiMap[stage]);
            if(openings.length <= 1) continue;
            
            if(!fiMap[stage]["0,1"] && fiMap[stage]["0"] >= minPols && fiMap[stage]["1"] >= minPols) continue;
    
            if(fiMap[stage]["0"] && fiMap[stage]["0"] < minPols) {
                for(let i = 0; i < polDefs[0].length; ++i) {
                    if(polDefs[0][i].stage === stage) {
                        polDefs[0][i].open = "0,1";
                        const pol = polDefs[1].find(wxi => wxi.name === polDefs[0][i].name);
                        if(!pol) {
                            if(stage !== 0) polDefs[0][i].degree += 1;
                            polDefs[1].push(polDefs[0][i]);
                        } else {
                            pol.open = "0,1";
                        }
                    }
                }
            } 
            
            if(fiMap[stage]["1"] && fiMap[stage]["1"] < minPols) {
                for(let i = 0; i < polDefs[1].length; ++i) {
                    if(polDefs[1][i].stage === stage) {
                        polDefs[1][i].open = "0,1";
                        const pol = polDefs[0].find(xi => xi.name === polDefs[1][i].name);
                        if(!pol) {
                            if(stage !== 0) polDefs[1][i].degree += 1;
                            polDefs[0].push(polDefs[1][i]);
                        } else {
                            pol.open = "0,1";
                        }
                    }
                }
            }
        }

        for(let i = 0; i < fflonkInfo.openingPoints.length; ++i) {
            const opening = fflonkInfo.openingPoints[i];
            for(let j = 0; j < polDefs[opening].length; ++j) {
                const fiName = `${polDefs[opening][j].stage}_${polDefs[opening][j].open}`;
                if(!fiNames.hasOwnProperty(fiName)) fiNames[fiName] = fiIndex++;
                polDefs[opening][j].fi = fiNames[fiName];
                delete polDefs[opening][j].open;
            }
        }
    }
}
