pragma circom 2.1.0;
pragma custom_templates;

include "cmul.circom";
include "cinv.circom";
include "poseidon.circom";
include "bitify.circom";
include "fft.circom";
include "evalpol.circom";
include "treeselector4.circom";
include "merklehash.circom";



/* 
    Calculate FRI Queries
*/
template calculateFRIQueries0() {
    
    signal input challengeFRIQueries[3];
    signal output {binary} queriesFRI[8][11];


    
    signal transcriptHash_friQueries_0[12] <== Poseidon(12)([challengeFRIQueries[0],challengeFRIQueries[1],challengeFRIQueries[2],0,0,0,0,0], [0,0,0,0]);
    signal {binary} transcriptN2b_0[64] <== Num2Bits_strict()(transcriptHash_friQueries_0[0]);
    signal {binary} transcriptN2b_1[64] <== Num2Bits_strict()(transcriptHash_friQueries_0[1]);
    for(var i = 2; i < 12; i++){
        _ <== transcriptHash_friQueries_0[i]; // Unused transcript values        
    }

    // From each transcript hash converted to bits, we assign those bits to queriesFRI[q] to define the query positions
    var q = 0; // Query number 
    var b = 0; // Bit number 
    for(var j = 0; j < 63; j++) {
        queriesFRI[q][b] <== transcriptN2b_0[j];
        b++;
        if(b == 11) {
            b = 0; 
            q++;
        }
    }
    _ <== transcriptN2b_0[63]; // Unused last bit

    for(var j = 0; j < 25; j++) {
        queriesFRI[q][b] <== transcriptN2b_1[j];
        b++;
        if(b == 11) {
            b = 0; 
            q++;
        }
    }
    for(var j = 25; j < 64; j++) {
        _ <== transcriptN2b_1[j]; // Unused bits        
    }
}


/* 
    Calculate the transcript
*/ 
template Transcript0() {

    signal input publics[3];
    signal input rootC[4];
    signal input root1[4];
    signal input root2[4];
    signal input root3[4];
                  
    signal input root4[4];
    signal input evals[43][3]; 
    signal input s1_root[4];
    signal input s2_root[4];
    signal input finalPol[8][3];
    
    signal output challengesStage2[2][3];
    signal output challengesStage3[3][3];

    signal output challengeQ[3];
    signal output challengeXi[3];
    signal output challengesFRI[2][3];
    signal output challengesFRISteps[4][3];
    signal output {binary} queriesFRI[8][11];



    

    
    signal transcriptHash_0[12] <== Poseidon(12)([rootC[0],rootC[1],rootC[2],rootC[3],publics[0],publics[1],publics[2],root1[0]], [0,0,0,0]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_0[i]; // Unused transcript values 
    }
    
    signal transcriptHash_1[12] <== Poseidon(12)([root1[1],root1[2],root1[3],0,0,0,0,0], [transcriptHash_0[0],transcriptHash_0[1],transcriptHash_0[2],transcriptHash_0[3]]);
    challengesStage2[0] <== [transcriptHash_1[0], transcriptHash_1[1], transcriptHash_1[2]];
    challengesStage2[1] <== [transcriptHash_1[3], transcriptHash_1[4], transcriptHash_1[5]];
    for(var i = 6; i < 12; i++){
        _ <== transcriptHash_1[i]; // Unused transcript values 
    }
    
    signal transcriptHash_2[12] <== Poseidon(12)([root2[0],root2[1],root2[2],root2[3],0,0,0,0], [transcriptHash_1[0],transcriptHash_1[1],transcriptHash_1[2],transcriptHash_1[3]]);
    challengesStage3[0] <== [transcriptHash_2[0], transcriptHash_2[1], transcriptHash_2[2]];
    challengesStage3[1] <== [transcriptHash_2[3], transcriptHash_2[4], transcriptHash_2[5]];
    challengesStage3[2] <== [transcriptHash_2[6], transcriptHash_2[7], transcriptHash_2[8]];
    for(var i = 9; i < 12; i++){
        _ <== transcriptHash_2[i]; // Unused transcript values 
    }
    
    signal transcriptHash_3[12] <== Poseidon(12)([root3[0],root3[1],root3[2],root3[3],0,0,0,0], [transcriptHash_2[0],transcriptHash_2[1],transcriptHash_2[2],transcriptHash_2[3]]);
    challengeQ <== [transcriptHash_3[0], transcriptHash_3[1], transcriptHash_3[2]];
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_3[i]; // Unused transcript values 
    }
    
    signal transcriptHash_4[12] <== Poseidon(12)([root4[0],root4[1],root4[2],root4[3],0,0,0,0], [transcriptHash_3[0],transcriptHash_3[1],transcriptHash_3[2],transcriptHash_3[3]]);
    challengeXi <== [transcriptHash_4[0], transcriptHash_4[1], transcriptHash_4[2]];
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_4[i]; // Unused transcript values 
    }
    
    signal transcriptHash_5[12] <== Poseidon(12)([evals[0][0],evals[0][1],evals[0][2],evals[1][0],evals[1][1],evals[1][2],evals[2][0],evals[2][1]], [transcriptHash_4[0],transcriptHash_4[1],transcriptHash_4[2],transcriptHash_4[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_5[i]; // Unused transcript values 
    }
    
    signal transcriptHash_6[12] <== Poseidon(12)([evals[2][2],evals[3][0],evals[3][1],evals[3][2],evals[4][0],evals[4][1],evals[4][2],evals[5][0]], [transcriptHash_5[0],transcriptHash_5[1],transcriptHash_5[2],transcriptHash_5[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_6[i]; // Unused transcript values 
    }
    
    signal transcriptHash_7[12] <== Poseidon(12)([evals[5][1],evals[5][2],evals[6][0],evals[6][1],evals[6][2],evals[7][0],evals[7][1],evals[7][2]], [transcriptHash_6[0],transcriptHash_6[1],transcriptHash_6[2],transcriptHash_6[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_7[i]; // Unused transcript values 
    }
    
    signal transcriptHash_8[12] <== Poseidon(12)([evals[8][0],evals[8][1],evals[8][2],evals[9][0],evals[9][1],evals[9][2],evals[10][0],evals[10][1]], [transcriptHash_7[0],transcriptHash_7[1],transcriptHash_7[2],transcriptHash_7[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_8[i]; // Unused transcript values 
    }
    
    signal transcriptHash_9[12] <== Poseidon(12)([evals[10][2],evals[11][0],evals[11][1],evals[11][2],evals[12][0],evals[12][1],evals[12][2],evals[13][0]], [transcriptHash_8[0],transcriptHash_8[1],transcriptHash_8[2],transcriptHash_8[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_9[i]; // Unused transcript values 
    }
    
    signal transcriptHash_10[12] <== Poseidon(12)([evals[13][1],evals[13][2],evals[14][0],evals[14][1],evals[14][2],evals[15][0],evals[15][1],evals[15][2]], [transcriptHash_9[0],transcriptHash_9[1],transcriptHash_9[2],transcriptHash_9[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_10[i]; // Unused transcript values 
    }
    
    signal transcriptHash_11[12] <== Poseidon(12)([evals[16][0],evals[16][1],evals[16][2],evals[17][0],evals[17][1],evals[17][2],evals[18][0],evals[18][1]], [transcriptHash_10[0],transcriptHash_10[1],transcriptHash_10[2],transcriptHash_10[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_11[i]; // Unused transcript values 
    }
    
    signal transcriptHash_12[12] <== Poseidon(12)([evals[18][2],evals[19][0],evals[19][1],evals[19][2],evals[20][0],evals[20][1],evals[20][2],evals[21][0]], [transcriptHash_11[0],transcriptHash_11[1],transcriptHash_11[2],transcriptHash_11[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_12[i]; // Unused transcript values 
    }
    
    signal transcriptHash_13[12] <== Poseidon(12)([evals[21][1],evals[21][2],evals[22][0],evals[22][1],evals[22][2],evals[23][0],evals[23][1],evals[23][2]], [transcriptHash_12[0],transcriptHash_12[1],transcriptHash_12[2],transcriptHash_12[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_13[i]; // Unused transcript values 
    }
    
    signal transcriptHash_14[12] <== Poseidon(12)([evals[24][0],evals[24][1],evals[24][2],evals[25][0],evals[25][1],evals[25][2],evals[26][0],evals[26][1]], [transcriptHash_13[0],transcriptHash_13[1],transcriptHash_13[2],transcriptHash_13[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_14[i]; // Unused transcript values 
    }
    
    signal transcriptHash_15[12] <== Poseidon(12)([evals[26][2],evals[27][0],evals[27][1],evals[27][2],evals[28][0],evals[28][1],evals[28][2],evals[29][0]], [transcriptHash_14[0],transcriptHash_14[1],transcriptHash_14[2],transcriptHash_14[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_15[i]; // Unused transcript values 
    }
    
    signal transcriptHash_16[12] <== Poseidon(12)([evals[29][1],evals[29][2],evals[30][0],evals[30][1],evals[30][2],evals[31][0],evals[31][1],evals[31][2]], [transcriptHash_15[0],transcriptHash_15[1],transcriptHash_15[2],transcriptHash_15[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_16[i]; // Unused transcript values 
    }
    
    signal transcriptHash_17[12] <== Poseidon(12)([evals[32][0],evals[32][1],evals[32][2],evals[33][0],evals[33][1],evals[33][2],evals[34][0],evals[34][1]], [transcriptHash_16[0],transcriptHash_16[1],transcriptHash_16[2],transcriptHash_16[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_17[i]; // Unused transcript values 
    }
    
    signal transcriptHash_18[12] <== Poseidon(12)([evals[34][2],evals[35][0],evals[35][1],evals[35][2],evals[36][0],evals[36][1],evals[36][2],evals[37][0]], [transcriptHash_17[0],transcriptHash_17[1],transcriptHash_17[2],transcriptHash_17[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_18[i]; // Unused transcript values 
    }
    
    signal transcriptHash_19[12] <== Poseidon(12)([evals[37][1],evals[37][2],evals[38][0],evals[38][1],evals[38][2],evals[39][0],evals[39][1],evals[39][2]], [transcriptHash_18[0],transcriptHash_18[1],transcriptHash_18[2],transcriptHash_18[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_19[i]; // Unused transcript values 
    }
    
    signal transcriptHash_20[12] <== Poseidon(12)([evals[40][0],evals[40][1],evals[40][2],evals[41][0],evals[41][1],evals[41][2],evals[42][0],evals[42][1]], [transcriptHash_19[0],transcriptHash_19[1],transcriptHash_19[2],transcriptHash_19[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_20[i]; // Unused transcript values 
    }
    
    signal transcriptHash_21[12] <== Poseidon(12)([evals[42][2],0,0,0,0,0,0,0], [transcriptHash_20[0],transcriptHash_20[1],transcriptHash_20[2],transcriptHash_20[3]]);
    challengesFRI[0] <== [transcriptHash_21[0], transcriptHash_21[1], transcriptHash_21[2]];
    challengesFRI[1] <== [transcriptHash_21[3], transcriptHash_21[4], transcriptHash_21[5]];
    challengesFRISteps[0] <== [transcriptHash_21[6], transcriptHash_21[7], transcriptHash_21[8]];
    for(var i = 9; i < 12; i++){
        _ <== transcriptHash_21[i]; // Unused transcript values 
    }
    
    signal transcriptHash_22[12] <== Poseidon(12)([s1_root[0],s1_root[1],s1_root[2],s1_root[3],0,0,0,0], [transcriptHash_21[0],transcriptHash_21[1],transcriptHash_21[2],transcriptHash_21[3]]);
    challengesFRISteps[1] <== [transcriptHash_22[0], transcriptHash_22[1], transcriptHash_22[2]];
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_22[i]; // Unused transcript values 
    }
    
    signal transcriptHash_23[12] <== Poseidon(12)([s2_root[0],s2_root[1],s2_root[2],s2_root[3],0,0,0,0], [transcriptHash_22[0],transcriptHash_22[1],transcriptHash_22[2],transcriptHash_22[3]]);
    challengesFRISteps[2] <== [transcriptHash_23[0], transcriptHash_23[1], transcriptHash_23[2]];
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_23[i]; // Unused transcript values 
    }
    
    signal transcriptHash_24[12] <== Poseidon(12)([finalPol[0][0],finalPol[0][1],finalPol[0][2],finalPol[1][0],finalPol[1][1],finalPol[1][2],finalPol[2][0],finalPol[2][1]], [transcriptHash_23[0],transcriptHash_23[1],transcriptHash_23[2],transcriptHash_23[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_24[i]; // Unused transcript values 
    }
    
    signal transcriptHash_25[12] <== Poseidon(12)([finalPol[2][2],finalPol[3][0],finalPol[3][1],finalPol[3][2],finalPol[4][0],finalPol[4][1],finalPol[4][2],finalPol[5][0]], [transcriptHash_24[0],transcriptHash_24[1],transcriptHash_24[2],transcriptHash_24[3]]);
    for(var i = 4; i < 12; i++){
        _ <== transcriptHash_25[i]; // Unused transcript values 
    }
    
    signal transcriptHash_26[12] <== Poseidon(12)([finalPol[5][1],finalPol[5][2],finalPol[6][0],finalPol[6][1],finalPol[6][2],finalPol[7][0],finalPol[7][1],finalPol[7][2]], [transcriptHash_25[0],transcriptHash_25[1],transcriptHash_25[2],transcriptHash_25[3]]);
    challengesFRISteps[3] <== [transcriptHash_26[0], transcriptHash_26[1], transcriptHash_26[2]];

    queriesFRI <== calculateFRIQueries0()(challengesFRISteps[3]);
}


/*
    Verify that FRI polynomials are built properly
*/
template parallel VerifyFRI0(nBitsExt, prevStepBits, currStepBits, nextStepBits, e0) {
    var nextStep = currStepBits - nextStepBits; 
    var step = prevStepBits - currStepBits;

    signal input {binary} queriesFRI[currStepBits];
    signal input friChallenge[3];
    signal input s_vals_curr[1<< step][3];
    signal input s_vals_next[1<< nextStep][3];
    signal input {binary} enable;

    signal sx[currStepBits];
    
    sx[0] <==  e0 *( queriesFRI[0] * (invroots(prevStepBits) -1) + 1);
    for (var i=1; i< currStepBits; i++) {
        sx[i] <== sx[i-1] *  ( queriesFRI[i] * (invroots(prevStepBits -i) -1) +1);
    }
        
    // Perform an IFFT to obtain the coefficients of the polynomial given s_vals and evaluate it 
    signal coefs[1 << step][3] <== FFT(step, 3, 1)(s_vals_curr);
    signal evalXprime[3] <== [friChallenge[0] *  sx[currStepBits - 1], friChallenge[1] * sx[currStepBits - 1], friChallenge[2] *  sx[currStepBits - 1]];
    signal evalPol[3] <== EvalPol(1 << step)(coefs, evalXprime);

    signal {binary} keys_lowValues[nextStep];
    for(var i = 0; i < nextStep; i++) { keys_lowValues[i] <== queriesFRI[i + nextStepBits]; } 
    signal lowValues[3] <== TreeSelector(nextStep, 3)(s_vals_next, keys_lowValues);

    enable * (lowValues[0] - evalPol[0]) === 0;
    enable * (lowValues[1] - evalPol[1]) === 0;
    enable * (lowValues[2] - evalPol[2]) === 0;
}

/* 
    Verify that all committed polynomials are calculated correctly
*/

template parallel VerifyEvaluations0() {
    signal input challengesStage2[2][3];
    signal input challengesStage3[3][3];
    signal input challengeQ[3];
    signal input challengeXi[3];
    signal input evals[43][3];
    signal input publics[3];
    signal input {binary} enable;

    // zMul stores all the powers of z (which is stored in challengeXi) up to nBits, i.e, [z, z^2, ..., z^nBits]
    signal zMul[10][3];
    for (var i=0; i< 10 ; i++) {
        if(i==0){
            zMul[i] <== CMul()(challengeXi, challengeXi);
        } else {
            zMul[i] <== CMul()(zMul[i-1], zMul[i-1]);
        }
    }

    // Store the vanishing polynomial Zh(x) = x^nBits - 1 evaluated at z
    signal Z[3] <== [zMul[9][0] - 1, zMul[9][1], zMul[9][2]];
    signal Zh[3] <== CInv()(Z);




    // Using the evaluations committed and the challenges,
    // calculate the sum of q_i, i.e, q_0(X) + challenge * q_1(X) + challenge^2 * q_2(X) +  ... + challenge^(l-1) * q_l-1(X) evaluated at z 
    signal tmp_0[3] <== [evals[15][0] - evals[12][0], evals[15][1] - evals[12][1], evals[15][2] - evals[12][2]];
    signal tmp_1[3] <== [1 - evals[2][0], -evals[2][1], -evals[2][2]];
    signal tmp_2[3] <== CMul()(tmp_0, tmp_1);
    signal tmp_121[3] <== [tmp_2[0] * 1, tmp_2[1] * 1, tmp_2[2] * 1];
    signal tmp_3[3] <== CMul()(evals[12], evals[12]);
    signal tmp_4[3] <== CMul()(evals[14], evals[14]);
    signal tmp_122[3] <== [tmp_3[0] + tmp_4[0], tmp_3[1] + tmp_4[1], tmp_3[2] + tmp_4[2]];
    signal tmp_5[3] <== [evals[13][0] - tmp_122[0], evals[13][1] - tmp_122[1], evals[13][2] - tmp_122[2]];
    signal tmp_6[3] <== [1 - evals[2][0], -evals[2][1], -evals[2][2]];
    signal tmp_7[3] <== CMul()(tmp_5, tmp_6);
    signal tmp_123[3] <== [tmp_7[0] * 1, tmp_7[1] * 1, tmp_7[2] * 1];
    signal tmp_8[3] <== [evals[14][0] - publics[0], evals[14][1], evals[14][2]];
    signal tmp_9[3] <== CMul()(evals[1], tmp_8);
    signal tmp_124[3] <== [tmp_9[0] * 1, tmp_9[1] * 1, tmp_9[2] * 1];
    signal tmp_10[3] <== [evals[12][0] - publics[1], evals[12][1], evals[12][2]];
    signal tmp_11[3] <== CMul()(evals[1], tmp_10);
    signal tmp_125[3] <== [tmp_11[0] * 1, tmp_11[1] * 1, tmp_11[2] * 1];
    signal tmp_12[3] <== [evals[12][0] - publics[2], evals[12][1], evals[12][2]];
    signal tmp_13[3] <== CMul()(evals[2], tmp_12);
    signal tmp_126[3] <== [tmp_13[0] * 1, tmp_13[1] * 1, tmp_13[2] * 1];
    signal tmp_14[3] <== [evals[31][0] - 1, evals[31][1], evals[31][2]];
    signal tmp_127[3] <== CMul()(evals[0], tmp_14);
    signal tmp_15[3] <== CMul()(evals[30], challengesStage3[1]);
    signal tmp_16[3] <== [evals[28][0] + tmp_15[0], evals[28][1] + tmp_15[1], evals[28][2] + tmp_15[2]];
    signal tmp_17[3] <== [1 + challengesStage3[1][0], challengesStage3[1][1],  challengesStage3[1][2]];
    signal tmp_18[3] <== CMul()(challengesStage3[0], tmp_17);
    signal tmp_19[3] <== [tmp_16[0] + tmp_18[0], tmp_16[1] + tmp_18[1], tmp_16[2] + tmp_18[2]];
    signal tmp_20[3] <== CMul()(evals[29], challengesStage3[1]);
    signal tmp_21[3] <== [evals[30][0] + tmp_20[0], evals[30][1] + tmp_20[1], evals[30][2] + tmp_20[2]];
    signal tmp_22[3] <== [1 + challengesStage3[1][0], challengesStage3[1][1],  challengesStage3[1][2]];
    signal tmp_23[3] <== CMul()(challengesStage3[0], tmp_22);
    signal tmp_24[3] <== [tmp_21[0] + tmp_23[0], tmp_21[1] + tmp_23[1], tmp_21[2] + tmp_23[2]];
    signal tmp_128[3] <== CMul()(tmp_19, tmp_24);
    signal tmp_25[3] <== CMul()(evals[32], tmp_128);
    signal tmp_26[3] <== CMul()(evals[31], evals[38]);
    signal tmp_129[3] <== [tmp_25[0] - tmp_26[0], tmp_25[1] - tmp_26[1], tmp_25[2] - tmp_26[2]];
    signal tmp_27[3] <== [evals[33][0] - 1, evals[33][1], evals[33][2]];
    signal tmp_130[3] <== CMul()(evals[0], tmp_27);
    signal tmp_131[3] <== evals[20];
    signal tmp_132[3] <== evals[20];
    signal tmp_133[3] <== evals[22];
    signal tmp_28[3] <== CMul()(challengesStage3[0], evals[20]);
    signal tmp_29[3] <== [tmp_28[0] + evals[20][0], tmp_28[1] + evals[20][1], tmp_28[2] + evals[20][2]];
    signal tmp_30[3] <== [tmp_29[0] - challengesStage3[1][0], tmp_29[1] - challengesStage3[1][1], tmp_29[2] - challengesStage3[1][2]];
    signal tmp_31[3] <== CMul()(tmp_30, evals[22]);
    signal tmp_134[3] <== [tmp_31[0] + challengesStage3[1][0], tmp_31[1] + challengesStage3[1][1], tmp_31[2] + challengesStage3[1][2]];
    signal tmp_135[3] <== [tmp_134[0] + challengesStage3[2][0], tmp_134[1] + challengesStage3[2][1], tmp_134[2] + challengesStage3[2][2]];
    signal tmp_136[3] <== evals[19];
    signal tmp_137[3] <== evals[19];
    signal tmp_138[3] <== evals[21];
    signal tmp_32[3] <== CMul()(evals[19], challengesStage3[0]);
    signal tmp_33[3] <== [tmp_32[0] + evals[19][0], tmp_32[1] + evals[19][1], tmp_32[2] + evals[19][2]];
    signal tmp_34[3] <== [tmp_33[0] - challengesStage3[1][0], tmp_33[1] - challengesStage3[1][1], tmp_33[2] - challengesStage3[1][2]];
    signal tmp_35[3] <== CMul()(tmp_34, evals[21]);
    signal tmp_139[3] <== [tmp_35[0] + challengesStage3[1][0], tmp_35[1] + challengesStage3[1][1], tmp_35[2] + challengesStage3[1][2]];
    signal tmp_140[3] <== [tmp_139[0] + challengesStage3[2][0], tmp_139[1] + challengesStage3[2][1], tmp_139[2] + challengesStage3[2][2]];
    signal tmp_36[3] <== CMul()(evals[34], tmp_135);
    signal tmp_37[3] <== CMul()(evals[33], tmp_140);
    signal tmp_141[3] <== [tmp_36[0] - tmp_37[0], tmp_36[1] - tmp_37[1], tmp_36[2] - tmp_37[2]];
    signal tmp_38[3] <== [evals[35][0] - 1, evals[35][1], evals[35][2]];
    signal tmp_142[3] <== CMul()(evals[0], tmp_38);
    signal tmp_39[3] <== CMul()(evals[36], evals[39]);
    signal tmp_40[3] <== CMul()(evals[35], evals[40]);
    signal tmp_143[3] <== [tmp_39[0] - tmp_40[0], tmp_39[1] - tmp_40[1], tmp_39[2] - tmp_40[2]];
    signal tmp_144[3] <== evals[24];
    signal tmp_145[3] <== evals[25];
    signal tmp_146[3] <== CMul()(evals[24], evals[25]);
    signal tmp_147[3] <== evals[8];
    signal tmp_148[3] <== evals[10];
    signal tmp_149[3] <== evals[26];
    signal tmp_150[3] <== evals[6];
    signal tmp_41[3] <== CMul()(challengesStage2[0], evals[8]);
    signal tmp_42[3] <== [tmp_41[0] + evals[10][0], tmp_41[1] + evals[10][1], tmp_41[2] + evals[10][2]];
    signal tmp_43[3] <== CMul()(challengesStage2[0], tmp_42);
    signal tmp_44[3] <== [tmp_43[0] + evals[26][0], tmp_43[1] + evals[26][1], tmp_43[2] + evals[26][2]];
    signal tmp_45[3] <== [tmp_44[0] - challengesStage2[1][0], tmp_44[1] - challengesStage2[1][1], tmp_44[2] - challengesStage2[1][2]];
    signal tmp_46[3] <== CMul()(tmp_45, evals[6]);
    signal tmp_151[3] <== [tmp_46[0] + challengesStage2[1][0], tmp_46[1] + challengesStage2[1][1], tmp_46[2] + challengesStage2[1][2]];
    signal tmp_152[3] <== evals[23];
    signal tmp_153[3] <== evals[9];
    signal tmp_154[3] <== evals[11];
    signal tmp_155[3] <== evals[27];
    signal tmp_156[3] <== evals[7];
    signal tmp_47[3] <== CMul()(challengesStage2[0], evals[9]);
    signal tmp_48[3] <== [tmp_47[0] + evals[11][0], tmp_47[1] + evals[11][1], tmp_47[2] + evals[11][2]];
    signal tmp_49[3] <== CMul()(challengesStage2[0], tmp_48);
    signal tmp_50[3] <== [tmp_49[0] + evals[27][0], tmp_49[1] + evals[27][1], tmp_49[2] + evals[27][2]];
    signal tmp_51[3] <== [tmp_50[0] - challengesStage2[1][0], tmp_50[1] - challengesStage2[1][1], tmp_50[2] - challengesStage2[1][2]];
    signal tmp_52[3] <== CMul()(tmp_51, evals[7]);
    signal tmp_157[3] <== [tmp_52[0] + challengesStage2[1][0], tmp_52[1] + challengesStage2[1][1], tmp_52[2] + challengesStage2[1][2]];
    signal tmp_158[3] <== evals[16];
    signal tmp_159[3] <== evals[3];
    signal tmp_53[3] <== CMul()(challengesStage3[1], evals[3]);
    signal tmp_54[3] <== [evals[16][0] + tmp_53[0], evals[16][1] + tmp_53[1], evals[16][2] + tmp_53[2]];
    signal tmp_160[3] <== [tmp_54[0] + challengesStage3[0][0], tmp_54[1] + challengesStage3[0][1], tmp_54[2] + challengesStage3[0][2]];
    signal tmp_161[3] <== evals[17];
    signal tmp_162[3] <== evals[4];
    signal tmp_55[3] <== CMul()(challengesStage3[1], evals[4]);
    signal tmp_56[3] <== [evals[17][0] + tmp_55[0], evals[17][1] + tmp_55[1], evals[17][2] + tmp_55[2]];
    signal tmp_57[3] <== [tmp_56[0] + challengesStage3[0][0], tmp_56[1] + challengesStage3[0][1], tmp_56[2] + challengesStage3[0][2]];
    signal tmp_163[3] <== CMul()(tmp_160, tmp_57);
    signal tmp_164[3] <== evals[18];
    signal tmp_165[3] <== evals[5];
    signal tmp_58[3] <== CMul()(challengesStage3[1], challengeXi);
    signal tmp_59[3] <== [evals[16][0] + tmp_58[0], evals[16][1] + tmp_58[1], evals[16][2] + tmp_58[2]];
    signal tmp_166[3] <== [tmp_59[0] + challengesStage3[0][0], tmp_59[1] + challengesStage3[0][1], tmp_59[2] + challengesStage3[0][2]];
    signal tmp_60[3] <== [challengesStage3[1][0] * 12275445934081160404, challengesStage3[1][1] * 12275445934081160404, challengesStage3[1][2] * 12275445934081160404];
    signal tmp_61[3] <== CMul()(tmp_60, challengeXi);
    signal tmp_62[3] <== [evals[17][0] + tmp_61[0], evals[17][1] + tmp_61[1], evals[17][2] + tmp_61[2]];
    signal tmp_63[3] <== [tmp_62[0] + challengesStage3[0][0], tmp_62[1] + challengesStage3[0][1], tmp_62[2] + challengesStage3[0][2]];
    signal tmp_167[3] <== CMul()(tmp_166, tmp_63);
    signal tmp_64[3] <== CMul()(challengeQ, tmp_121);
    signal tmp_65[3] <== [tmp_64[0] + tmp_123[0], tmp_64[1] + tmp_123[1], tmp_64[2] + tmp_123[2]];
    signal tmp_66[3] <== CMul()(challengeQ, tmp_65);
    signal tmp_67[3] <== [tmp_66[0] + tmp_124[0], tmp_66[1] + tmp_124[1], tmp_66[2] + tmp_124[2]];
    signal tmp_68[3] <== CMul()(challengeQ, tmp_67);
    signal tmp_69[3] <== [tmp_68[0] + tmp_125[0], tmp_68[1] + tmp_125[1], tmp_68[2] + tmp_125[2]];
    signal tmp_70[3] <== CMul()(challengeQ, tmp_69);
    signal tmp_71[3] <== [tmp_70[0] + tmp_126[0], tmp_70[1] + tmp_126[1], tmp_70[2] + tmp_126[2]];
    signal tmp_72[3] <== CMul()(challengeQ, tmp_71);
    signal tmp_73[3] <== [tmp_72[0] + tmp_127[0], tmp_72[1] + tmp_127[1], tmp_72[2] + tmp_127[2]];
    signal tmp_74[3] <== CMul()(challengeQ, tmp_73);
    signal tmp_75[3] <== [tmp_74[0] + tmp_129[0], tmp_74[1] + tmp_129[1], tmp_74[2] + tmp_129[2]];
    signal tmp_76[3] <== CMul()(challengeQ, tmp_75);
    signal tmp_77[3] <== [tmp_76[0] + tmp_130[0], tmp_76[1] + tmp_130[1], tmp_76[2] + tmp_130[2]];
    signal tmp_78[3] <== CMul()(challengeQ, tmp_77);
    signal tmp_79[3] <== [tmp_78[0] + tmp_141[0], tmp_78[1] + tmp_141[1], tmp_78[2] + tmp_141[2]];
    signal tmp_80[3] <== CMul()(challengeQ, tmp_79);
    signal tmp_81[3] <== [tmp_80[0] + tmp_142[0], tmp_80[1] + tmp_142[1], tmp_80[2] + tmp_142[2]];
    signal tmp_82[3] <== CMul()(challengeQ, tmp_81);
    signal tmp_83[3] <== [tmp_82[0] + tmp_143[0], tmp_82[1] + tmp_143[1], tmp_82[2] + tmp_143[2]];
    signal tmp_84[3] <== CMul()(challengeQ, tmp_83);
    signal tmp_85[3] <== CMul()(evals[24], challengesStage2[0]);
    signal tmp_86[3] <== [tmp_85[0] + evals[25][0], tmp_85[1] + evals[25][1], tmp_85[2] + evals[25][2]];
    signal tmp_87[3] <== CMul()(tmp_86, challengesStage2[0]);
    signal tmp_88[3] <== [tmp_87[0] + tmp_146[0], tmp_87[1] + tmp_146[1], tmp_87[2] + tmp_146[2]];
    signal tmp_89[3] <== [tmp_88[0] - tmp_151[0], tmp_88[1] - tmp_151[1], tmp_88[2] - tmp_151[2]];
    signal tmp_90[3] <== CMul()(tmp_89, evals[23]);
    signal tmp_91[3] <== [tmp_90[0] + tmp_151[0], tmp_90[1] + tmp_151[1], tmp_90[2] + tmp_151[2]];
    signal tmp_92[3] <== [evals[37][0] - tmp_91[0], evals[37][1] - tmp_91[1], evals[37][2] - tmp_91[2]];
    signal tmp_93[3] <== [tmp_84[0] + tmp_92[0], tmp_84[1] + tmp_92[1], tmp_84[2] + tmp_92[2]];
    signal tmp_94[3] <== CMul()(challengeQ, tmp_93);
    signal tmp_95[3] <== [evals[37][0] + challengesStage3[0][0], evals[37][1] + challengesStage3[0][1], evals[37][2] + challengesStage3[0][2]];
    signal tmp_96[3] <== CMul()(tmp_157, challengesStage3[1]);
    signal tmp_97[3] <== [tmp_151[0] + tmp_96[0], tmp_151[1] + tmp_96[1], tmp_151[2] + tmp_96[2]];
    signal tmp_98[3] <== [1 + challengesStage3[1][0], challengesStage3[1][1],  challengesStage3[1][2]];
    signal tmp_99[3] <== CMul()(challengesStage3[0], tmp_98);
    signal tmp_100[3] <== [tmp_97[0] + tmp_99[0], tmp_97[1] + tmp_99[1], tmp_97[2] + tmp_99[2]];
    signal tmp_101[3] <== CMul()(tmp_95, tmp_100);
    signal tmp_102[3] <== [1 + challengesStage3[1][0], challengesStage3[1][1],  challengesStage3[1][2]];
    signal tmp_103[3] <== CMul()(tmp_101, tmp_102);
    signal tmp_104[3] <== [evals[38][0] - tmp_103[0], evals[38][1] - tmp_103[1], evals[38][2] - tmp_103[2]];
    signal tmp_105[3] <== [tmp_94[0] + tmp_104[0], tmp_94[1] + tmp_104[1], tmp_94[2] + tmp_104[2]];
    signal tmp_106[3] <== CMul()(challengeQ, tmp_105);
    signal tmp_107[3] <== CMul()(challengesStage3[1], evals[5]);
    signal tmp_108[3] <== [evals[18][0] + tmp_107[0], evals[18][1] + tmp_107[1], evals[18][2] + tmp_107[2]];
    signal tmp_109[3] <== [tmp_108[0] + challengesStage3[0][0], tmp_108[1] + challengesStage3[0][1], tmp_108[2] + challengesStage3[0][2]];
    signal tmp_110[3] <== CMul()(tmp_163, tmp_109);
    signal tmp_111[3] <== [evals[39][0] - tmp_110[0], evals[39][1] - tmp_110[1], evals[39][2] - tmp_110[2]];
    signal tmp_112[3] <== [tmp_106[0] + tmp_111[0], tmp_106[1] + tmp_111[1], tmp_106[2] + tmp_111[2]];
    signal tmp_113[3] <== CMul()(challengeQ, tmp_112);
    signal tmp_114[3] <== [challengesStage3[1][0] * 4756475762779100925, challengesStage3[1][1] * 4756475762779100925, challengesStage3[1][2] * 4756475762779100925];
    signal tmp_115[3] <== CMul()(tmp_114, challengeXi);
    signal tmp_116[3] <== [evals[18][0] + tmp_115[0], evals[18][1] + tmp_115[1], evals[18][2] + tmp_115[2]];
    signal tmp_117[3] <== [tmp_116[0] + challengesStage3[0][0], tmp_116[1] + challengesStage3[0][1], tmp_116[2] + challengesStage3[0][2]];
    signal tmp_118[3] <== CMul()(tmp_167, tmp_117);
    signal tmp_119[3] <== [evals[40][0] - tmp_118[0], evals[40][1] - tmp_118[1], evals[40][2] - tmp_118[2]];
    signal tmp_120[3] <== [tmp_113[0] + tmp_119[0], tmp_113[1] + tmp_119[1], tmp_113[2] + tmp_119[2]];
    signal tmp_168[3] <== CMul()(tmp_120, Zh);

    signal xAcc[2][3]; //Stores, at each step, x^i evaluated at z
    signal qStep[1][3]; // Stores the evaluations of Q_i
    signal qAcc[2][3]; // Stores the accumulate sum of Q_i

    // Note: Each Qi has degree < n. qDeg determines the number of polynomials of degree < n needed to define Q
    // Calculate Q(X) = Q1(X) + X^n*Q2(X) + X^(2n)*Q3(X) + ..... X^((qDeg-1)n)*Q(X) evaluated at z 
    for (var i=0; i< 2; i++) {
        if (i==0) {
            xAcc[0] <== [1, 0, 0];
            qAcc[0] <== evals[41+i];
        } else {
            xAcc[i] <== CMul()(xAcc[i-1], zMul[9]);
            qStep[i-1] <== CMul()(xAcc[i], evals[41+i]);
            qAcc[i][0] <== qAcc[i-1][0] + qStep[i-1][0];
            qAcc[i][1] <== qAcc[i-1][1] + qStep[i-1][1];
            qAcc[i][2] <== qAcc[i-1][2] + qStep[i-1][2];
        }
    }

    // Final Verification. Check that Q(X)*Zh(X) = sum of linear combination of q_i, which is stored at tmp_168 
    enable * (tmp_168[0] - qAcc[1][0]) === 0;
    enable * (tmp_168[1] - qAcc[1][1]) === 0;
    enable * (tmp_168[2] - qAcc[1][2]) === 0;
}

/*  Calculate FRI polinomial */
template parallel CalculateFRIPolValue0() {
    signal input {binary} queriesFRI[11];
    signal input challengeXi[3];
    signal input challengesFRI[2][3];
    signal input evals[43][3];
 
    signal input tree1[15];
 
    signal input tree2[6];
 
    signal input tree3[21];
    signal input tree4[6];
    signal input consts[9];
    
    signal output queryVals[3];

    // Map the s0_vals so that they are converted either into single vars (if they belong to base field) or arrays of 3 elements (if 
    // they belong to the extended field). 
    component mapValues = MapValues0();
 
    mapValues.vals1 <== tree1;
 
    mapValues.vals2 <== tree2;
 
    mapValues.vals3 <== tree3;
    mapValues.vals4 <== tree4;

    signal xacc[11];
    xacc[0] <== queriesFRI[0]*(7 * roots(11)-7) + 7;
    for (var i=1; i<11; i++) {
        xacc[i] <== xacc[i-1] * ( queriesFRI[i]*(roots(11 - i) - 1) +1);
    }

    signal xDivXSubXi[2][3];

    signal den0inv[3] <== CInv()([xacc[10] - 1 * challengeXi[0], - 1 * challengeXi[1], - 1 * challengeXi[2]]);
    xDivXSubXi[0] <== [xacc[10] * den0inv[0], xacc[10] * den0inv[1],  xacc[10] * den0inv[2]];
    signal den1inv[3] <== CInv()([xacc[10] - 1 * roots(10) * challengeXi[0], - 1 * roots(10) * challengeXi[1], - 1 * roots(10) * challengeXi[2]]);
    xDivXSubXi[1] <== [xacc[10] * den1inv[0], xacc[10] * den1inv[1],  xacc[10] * den1inv[2]];

    signal tmp_0[3] <== [consts[0] - evals[0][0], -evals[0][1], -evals[0][2]];
    signal tmp_1[3] <== CMul()(tmp_0, challengesFRI[1]);
    signal tmp_2[3] <== [consts[1] - evals[1][0], -evals[1][1], -evals[1][2]];
    signal tmp_3[3] <== [tmp_1[0] + tmp_2[0], tmp_1[1] + tmp_2[1], tmp_1[2] + tmp_2[2]];
    signal tmp_4[3] <== CMul()(tmp_3, challengesFRI[1]);
    signal tmp_5[3] <== [consts[2] - evals[2][0], -evals[2][1], -evals[2][2]];
    signal tmp_6[3] <== [tmp_4[0] + tmp_5[0], tmp_4[1] + tmp_5[1], tmp_4[2] + tmp_5[2]];
    signal tmp_7[3] <== CMul()(tmp_6, challengesFRI[1]);
    signal tmp_8[3] <== [consts[3] - evals[3][0], -evals[3][1], -evals[3][2]];
    signal tmp_9[3] <== [tmp_7[0] + tmp_8[0], tmp_7[1] + tmp_8[1], tmp_7[2] + tmp_8[2]];
    signal tmp_10[3] <== CMul()(tmp_9, challengesFRI[1]);
    signal tmp_11[3] <== [consts[4] - evals[4][0], -evals[4][1], -evals[4][2]];
    signal tmp_12[3] <== [tmp_10[0] + tmp_11[0], tmp_10[1] + tmp_11[1], tmp_10[2] + tmp_11[2]];
    signal tmp_13[3] <== CMul()(tmp_12, challengesFRI[1]);
    signal tmp_14[3] <== [consts[5] - evals[5][0], -evals[5][1], -evals[5][2]];
    signal tmp_15[3] <== [tmp_13[0] + tmp_14[0], tmp_13[1] + tmp_14[1], tmp_13[2] + tmp_14[2]];
    signal tmp_16[3] <== CMul()(tmp_15, challengesFRI[1]);
    signal tmp_17[3] <== [consts[6] - evals[6][0], -evals[6][1], -evals[6][2]];
    signal tmp_18[3] <== [tmp_16[0] + tmp_17[0], tmp_16[1] + tmp_17[1], tmp_16[2] + tmp_17[2]];
    signal tmp_19[3] <== CMul()(tmp_18, challengesFRI[1]);
    signal tmp_20[3] <== [consts[7] - evals[8][0], -evals[8][1], -evals[8][2]];
    signal tmp_21[3] <== [tmp_19[0] + tmp_20[0], tmp_19[1] + tmp_20[1], tmp_19[2] + tmp_20[2]];
    signal tmp_22[3] <== CMul()(tmp_21, challengesFRI[1]);
    signal tmp_23[3] <== [consts[8] - evals[10][0], -evals[10][1], -evals[10][2]];
    signal tmp_24[3] <== [tmp_22[0] + tmp_23[0], tmp_22[1] + tmp_23[1], tmp_22[2] + tmp_23[2]];
    signal tmp_25[3] <== CMul()(tmp_24, challengesFRI[1]);
    signal tmp_26[3] <== [mapValues.tree1_0 - evals[12][0], -evals[12][1], -evals[12][2]];
    signal tmp_27[3] <== [tmp_25[0] + tmp_26[0], tmp_25[1] + tmp_26[1], tmp_25[2] + tmp_26[2]];
    signal tmp_28[3] <== CMul()(tmp_27, challengesFRI[1]);
    signal tmp_29[3] <== [mapValues.tree1_1 - evals[14][0], -evals[14][1], -evals[14][2]];
    signal tmp_30[3] <== [tmp_28[0] + tmp_29[0], tmp_28[1] + tmp_29[1], tmp_28[2] + tmp_29[2]];
    signal tmp_31[3] <== CMul()(tmp_30, challengesFRI[1]);
    signal tmp_32[3] <== [mapValues.tree1_2 - evals[16][0], -evals[16][1], -evals[16][2]];
    signal tmp_33[3] <== [tmp_31[0] + tmp_32[0], tmp_31[1] + tmp_32[1], tmp_31[2] + tmp_32[2]];
    signal tmp_34[3] <== CMul()(tmp_33, challengesFRI[1]);
    signal tmp_35[3] <== [mapValues.tree1_3 - evals[17][0], -evals[17][1], -evals[17][2]];
    signal tmp_36[3] <== [tmp_34[0] + tmp_35[0], tmp_34[1] + tmp_35[1], tmp_34[2] + tmp_35[2]];
    signal tmp_37[3] <== CMul()(tmp_36, challengesFRI[1]);
    signal tmp_38[3] <== [mapValues.tree1_4 - evals[18][0], -evals[18][1], -evals[18][2]];
    signal tmp_39[3] <== [tmp_37[0] + tmp_38[0], tmp_37[1] + tmp_38[1], tmp_37[2] + tmp_38[2]];
    signal tmp_40[3] <== CMul()(tmp_39, challengesFRI[1]);
    signal tmp_41[3] <== [mapValues.tree1_7 - evals[19][0], -evals[19][1], -evals[19][2]];
    signal tmp_42[3] <== [tmp_40[0] + tmp_41[0], tmp_40[1] + tmp_41[1], tmp_40[2] + tmp_41[2]];
    signal tmp_43[3] <== CMul()(tmp_42, challengesFRI[1]);
    signal tmp_44[3] <== [mapValues.tree1_8 - evals[20][0], -evals[20][1], -evals[20][2]];
    signal tmp_45[3] <== [tmp_43[0] + tmp_44[0], tmp_43[1] + tmp_44[1], tmp_43[2] + tmp_44[2]];
    signal tmp_46[3] <== CMul()(tmp_45, challengesFRI[1]);
    signal tmp_47[3] <== [mapValues.tree1_9 - evals[21][0], -evals[21][1], -evals[21][2]];
    signal tmp_48[3] <== [tmp_46[0] + tmp_47[0], tmp_46[1] + tmp_47[1], tmp_46[2] + tmp_47[2]];
    signal tmp_49[3] <== CMul()(tmp_48, challengesFRI[1]);
    signal tmp_50[3] <== [mapValues.tree1_10 - evals[22][0], -evals[22][1], -evals[22][2]];
    signal tmp_51[3] <== [tmp_49[0] + tmp_50[0], tmp_49[1] + tmp_50[1], tmp_49[2] + tmp_50[2]];
    signal tmp_52[3] <== CMul()(tmp_51, challengesFRI[1]);
    signal tmp_53[3] <== [mapValues.tree1_11 - evals[23][0], -evals[23][1], -evals[23][2]];
    signal tmp_54[3] <== [tmp_52[0] + tmp_53[0], tmp_52[1] + tmp_53[1], tmp_52[2] + tmp_53[2]];
    signal tmp_55[3] <== CMul()(tmp_54, challengesFRI[1]);
    signal tmp_56[3] <== [mapValues.tree1_12 - evals[24][0], -evals[24][1], -evals[24][2]];
    signal tmp_57[3] <== [tmp_55[0] + tmp_56[0], tmp_55[1] + tmp_56[1], tmp_55[2] + tmp_56[2]];
    signal tmp_58[3] <== CMul()(tmp_57, challengesFRI[1]);
    signal tmp_59[3] <== [mapValues.tree1_14 - evals[26][0], -evals[26][1], -evals[26][2]];
    signal tmp_60[3] <== [tmp_58[0] + tmp_59[0], tmp_58[1] + tmp_59[1], tmp_58[2] + tmp_59[2]];
    signal tmp_61[3] <== CMul()(tmp_60, challengesFRI[1]);
    signal tmp_62[3] <== [mapValues.tree2_0[0] - evals[28][0], mapValues.tree2_0[1] - evals[28][1], mapValues.tree2_0[2] - evals[28][2]];
    signal tmp_63[3] <== [tmp_61[0] + tmp_62[0], tmp_61[1] + tmp_62[1], tmp_61[2] + tmp_62[2]];
    signal tmp_64[3] <== CMul()(tmp_63, challengesFRI[1]);
    signal tmp_65[3] <== [mapValues.tree2_1[0] - evals[30][0], mapValues.tree2_1[1] - evals[30][1], mapValues.tree2_1[2] - evals[30][2]];
    signal tmp_66[3] <== [tmp_64[0] + tmp_65[0], tmp_64[1] + tmp_65[1], tmp_64[2] + tmp_65[2]];
    signal tmp_67[3] <== CMul()(tmp_66, challengesFRI[1]);
    signal tmp_68[3] <== [mapValues.tree3_0[0] - evals[31][0], mapValues.tree3_0[1] - evals[31][1], mapValues.tree3_0[2] - evals[31][2]];
    signal tmp_69[3] <== [tmp_67[0] + tmp_68[0], tmp_67[1] + tmp_68[1], tmp_67[2] + tmp_68[2]];
    signal tmp_70[3] <== CMul()(tmp_69, challengesFRI[1]);
    signal tmp_71[3] <== [mapValues.tree3_1[0] - evals[33][0], mapValues.tree3_1[1] - evals[33][1], mapValues.tree3_1[2] - evals[33][2]];
    signal tmp_72[3] <== [tmp_70[0] + tmp_71[0], tmp_70[1] + tmp_71[1], tmp_70[2] + tmp_71[2]];
    signal tmp_73[3] <== CMul()(tmp_72, challengesFRI[1]);
    signal tmp_74[3] <== [mapValues.tree3_2[0] - evals[35][0], mapValues.tree3_2[1] - evals[35][1], mapValues.tree3_2[2] - evals[35][2]];
    signal tmp_75[3] <== [tmp_73[0] + tmp_74[0], tmp_73[1] + tmp_74[1], tmp_73[2] + tmp_74[2]];
    signal tmp_76[3] <== CMul()(tmp_75, challengesFRI[1]);
    signal tmp_77[3] <== [mapValues.tree3_3[0] - evals[37][0], mapValues.tree3_3[1] - evals[37][1], mapValues.tree3_3[2] - evals[37][2]];
    signal tmp_78[3] <== [tmp_76[0] + tmp_77[0], tmp_76[1] + tmp_77[1], tmp_76[2] + tmp_77[2]];
    signal tmp_79[3] <== CMul()(tmp_78, challengesFRI[1]);
    signal tmp_80[3] <== [mapValues.tree3_4[0] - evals[38][0], mapValues.tree3_4[1] - evals[38][1], mapValues.tree3_4[2] - evals[38][2]];
    signal tmp_81[3] <== [tmp_79[0] + tmp_80[0], tmp_79[1] + tmp_80[1], tmp_79[2] + tmp_80[2]];
    signal tmp_82[3] <== CMul()(tmp_81, challengesFRI[1]);
    signal tmp_83[3] <== [mapValues.tree3_5[0] - evals[39][0], mapValues.tree3_5[1] - evals[39][1], mapValues.tree3_5[2] - evals[39][2]];
    signal tmp_84[3] <== [tmp_82[0] + tmp_83[0], tmp_82[1] + tmp_83[1], tmp_82[2] + tmp_83[2]];
    signal tmp_85[3] <== CMul()(tmp_84, challengesFRI[1]);
    signal tmp_86[3] <== [mapValues.tree3_6[0] - evals[40][0], mapValues.tree3_6[1] - evals[40][1], mapValues.tree3_6[2] - evals[40][2]];
    signal tmp_87[3] <== [tmp_85[0] + tmp_86[0], tmp_85[1] + tmp_86[1], tmp_85[2] + tmp_86[2]];
    signal tmp_88[3] <== CMul()(tmp_87, challengesFRI[1]);
    signal tmp_89[3] <== [mapValues.tree4_0[0] - evals[41][0], mapValues.tree4_0[1] - evals[41][1], mapValues.tree4_0[2] - evals[41][2]];
    signal tmp_90[3] <== [tmp_88[0] + tmp_89[0], tmp_88[1] + tmp_89[1], tmp_88[2] + tmp_89[2]];
    signal tmp_91[3] <== CMul()(tmp_90, challengesFRI[1]);
    signal tmp_92[3] <== [mapValues.tree4_1[0] - evals[42][0], mapValues.tree4_1[1] - evals[42][1], mapValues.tree4_1[2] - evals[42][2]];
    signal tmp_93[3] <== [tmp_91[0] + tmp_92[0], tmp_91[1] + tmp_92[1], tmp_91[2] + tmp_92[2]];
    signal tmp_94[3] <== CMul()(tmp_93, xDivXSubXi[0]);
    signal tmp_95[3] <== CMul()(challengesFRI[0], tmp_94);
    signal tmp_96[3] <== [consts[6] - evals[7][0], -evals[7][1], -evals[7][2]];
    signal tmp_97[3] <== CMul()(tmp_96, challengesFRI[1]);
    signal tmp_98[3] <== [consts[7] - evals[9][0], -evals[9][1], -evals[9][2]];
    signal tmp_99[3] <== [tmp_97[0] + tmp_98[0], tmp_97[1] + tmp_98[1], tmp_97[2] + tmp_98[2]];
    signal tmp_100[3] <== CMul()(tmp_99, challengesFRI[1]);
    signal tmp_101[3] <== [consts[8] - evals[11][0], -evals[11][1], -evals[11][2]];
    signal tmp_102[3] <== [tmp_100[0] + tmp_101[0], tmp_100[1] + tmp_101[1], tmp_100[2] + tmp_101[2]];
    signal tmp_103[3] <== CMul()(tmp_102, challengesFRI[1]);
    signal tmp_104[3] <== [mapValues.tree1_0 - evals[13][0], -evals[13][1], -evals[13][2]];
    signal tmp_105[3] <== [tmp_103[0] + tmp_104[0], tmp_103[1] + tmp_104[1], tmp_103[2] + tmp_104[2]];
    signal tmp_106[3] <== CMul()(tmp_105, challengesFRI[1]);
    signal tmp_107[3] <== [mapValues.tree1_1 - evals[15][0], -evals[15][1], -evals[15][2]];
    signal tmp_108[3] <== [tmp_106[0] + tmp_107[0], tmp_106[1] + tmp_107[1], tmp_106[2] + tmp_107[2]];
    signal tmp_109[3] <== CMul()(tmp_108, challengesFRI[1]);
    signal tmp_110[3] <== [mapValues.tree1_13 - evals[25][0], -evals[25][1], -evals[25][2]];
    signal tmp_111[3] <== [tmp_109[0] + tmp_110[0], tmp_109[1] + tmp_110[1], tmp_109[2] + tmp_110[2]];
    signal tmp_112[3] <== CMul()(tmp_111, challengesFRI[1]);
    signal tmp_113[3] <== [mapValues.tree1_14 - evals[27][0], -evals[27][1], -evals[27][2]];
    signal tmp_114[3] <== [tmp_112[0] + tmp_113[0], tmp_112[1] + tmp_113[1], tmp_112[2] + tmp_113[2]];
    signal tmp_115[3] <== CMul()(tmp_114, challengesFRI[1]);
    signal tmp_116[3] <== [mapValues.tree2_0[0] - evals[29][0], mapValues.tree2_0[1] - evals[29][1], mapValues.tree2_0[2] - evals[29][2]];
    signal tmp_117[3] <== [tmp_115[0] + tmp_116[0], tmp_115[1] + tmp_116[1], tmp_115[2] + tmp_116[2]];
    signal tmp_118[3] <== CMul()(tmp_117, challengesFRI[1]);
    signal tmp_119[3] <== [mapValues.tree3_0[0] - evals[32][0], mapValues.tree3_0[1] - evals[32][1], mapValues.tree3_0[2] - evals[32][2]];
    signal tmp_120[3] <== [tmp_118[0] + tmp_119[0], tmp_118[1] + tmp_119[1], tmp_118[2] + tmp_119[2]];
    signal tmp_121[3] <== CMul()(tmp_120, challengesFRI[1]);
    signal tmp_122[3] <== [mapValues.tree3_1[0] - evals[34][0], mapValues.tree3_1[1] - evals[34][1], mapValues.tree3_1[2] - evals[34][2]];
    signal tmp_123[3] <== [tmp_121[0] + tmp_122[0], tmp_121[1] + tmp_122[1], tmp_121[2] + tmp_122[2]];
    signal tmp_124[3] <== CMul()(tmp_123, challengesFRI[1]);
    signal tmp_125[3] <== [mapValues.tree3_2[0] - evals[36][0], mapValues.tree3_2[1] - evals[36][1], mapValues.tree3_2[2] - evals[36][2]];
    signal tmp_126[3] <== [tmp_124[0] + tmp_125[0], tmp_124[1] + tmp_125[1], tmp_124[2] + tmp_125[2]];
    signal tmp_127[3] <== CMul()(tmp_126, xDivXSubXi[1]);
    signal tmp_128[3] <== [tmp_95[0] + tmp_127[0], tmp_95[1] + tmp_127[1], tmp_95[2] + tmp_127[2]];

    queryVals[0] <== tmp_128[0];
    queryVals[1] <== tmp_128[1];
    queryVals[2] <== tmp_128[2];
}

/* 
    Verify that the initial FRI polynomial, which is the lineal combination of the committed polynomials
    during the STARK phases, is built properly
*/
template parallel VerifyQuery0(currStepBits, nextStepBits) {
    var nextStep = currStepBits - nextStepBits; 
    signal input {binary} queriesFRI[11];
    signal input queryVals[3];
    signal input s1_vals[1 << nextStep][3];
    signal input {binary} enable;
    
    signal {binary} s0_keys_lowValues[nextStep];
    for(var i = 0; i < nextStep; i++) {
        s0_keys_lowValues[i] <== queriesFRI[i + nextStepBits];
    }

    for(var i = 0; i < nextStepBits; i++) {
        _ <== queriesFRI[i];
    }
   
    signal lowValues[3] <== TreeSelector(nextStep, 3)(s1_vals, s0_keys_lowValues);

    enable * (lowValues[0] - queryVals[0]) === 0;
    enable * (lowValues[1] - queryVals[1]) === 0;
    enable * (lowValues[2] - queryVals[2]) === 0;
}

// Polynomials can either have dimension 1 (if they are defined in the base field) or dimension 3 (if they are defined in the 
// extended field). In general, all initial polynomials (constants and tr) will have dim 1 and the other ones such as Z (grand product),
// Q (quotient) or h_i (plookup) will have dim 3.
// This function processes the values, which are stored in an array vals[n] and splits them in multiple signals of size 1 (vals_i) 
// or 3 (vals_i[3]) depending on its dimension.
template MapValues0() {
 
    signal input vals1[15];
 
    signal input vals2[6];
 
    signal input vals3[21];
    signal input vals4[6];

    signal output tree1_0;
    signal output tree1_1;
    signal output tree1_2;
    signal output tree1_3;
    signal output tree1_4;
    signal output tree1_5;
    signal output tree1_6;
    signal output tree1_7;
    signal output tree1_8;
    signal output tree1_9;
    signal output tree1_10;
    signal output tree1_11;
    signal output tree1_12;
    signal output tree1_13;
    signal output tree1_14;
    signal output tree2_0[3];
    signal output tree2_1[3];
    signal output tree3_0[3];
    signal output tree3_1[3];
    signal output tree3_2[3];
    signal output tree3_3[3];
    signal output tree3_4[3];
    signal output tree3_5[3];
    signal output tree3_6[3];
    signal output tree4_0[3];
    signal output tree4_1[3];

    tree1_0 <== vals1[0];
    tree1_1 <== vals1[1];
    tree1_2 <== vals1[2];
    tree1_3 <== vals1[3];
    tree1_4 <== vals1[4];
    tree1_5 <== vals1[5];
    tree1_6 <== vals1[6];
    tree1_7 <== vals1[7];
    tree1_8 <== vals1[8];
    tree1_9 <== vals1[9];
    tree1_10 <== vals1[10];
    tree1_11 <== vals1[11];
    tree1_12 <== vals1[12];
    tree1_13 <== vals1[13];
    tree1_14 <== vals1[14];
    tree2_0 <== [vals2[0],vals2[1] , vals2[2]];
    tree2_1 <== [vals2[3],vals2[4] , vals2[5]];
    tree3_0 <== [vals3[0],vals3[1] , vals3[2]];
    tree3_1 <== [vals3[3],vals3[4] , vals3[5]];
    tree3_2 <== [vals3[6],vals3[7] , vals3[8]];
    tree3_3 <== [vals3[9],vals3[10] , vals3[11]];
    tree3_4 <== [vals3[12],vals3[13] , vals3[14]];
    tree3_5 <== [vals3[15],vals3[16] , vals3[17]];
    tree3_6 <== [vals3[18],vals3[19] , vals3[20]];
    tree4_0 <== [vals4[0],vals4[1] , vals4[2]];
    tree4_1 <== [vals4[3],vals4[4] , vals4[5]];
}

template parallel VerifyFinalPol0() {
    ///////
    // Check Degree last pol
    ///////
    signal input finalPol[8][3];
    signal input {binary} enable;
    
    // Calculate the IFFT to get the coefficients of finalPol 
    signal lastIFFT[8][3] <== FFT(3, 3, 1)(finalPol);

    // Check that the degree of the final polynomial is bounded by the degree defined in the last step of the folding
    for (var k= 4; k< 8; k++) {
        for (var e=0; e<3; e++) {
            enable * lastIFFT[k][e] === 0;
        }
    }
    
    // The coefficients of lower degree can have any value
    for (var k= 0; k < 4; k++) {
        _ <== lastIFFT[k];
    }
}

template StarkVerifier0() {
    signal input publics[3]; // publics polynomials
    signal input root1[4]; // Merkle tree root of stage 1
    signal input root2[4]; // Merkle tree root of stage 2
    signal input root3[4]; // Merkle tree root of stage 3
    signal input root4[4]; // Merkle tree root of the evaluations of the quotient Q1 and Q2 polynomials

    signal rootC[4] <== [1586467561057753308,1229990203770229397,10559924528244357123,6072090729782730028 ]; // Merkle tree root of the evaluations of constant polynomials

    signal input evals[43][3]; // Evaluations of the set polynomials at a challenge value z and gz

    // Leaves values of the merkle tree used to check all the queries
 
    signal input s0_vals1[8][15];
 
    signal input s0_vals2[8][6];
 
    signal input s0_vals3[8][21];
                                       
    signal input s0_vals4[8][6];
    signal input s0_valsC[8][9];

    // Merkle proofs for each of the evaluations
 
    signal input s0_siblings1[8][11][4];
 
    signal input s0_siblings2[8][11][4];
 
    signal input s0_siblings3[8][11][4];
 
    signal input s0_siblings4[8][11][4];
    signal input s0_siblingsC[8][11][4];

    // Contains the root of the original polynomial and all the intermediate FRI polynomials except for the last step
    signal input s1_root[4];
    signal input s2_root[4];

    // For each intermediate FRI polynomial and the last one, we store at vals the values needed to check the queries.
    // Given a query r,  the verifier needs b points to check it out, being b = 2^u, where u is the difference between two consecutive step
    // and the sibling paths for each query.
    signal input s1_vals[8][48];
    signal input s1_siblings[8][7][4];
    signal input s2_vals[8][48];
    signal input s2_siblings[8][3][4];

    // Evaluations of the final FRI polynomial over a set of points of size bounded its degree
    signal input finalPol[8][3];

    signal {binary} enabled;
    enabled <== 1;

    signal queryVals[8][3];

    signal challengesStage2[2][3];
    signal challengesStage3[3][3];

    signal challengeQ[3];
    signal challengeXi[3];
    signal challengesFRI[2][3];


    // challengesFRISteps contains the random value provided by the verifier at each step of the folding so that 
    // the prover can commit the polynomial.
    // Remember that, when folding, the prover does as follows: f0 = g_0 + X*g_1 + ... + (X^b)*g_b and then the 
    // verifier provides a random X so that the prover can commit it. This value is stored here.
    signal challengesFRISteps[4][3];

    // Challenges from which we derive all the queries
    signal {binary} queriesFRI[8][11];


    ///////////
    // Calculate challenges, challengesFRISteps and queriesFRI
    ///////////

 
    (challengesStage2,challengesStage3,challengeQ,challengeXi,challengesFRI,challengesFRISteps,queriesFRI) <== Transcript0()(publics,rootC,root1,root2,root3,root4,evals, s1_root,s2_root,finalPol);


    ///////////
    // Check constraints polynomial in the evaluation point
    ///////////

 

    VerifyEvaluations0()(challengesStage2, challengesStage3, challengeQ, challengeXi, evals, publics, enabled);

    ///////////
    // Preprocess s_i vals
    ///////////

    // Preprocess the s_i vals given as inputs so that we can use anonymous components.
    // Two different processings are done:
    // For s0_vals, the arrays are transposed so that they fit MerkleHash template
    // For (s_i)_vals, the values are passed all together in a single array of length nVals*3. We convert them to vals[nVals][3]
 
    var s0_vals1_p[8][15][1];
 
    var s0_vals2_p[8][6][1];
 
    var s0_vals3_p[8][21][1];
 
    var s0_vals4_p[8][6][1];
    var s0_valsC_p[8][9][1];
    var s0_vals_p[8][1][3]; 
    var s1_vals_p[8][16][3]; 
    var s2_vals_p[8][16][3]; 

    for (var q=0; q<8; q++) {
        // Preprocess vals for the initial FRI polynomial
 
        for (var i = 0; i < 15; i++) {
            s0_vals1_p[q][i][0] = s0_vals1[q][i];
        }
 
        for (var i = 0; i < 6; i++) {
            s0_vals2_p[q][i][0] = s0_vals2[q][i];
        }
 
        for (var i = 0; i < 21; i++) {
            s0_vals3_p[q][i][0] = s0_vals3[q][i];
        }
 
        for (var i = 0; i < 6; i++) {
            s0_vals4_p[q][i][0] = s0_vals4[q][i];
        }
        for (var i = 0; i < 9; i++) {
            s0_valsC_p[q][i][0] = s0_valsC[q][i];
        }

        // Preprocess vals for each folded polynomial
        for(var e=0; e < 3; e++) {
            for(var c=0; c < 16; c++) {
                s1_vals_p[q][c][e] = s1_vals[q][c*3+e];
            }
            for(var c=0; c < 16; c++) {
                s2_vals_p[q][c][e] = s2_vals[q][c*3+e];
            }
        }
    }
    
    ///////////
    // Verify Merkle Roots
    ///////////

    //Calculate merkle root for s0 vals
 
    for (var q=0; q<8; q++) {
        VerifyMerkleHash(1, 15, 2048)(s0_vals1_p[q], s0_siblings1[q], queriesFRI[q], root1, enabled);
    }
 
    for (var q=0; q<8; q++) {
        VerifyMerkleHash(1, 6, 2048)(s0_vals2_p[q], s0_siblings2[q], queriesFRI[q], root2, enabled);
    }
 
    for (var q=0; q<8; q++) {
        VerifyMerkleHash(1, 21, 2048)(s0_vals3_p[q], s0_siblings3[q], queriesFRI[q], root3, enabled);
    }

    for (var q=0; q<8; q++) {
        VerifyMerkleHash(1, 6, 2048)(s0_vals4_p[q], s0_siblings4[q], queriesFRI[q], root4, enabled);
    }

    for (var q=0; q<8; q++) {
        VerifyMerkleHash(1, 9, 2048)(s0_valsC_p[q], s0_siblingsC[q], queriesFRI[q], rootC, enabled);                                    
    }
    signal {binary} s1_keys_merkle[8][7];
    for (var q=0; q<8; q++) {
        // Calculate merkle root for s1 vals
        for(var i = 0; i < 7; i++) { s1_keys_merkle[q][i] <== queriesFRI[q][i]; }
        VerifyMerkleHash(3, 16, 128)(s1_vals_p[q], s1_siblings[q], s1_keys_merkle[q], s1_root, enabled);
    }
    signal {binary} s2_keys_merkle[8][3];
    for (var q=0; q<8; q++) {
        // Calculate merkle root for s2 vals
        for(var i = 0; i < 3; i++) { s2_keys_merkle[q][i] <== queriesFRI[q][i]; }
        VerifyMerkleHash(3, 16, 8)(s2_vals_p[q], s2_siblings[q], s2_keys_merkle[q], s2_root, enabled);
    }
        

    ///////////
    // Calculate FRI Polinomial
    ///////////
    
    for (var q=0; q<8; q++) {
        // Reconstruct FRI polinomial from evaluations
        queryVals[q] <== CalculateFRIPolValue0()(queriesFRI[q], challengeXi, challengesFRI, evals, s0_vals1[q], s0_vals2[q], s0_vals3[q], s0_vals4[q], s0_valsC[q]);
    }

    ///////////
    // Verify FRI Polinomial
    ///////////
    signal {binary} s1_queriesFRI[8][7];
    signal {binary} s2_queriesFRI[8][3];

    for (var q=0; q<8; q++) {
      
        // Verify that the query is properly constructed. This is done by checking that the linear combination of the set of 
        // polynomials committed during the different rounds evaluated at z matches with the commitment of the FRI polynomial
        VerifyQuery0(11, 7)(queriesFRI[q], queryVals[q], s1_vals_p[q], enabled);

        ///////////
        // Verify FRI construction
        ///////////

        // For each folding level we need to check that the polynomial is properly constructed
        // Remember that if the step between polynomials is b = 2^l, the next polynomial p_(i+1) will have degree deg(p_i) / b

        // Check S1
        for(var i = 0; i < 7; i++) { s1_queriesFRI[q][i] <== queriesFRI[q][i]; }  
        VerifyFRI0(11, 11, 7, 3, 2635249152773512046)(s1_queriesFRI[q], challengesFRISteps[1], s1_vals_p[q], s2_vals_p[q], enabled);

        // Check S2
        for(var i = 0; i < 3; i++) { s2_queriesFRI[q][i] <== queriesFRI[q][i]; }  
        VerifyFRI0(11, 7, 3, 0, 11131999729878195124)(s2_queriesFRI[q], challengesFRISteps[2], s2_vals_p[q], finalPol, enabled);
    }

    VerifyFinalPol0()(finalPol, enabled);
}
    
component main {public [publics]}= StarkVerifier0();
