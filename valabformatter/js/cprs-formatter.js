/**
 * CPRS Lab Formatter - Main
 * 
 * Main formatting logic for VA CPRS lab data
 * Requires cprs-utils.js to be loaded first
 * 
 * @author Matthew Segar, MD (Original)
 * @updated March 13, 2025
 */

// Main function to format CPRS lab data
function formatLabData() {
    var inputText = document.forms["data1"]["edtData"].value;
    
    // Check if input is empty
    if (!inputText.trim()) {
      alert("Please paste your CPRS lab data into the text area first.");
      return;
    }
    
    // Parse the lab data
    ld = cprsUtils.parseLabData(inputText);
    
    if (!ld) {
      // If data is already formatted, silently return
      if (cprsUtils.isAlreadyFormatted(inputText)) {
        return;
      }
      
      // Otherwise, alert the user about the error
      alert("No lab data could be found in the input. Please ensure you've pasted data from CPRS with lab results that include site codes like [580].");
      return;
    }
    
    // Generate the formatted output
    var formattedOutput = generateFormattedOutput();
    
    // Update the text area with formatted data
    document.forms["data1"]["edtData"].value = formattedOutput;
  }
  
  /**
   * Generate the formatted output text from the parsed lab data
   * @returns {string} The formatted lab report
   */
  function generateFormattedOutput() {
    let output = "";
    
    // Generate CBC (Complete Blood Count)
    output += generateCBCOutput();
    
    // Generate BMP (Basic Metabolic Panel)
    output += generateBMPOutput();
    
    // Generate CMP (Comprehensive Metabolic Panel)
    output += generateCMPOutput();
    
    // Add important values at the top
    output += generateTopPriorityOutput();
    
    // Generate ABG (Arterial Blood Gas) output
    output += generateABGOutput();
    
    // Generate output for remaining labs
    output += generateRemainingLabsOutput();
    
    // Generate urinalysis output
    output += generateUrinalysisOutput();
    
    // Generate calculated values
    output += generateCalculatedValues();
    
    return output;
  }
  
  /**
   * Generate CBC (Complete Blood Count) output
   * @returns {string} Formatted CBC section
   */
  function generateCBCOutput() {
    if (!("WBC" in ld)) {
      return "";
    }
    
    var platelets = ld["PLATELET COUNT"] || ld["PLATELETS"];
    var hemoglobin = ld["HGB"] || ld["HEMOGLOBIN"];
    var hematocrit = ld["HCT"] || ld["HEMATOCRIT"];
    
    var cbc2 = ld["WBC"] + " ------ " + Math.round(parseFloat(platelets));
    var cbc1 = cprsUtils.replicate(" ", ld["WBC"].toString().length) + "\\ " + hemoglobin + " /";
    var cbc0 = cprsUtils.replicate(" ", cbc1.length) + ld["MCV"];
    var cbc3 = cprsUtils.replicate(" ", ld["WBC"].toString().length) + "/ " + hematocrit + " \\";
    
    return cbc0 + "\n" + cbc1 + "\n" + cbc2 + "\n" + cbc3 + "\n\n";
  }
  
  /**
   * Generate BMP (Basic Metabolic Panel) output
   * @returns {string} Formatted BMP section
   */
  function generateBMPOutput() {
    if (!("SODIUM" in ld)) {
      return "";
    }
  
    var bun = ld["UREA NITROGEN,BLOOD"] || ld["UREA NITROGEN (BUN)"];
    var co2 = ld["CO2"] || ld["CARBON DIOXIDE CO2"];
    
    // Since values are already clean, we can use them directly
    var sodiumValue = parseFloat(ld["SODIUM"]);
    var chlorideValue = parseFloat(ld["CHLORIDE"]);
    var co2Value = parseFloat(co2);
    var glucoseValue = parseFloat(ld["GLUCOSE"]);
    
    // Calculate anion gap using the numeric values
    var calculatedAnionGap = Math.round(sodiumValue - (chlorideValue + co2Value));
    
    // Use calculated anion gap if not provided in lab data
    var anionGap = ld["ANION GAP,CALC."] || calculatedAnionGap;
    
    var bmp1 = cprsUtils.pad(ld["SODIUM"], 5) + " | " + cprsUtils.pad(ld["CHLORIDE"], 5) + " | " + cprsUtils.pad(bun, 5) + " /";
    var bmp2 = cprsUtils.replicate("-", bmp1.length - 1) + " " + ld["GLUCOSE"];
    var bmp3 = cprsUtils.pad(ld["POTASSIUM"], 5) + " | " + cprsUtils.pad(co2, 5) + " | " + cprsUtils.pad(ld["CREATININE"], 5) + " \\ \n\n";
    
    var output = bmp1 + "\n" + bmp2 + "\n" + bmp3;
    
    // Add glucose correction if needed
    if (glucoseValue > 200) {
      output += "Corrected Na: " + Math.round(sodiumValue + (0.016 * (glucoseValue - 100))) + "\n";
    }
    
    // Add anion gap and albumin correction
    output += "Anion gap: " + anionGap;
    
    // Apply albumin correction if needed
    if ("ALBUMIN" in ld) {
      var albuminValue = parseFloat(ld["ALBUMIN"]);
      if (albuminValue < 3.5) {
        var correctedAG = Math.round((parseFloat(anionGap) + 2.5 * (4 - albuminValue)));
        output += " (corrected " + correctedAG + ")";
      }
    }
    
    // Add calcium and other electrolytes
    output += "\nCa " + ld["CALCIUM"];
    
    if ("ALBUMIN" in ld) {
      var albuminValue = parseFloat(ld["ALBUMIN"]);
      var calciumValue = parseFloat(ld["CALCIUM"]);
      
      if (albuminValue < 4 && calciumValue < 10.3) {
        var correctedCa = Math.round((calciumValue + 0.8 * (4 - albuminValue)) * 10) / 10;
        output += " (corrected " + correctedCa + ")";
      }
    }
    
    if ("IONIZED CALCIUM" in ld) {
      output += ", iCal " + ld["IONIZED CALCIUM"];
    }
    if ("MAGNESIUM" in ld) {
      output += ", Mg " + ld["MAGNESIUM"];
    }
    if ("PHOSPHOROUS" in ld) {
      output += ", Phos " + ld["PHOSPHOROUS"];
    } else if ("PO4" in ld) {
      output += ", Phos " + ld["PO4"];
    }
    
    return output + "\n\n";
  }
  
  /**
   * Generate CMP (Comprehensive Metabolic Panel) output
   * @returns {string} Formatted CMP section
   */
  function generateCMPOutput() {
    if (!(ld["AST"] !== undefined)) {
      return "";
    }
    
    var output = "";
    output = cprsUtils.pad(ld["CALCIUM"], 5) + " | " + ld["AST"] + "\n  ---------\n" + 
          cprsUtils.pad(ld["TP, SER/PL"], 5) + " | " + ld["ALT/SGPT"] + "\n  ---------\n" + 
          cprsUtils.pad(ld["ALBUMIN"], 5) + " | " + ld["ALKALINE PHOSPHATASE"] + "\n" + 
          "    /" + ld["BILIRUBIN, TOTAL"] + "\\";
    
    if ("DIRECT BILIRUBIN" in ld) {
      output += "\n\nDirect bili: " + ld["DIRECT BILIRUBIN"];
    }
    
    output += "\n\n";
    
    // Calculate MELD score if requested
    if ("INR" in ld && "CREATININE" in ld && document.forms["data1"]["chkMELD"].checked == true) {
      var creatValue = parseFloat(ld["CREATININE"]);
      var biliValue = parseFloat(ld["BILIRUBIN, TOTAL"]);
      var inrValue = parseFloat(ld["INR"]);
      
      var meldScore = Math.round((0.957 * Math.log(Math.max(1, creatValue)) + 
                                 0.378 * Math.log(Math.max(1, biliValue)) + 
                                 1.120 * Math.log(Math.max(1, inrValue)) + 0.643) * 10);
      
      var meldDialysis = Math.round((0.957 * Math.log(4) + 
                                    0.378 * Math.log(Math.max(1, biliValue)) + 
                                    1.120 * Math.log(Math.max(1, inrValue)) + 0.643) * 10);
      
      output += "MELD: " + meldScore + "\n";
      output += "MELD with dialysis: " + meldDialysis + "\n\n";
    }
    
    return output;
  }
  
  /**
   * Generate output for top priority lab values
   * @returns {string} Formatted priority values
   */
  function generateTopPriorityOutput() {
    var output = "";
    
    output += cprsUtils.displayVal("INR", "\n");
    
    if ("PROTHROMBIN TIME" in ld) {
      output += "PT: " + ld["PROTHROMBIN TIME"] + "\n";
    } else if ("PTIME" in ld) {
      output += "PT: " + ld["PTIME"] + "\n";
    }
    
    output += cprsUtils.displayVal("PTT", "\n") + 
           cprsUtils.displayVal("PTT (MAIN LAB)", "\n") + 
           cprsUtils.displayVal("LACTIC ACID", "\n");
    
    if (output != "") {
      output += "\n";
    }
    
    return output;
  }
  
  /**
   * Generate ABG (Arterial Blood Gas) output
   * @returns {string} Formatted ABG section
   */
  function generateABGOutput() {
    if (!(ld["pH.."] !== undefined)) {
      return "";
    }
    
    // Since values are already cleaned, we can use parseFloat directly
    var ph = parseFloat(ld["pH.."]);
    var pco2 = parseFloat(ld["pCO2.."]);
    var hco3 = parseFloat(ld["CARBON DIOXIDE CO2"] || ld["CO2"]);
    var po2 = parseFloat(ld["pO2.."]);
    var ag = parseFloat(ld["ANION GAP,CALC."] || 0);
    
    // Apply albumin correction if needed
    if ("ALBUMIN" in ld) {
      var albumin = parseFloat(ld["ALBUMIN"]);
      if (albumin < 3.5) {
        ag += 2.5 * (4 - albumin);
      }
    }
    
    var abg = "ABG\n> " + Math.round(ph * 100) / 100 + " / " + Math.round(pco2) + " / " + Math.round(po2) + 
           "\n> O2 sat: " + ld["sO2.."] + "%\n";
    
    if ("O2 Delivery Type.." in ld) {
      abg += "> O2 delivery: " + ("LPM.." in ld ? ld["LPM.."] + " L " : "") + 
           ld["O2 Delivery Type.."] + 
           ("FIO2.." in ld ? ", " + Math.round(parseFloat(ld["FIO2.."])) + "% FiO2" : "") + "\n";
    }
    
    if ("MetHb.." in ld && parseFloat(ld["MetHb.."]) >= 2.9) {
      abg += "> MetHb: " + ld["MetHb.."] + "%\n";
    }
    
    if (!(ld["Ionized Ca.."] == undefined)) {
      abg += "> Ionized Ca: " + ld["Ionized Ca.."] + "\n";
    }
    
    if ("COHb.." in ld && parseFloat(ld["COHb.."]) > 1.9) {
      abg += "> COHb: " + ld["COHb.."] + "%\n";
    }
    
    // Calculate A-a gradient if needed
    if (po2 < 80 || pco2 < 35 || ("FIO2.." in ld && parseFloat(ld["FIO2.."]) > 21) || ("LPM.." in ld)) {
      var fio2 = ("FIO2.." in ld ? parseFloat(ld["FIO2.."]) * 0.01 : 
                 ("LPM.." in ld ? 0.2 + (0.04 * parseFloat(ld["LPM.."])) : 0.21));
      abg += "> A-a gradient: " + Math.round((fio2 * (760 - 47) - (pco2 / 0.8) - po2)) + "\n";
    }
    
    // Analyze ABG if requested
    if (document.forms["data1"]["chkABG"].checked == true) {
      if (ph < 7.35 || ph > 7.45 || pco2 < 35 || pco2 > 45 || hco3 < 22 || hco3 > 26 || ag > 12) {
        var abga = cprsUtils.analyzeABG(ph, pco2, hco3, ag);
        abg += "> Analysis: " + abga + "\n";
      }
    }
    
    return abg + "\n";
  }
  
  /**
 * Generate output for remaining lab values
 * @returns {string} Formatted remaining lab values
 */
function generateRemainingLabsOutput() {
    // List of lab names to exclude from the general output
    var excludedLabs = [
      "SODIUM", "POTASSIUM", "CHLORIDE", "CO2", "CARBON DIOXIDE CO2", 
      "CREATININE", ".CREAT,RECIPROCAL(CALC)", "EGFR", "eGFR(AFR.AMER.)", 
      "eGFR(NON-AFR.AMER.)", "UREA NITROGEN,BLOOD", "UREA NITROGEN (BUN)", 
      "BUN/CREATININE RATIO", "GLUCOSE", "A/G RATIO, CALC.", "OSMOLALITY, CALC.", 
      "ANION GAP,CALC.", "CALCIUM", "IONIZED CALCIUM", "MAGNESIUM", "PHOSPHOROUS", 
      "PO4", "TP, SER/PL", "GLOBULIN, CALC.", "Non-HDL-C", "VLDL Chol,Calc.", 
      "CHOL/HDL RATIO", ".CBC w/AUTO DIFF", "WBC", "RBC", "HGB", "HEMOGLOBIN", 
      "HCT", "HEMATOCRIT", "MCHC", "RDW", "MCV", "MCH", "PLATELETS", "PLATELET COUNT", 
      "MPV", "IG %", "NEUTROPHIL%", "NEUT %", "LYMPHOCYTE%", "LYMPH %", "MONOCYTE%", 
      "MONO %", "EOSINOPHIL%", "EOS %", "BASOPHIL%", "BASO %", "IG #", "NEUTROPHIL#", 
      "NEUT #", "LYMPH #", "LY #", "MONO #", "MONOCYTE#", "EO #", "EOSINOPHIL#", "BA #", 
      "BASO#", "BASOPHIL#", "BANDS", "PLATELET-ESTM", "MACROCYTOSIS", "HYPOCHROMIA", 
      "TOXIC GRANULATION", "ACANTHOCYTES", "OVALOCYTES", "BASOPHILIC STIPPLING", 
      "LARGE PLATELET", "PLATELET CLUMP", "WBC CLUMPS", "RETICULOCYTES", "GIANT PLATELET", 
      "ANISOCYTOSIS", "MICROCYTOSIS", "TEARDROPS", "SPHEROCYTES", "POIKILOCYTOSIS", 
      "META", "TARGET CELLS", "ECHINOCYTES(BURR CELLS)", "NUCLEATED RBC/100WBC", "POLYCHROMASIA", 
      "MYELO", "URINE COLOR", "APPEARANCE", "URINE GLUCOSE", "URINE BILIRUBIN", 
      "URINE KETONES", "SPECIFIC GRAVITY", "URINE BLOOD", "URINE PH", "URINE PROTEIN", 
      "UROBILINOGEN", "NITRITE, URINE", "LEUKOCYTE ESTERASE, URINE", "URINE WBC/HPF", 
      "URINE RBC/HPF", "URINE BACTERIA", "URINE MUCUS", "SQUAMOUS EPITH. CELLS", 
      "HYALINE CASTS", "URINE YEAST, BUDDING", "URINE YEAST, HYPHAE", "GLUCOSE FINGER STICK", 
      "MRSA SURVL NARES DNA", "MRSA SURVL NARES AGAR", "PTIME", "INR", "PROTHROMBIN TIME", 
      "PTT", "PTT (MAIN LAB)", "LACTIC ACID", "ALBUMIN", "BILIRUBIN, TOTAL", "AST", 
      "ALT/SGPT", "ALKALINE PHOSPHATASE", "DIRECT BILIRUBIN", "pH..", "pCO2..", "pO2..", 
      "HCO3..", "ABE..", "sO2..", "tHB..", "O2Hb..", "COHb..", "MetHb..", "Potassium..", 
      "Sodium..", "Ionized Ca..", "Chloride..", "Glucose..", "Lactate..", "Temperature..", 
      "O2 Delivery Type..", "LPM..", "Allen Test..", "FIO2..", "Sample site.."
    ];
    
    var output = "";
    
    // Add remaining lab values not in the excluded list
    for (var prop in ld) {
      var isExcluded = excludedLabs.some(function(excludedLab) {
        return prop === excludedLab;
      });
      
      if (!isExcluded) {
        output += prop + ": " + ld[prop] + "\n";
      }
    }
    
    return output;
  }
  
  /**
   * Generate urinalysis output
   * @returns {string} Formatted urinalysis section
   */
  function generateUrinalysisOutput() {
    if (!("URINE COLOR" in ld)) {
      return "";
    }
    
    var UA2 = "";
    if ("URINE WBC/HPF" in ld) {
      UA2 = "\n> Micro: " + ld["URINE WBC/HPF"] + " WBCs, " + 
            ld["URINE RBC/HPF"] + " RBCs, " + 
            ((ld["SQUAMOUS EPITH. CELLS"] == undefined) ? "0" : ld["SQUAMOUS EPITH. CELLS"]) + 
            " squams\n> Casts: " + 
            ((ld["HYALINE CASTS"] == undefined) ? "no" : ld["HYALINE CASTS"]) + " hyaline casts";
    }
    
    var UA = "\nUrinalysis\n" + 
            "> " + ld["URINE COLOR"] + ", " + ld["APPEARANCE"] + 
            "\n> LE " + ((ld["LEUKOCYTE ESTERASE, URINE"] == "Negative") ? "-ve" : String(ld["LEUKOCYTE ESTERASE, URINE"]).toLowerCase()) + 
            ", nitrites " + ((ld["NITRITE, URINE"] == "NEGATIVE") ? "-ve" : ld["NITRITE, URINE"]) + 
            ((ld["URINE BACTERIA"] == undefined) ? ", no bacteria" : ", " + String(ld["URINE BACTERIA"]).toLowerCase() + " bacteria") + 
            ((ld["URINE YEAST, BUDDING"] == undefined) ? "" : ", " + String(ld["URINE YEAST, BUDDING"]).toLowerCase() + " budding yeast") + 
            ((ld["URINE YEAST, HYPHAE"] == undefined) ? "" : ", " + String(ld["URINE YEAST, HYPHAE"]).toLowerCase() + " hyphae yeast") + 
            ((ld["URINE MUCUS"] == undefined) ? ", no" : ", " + String(ld["URINE MUCUS"]).toLowerCase()) + " mucus" + 
            "\n> Protein: " + ((ld["URINE PROTEIN"] == "NEGATIVE") ? "-ve" : ld["URINE PROTEIN"]) + 
            " \n> Blood: " + ((ld["URINE BLOOD"] == "NEGATIVE") ? "-ve" : String(ld["URINE BLOOD"]).toLowerCase()) + 
            UA2 + 
            "\n> Ketones " + ((ld["URINE KETONES"] == "NEGATIVE") ? "-ve" : ld["URINE KETONES"]) + 
            "\n> pH " + ld["URINE PH"] + ", spec gravity " + ld["SPECIFIC GRAVITY"] + 
            ", bilirubin " + ((ld["URINE BILIRUBIN"] == "NEGATIVE") ? "-ve" : ld["URINE BILIRUBIN"]);
    
    return UA;
  }
  
  /**
   * Generate calculated values (FENa, FEUrea)
   * @returns {string} Formatted calculated values
   */
  function generateCalculatedValues() {
    var output = "";
    
    // Calculate FENa
    if ("CREATININE" in ld && "CREATININE-URINE" in ld && "SODIUM" in ld && "SODIUM-URINE" in ld) {
      var creatValue = parseFloat(ld["CREATININE"]);
      var creatUrineValue = parseFloat(ld["CREATININE-URINE"]);
      var naValue = parseFloat(ld["SODIUM"]);
      var naUrineValue = parseFloat(ld["SODIUM-URINE"]);
      
      var fena = Math.round(((creatValue * naUrineValue) / (naValue * creatUrineValue)) * 10000) / 100;
      output += "\n\nFENa: " + fena + "%";
    }
    
    // Calculate FEUrea
    if ("CREATININE" in ld && "CREATININE-URINE" in ld && "UREA NITROGEN (BUN)" in ld && "UREA NITROGEN-URINE" in ld) {
      var creatValue = parseFloat(ld["CREATININE"]);
      var creatUrineValue = parseFloat(ld["CREATININE-URINE"]);
      var bunValue = parseFloat(ld["UREA NITROGEN (BUN)"]);
      var bunUrineValue = parseFloat(ld["UREA NITROGEN-URINE"]);
      
      var feurea = Math.round(((creatValue * bunUrineValue) / (bunValue * creatUrineValue)) * 1000) / 10;
      output += "\n\nFEUrea: " + feurea + "%";
    }
    
    return output;
  }
  
  /**
   * Reset the form
   */
  function resetForm() {
    document.forms["data1"]["edtData"].value = '';
  }
  
  // Initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Set up event listener for the format button
    var formatButton = document.getElementById('formatButton');
    if (formatButton) {
      formatButton.addEventListener('click', formatLabData);
    } else {
      // Fallback to directly attaching to the form submit button
      console.log("Format button not found, default behavior will be used");
    }
    
    // Set up event listener for reset button
    var resetButton = document.getElementById('resetButton');
    if (resetButton) {
      resetButton.addEventListener('click', resetForm);
    }
    
    // Optional: Add keyboard shortcut (Ctrl+Enter) to format
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        formatLabData();
        e.preventDefault();
      }
    });
    
    // Debug button event handler
    var debugButton = document.getElementById('debugButton');
    if (debugButton) {
      debugButton.addEventListener('click', cprsUtils.toggleDebug);
    }
  });