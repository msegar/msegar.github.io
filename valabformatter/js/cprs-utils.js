/**
 * CPRS Lab Formatter - Utilities
 * 
 * Core utilities and helper functions for processing VA CPRS lab data
 * 
 * @author Matthew Segar, MD (Original)
 * @updated March 13, 2025
 */

// Global variable to store lab data
var ld = {};

// Debug mode flag
window.cprsDebug = false;

// Helper array extensions for compatibility
if (!Array.prototype.filter) {
  Array.prototype.filter = function(fun) {
    var len = this.length;
    if (typeof fun != "function")
      throw new TypeError();

    var res = new Array();
    var thisp = arguments[1];
    for (var i = 0; i < len; i++) {
      if (i in this) {
        var val = this[i];
        if (fun.call(thisp, val, i, this))
          res.push(val);
      }
    }
    return res;
  };
}

/**
 * Pad a string with characters to a specific length
 * @param {string} str - String to pad
 * @param {number} num - Desired length
 * @param {string} char - Character to pad with (default: space)
 * @returns {string} Padded string
 */
function pad(str, num, char) {
  if (char === undefined) { char = " "; }
  return String(replicate(char, num) + str).slice(0 - num);
}

/**
 * Create a string by repeating a character
 * @param {string} char - Character to repeat
 * @param {number} num - Number of repetitions
 * @returns {string} Repeated string
 */
function replicate(char, num) {
  return new Array(num + 1).join(char);
}

/**
 * Trim whitespace from start and end of string
 * @param {string} x - String to trim
 * @returns {string} Trimmed string
 */
function myTrim(x) {
  return x.replace(/^\s+|\s+$/gm, '');
}

/**
 * Format a lab value with its name
 * @param {string} cElement - Lab name
 * @param {string} cDelim - Delimiter to add after value (optional)
 * @returns {string} Formatted string or empty string if lab not found
 */
function displayVal(cElement, cDelim) {
  return (cElement in ld ? cElement + ": " + ld[cElement] + (cDelim == undefined ? "" : cDelim) : "");
}

/**
 * Extract numeric value from lab string, removing any H/L flags
 * @param {string} value - The lab value possibly with H or L flags
 * @returns {number} - The numeric value only
 */
function extractNumericValue(value) {
  if (value === undefined || value === null) {
    return 0;
  }
  
  // First, try to convert directly to number
  let numVal = parseFloat(value);
  if (!isNaN(numVal)) {
    return numVal;
  }
  
  // If it contains text like "31 H" or "2.1 L", extract just the number
  const numericMatch = value.match(/^([-+]?\d*\.?\d+)/);
  if (numericMatch && numericMatch[1]) {
    return parseFloat(numericMatch[1]);
  }
  
  return 0; // Default if no valid number found
}

/**
 * Check if the text looks like it's already formatted
 * @param {string} text - The text to check
 * @returns {boolean} - True if already formatted, false if raw lab data
 */
function isAlreadyFormatted(text) {
  // Skip empty text
  if (!text || text.trim() === '') {
    return false;
  }
  
  // Look for site codes ([XXX]) which indicate unformatted lab data
  const siteCodePattern = /\[\d{3}\]/;
  if (siteCodePattern.test(text)) {
    return false; // Contains site codes, so it's raw lab data
  }
  
  // Look for patterns that indicate formatted output
  const formattedPatterns = [
    /------- \d+/,                  // BMP separator line
    /\d+ ------ \d+/,               // CBC separator
    /Anion gap: \d+/,               // Anion gap calculation
    /^ABG$/m,                       // ABG header
    /^Urinalysis$/m,                // Urinalysis header
  ];
  
  // If we find any lab data headers alone, it's likely raw data that hasn't been fully formatted
  const labHeadersAlone = /^(PTIME|INR|WBC|SODIUM|POTASSIUM)$/m;
  if (labHeadersAlone.test(text)) {
    return false;
  }
  
  // Check if any pattern matches
  return formattedPatterns.some(pattern => pattern.test(text));
}

/**
 * Extract clean numeric value from lab result string
 * @param {string} value - Raw lab value string
 * @returns {string} Cleaned value with H/L flags removed
 */
function cleanLabValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  
  // Extract just the numeric part from values like "31 H" or "2.1 L"
  const numericMatch = value.match(/^([-+]?\d*\.?\d+)/);
  if (numericMatch && numericMatch[1]) {
    return numericMatch[1];
  }
  
  return value; // Return original if no numeric part found
}

/**
 * Parse lab data from CPRS text format
 * @param {string} inputText - Raw CPRS lab data text
 * @returns {Object} Parsed lab data object or null if parsing failed
 */
function parseLabData(inputText) {
  if (!inputText || inputText.trim() === '') {
    return null;
  }
  
  // Check if already formatted
  if (isAlreadyFormatted(inputText)) {
    if (window.cprsDebug) {
      console.log("Data appears to be already formatted. Skipping parsing.");
    }
    return null;
  }
  
  // Split input into lines
  var lines = inputText.split("\n");
  var labData = {};
  
  if (window.cprsDebug) {
    console.log("Starting with " + lines.length + " lines of data");
  }
  
  // First pass: filter for lab result lines
  for (let i = 0; i < lines.length; i++) {
    // Look for any site code in format [XXX] that isn't at beginning of line
    if (!/\[\d{3}\]/.test(lines[i]) || lines[i].substring(0, 5).match(/\[\d{3}\]/)) {
      lines[i] = "";
    }
    // Remove the "." prefix that are on some labs
    if (lines[i].substring(0, 1) == ".") {
      lines[i] = lines[i].substring(1);
    }
  }
  
  // Filter out empty lines
  lines = lines.filter(function(e) { return e; });
  
  if (window.cprsDebug) {
    console.log("After filtering, kept " + lines.length + " lines of data");
    if (lines.length > 0) {
      console.log("Sample line: " + lines[0]);
    } else {
      console.log("WARNING: No lab data lines were found. Check input format.");
    }
  }
  
  // Check if we have any data to format
  if (lines.length === 0) {
    return null;
  }
  
  // Second pass: extract lab values
  for (let i = 0; i < lines.length; i++) {
    var line = lines[i];
    // Look for the first sequence of multiple spaces after the lab name
    var labNameEndPos = line.search(/\s{2,}/);
    
    if (labNameEndPos > 0) {
      // Get lab name by trimming everything before double space
      var labName = myTrim(line.substring(0, labNameEndPos));
      
      // Find the first non-whitespace after the lab name
      var valueStartPos = line.substring(labNameEndPos).search(/\S/);
      if (valueStartPos > 0) {
        valueStartPos += labNameEndPos;
        // Extract until the next whitespace or end of string
        var valueEndPos = line.substring(valueStartPos).search(/\s{2,}/);
        if (valueEndPos < 0) {
          // No more double spaces, take everything
          valueEndPos = line.length;
        } else {
          valueEndPos += valueStartPos;
        }
        
        var labValue = line.substring(valueStartPos, valueEndPos).trim();
        
        // Clean the value - strip H/L flags at parse time
        var cleanedValue = cleanLabValue(labValue);
        
        labData[labName] = cleanedValue;
        
        if (window.cprsDebug) {
          console.log(`Extracted: ${labName} = ${cleanedValue}` + 
                     (cleanedValue !== labValue ? ` (original: ${labValue})` : ""));
        }
      }
    }
  }
  
  if (window.cprsDebug) {
    console.log("Final parsed lab data:", labData);
    if (Object.keys(labData).length < 5) {
      console.warn("Very few lab values were extracted. Check input format or site codes.");
    }
  }
  
  return labData;
}

/**
 * Enable/disable debug mode
 */
function toggleDebug() {
  window.cprsDebug = !window.cprsDebug;
  alert("Debug mode " + (window.cprsDebug ? "enabled" : "disabled"));
}

/**
 * Analyze ABG values and determine acid-base status
 * @param {number} ph - Blood pH
 * @param {number} pco2 - Blood pCO2
 * @param {number} hco3 - Blood bicarbonate
 * @param {number} ag - Blood anion gap
 * @returns {string} ABG analysis text
 */
function analyzeABG(ph, pco2, hco3, ag) {
  var abga = "";
  
  if (ph < 7.35) {
    if (pco2 > 45) { // Respiratory acidosis
      abga = "Respiratory acidosis";
      if (hco3 < 22) { // Not compensating
        abga = abga + " with metabolic acidosis";
      } else { // Compensating, so is this acute or chronic resp acidosis
        var change = (7.4 - ph) / ((pco2 - 40) / 10);
        abga = abga + (change <= .04 && change >= .02 ? " (chronic)" : 
                       (change >= 0.07 && change <= 0.09 ? " (acute)" : 
                       (change > 0.04 && change < 0.07 ? " (partially compensated)" : "")));
      }
    } else { // Metabolic acidosis
      // Gap or non-gap
      if (ag > 16) { // Gap
        abga = "High anion gap metabolic acidosis";
        if ((hco3 + (ag - 12)) < 22) { // There is also NAGMA
          abga = abga + " and normal anion gap metabolic acidosis";
        } else if ((hco3 + (ag - 12)) > 26) { // There is also metabolic alkalosis
          abga = abga + " and metabolic alkalosis";
        }
      } else { // No gap
        abga = "Normal anion gap metabolic acidosis";
      }
      
      // Is respiratory compensation appropriate
      var winter = 1.5 * hco3 + 8;
      if ((pco2 - winter) > 2) { // Respiratory acidosis
        abga = abga + " with concomitant respiratory acidosis";
      } else if ((pco2 - winter) < -2) { // Respiratory alkalosis
        abga = abga + " with concomitant respiratory alkalosis";
      } else { // Appropriate
        abga = abga + " with appropriate respiratory compensation";
      }
    }
  } else if (ph > 7.45) {
    if (hco3 > 26) {
      abga = "Metabolic alkalosis";
    } else if (pco2 < 35) {
      abga = "Respiratory alkalosis";
      var change = (ph - 7.4) / ((40 - pco2) / 10);
      abga = abga + (change <= .04 && change >= .02 ? " (chronic)" : 
                    (change >= 0.07 && change <= 0.09 ? " (acute)" : 
                    (change > 0.04 && change < 0.07 ? " (partially compensated)" : "")));
    } else {
      abga = "Alkalosis (unspecified)"; // Couldn't figure out what kind of alkalosis
    }
  } else { // pH normal
    if (hco3 < 22) {
      if (ag > 16) {
        abga = abga + "high anion gap metabolic acidosis";
        if ((hco3 + (ag - 12)) < 22) { // There is also NAGMA
          abga = abga + " and normal anion gap metabolic acidosis";
        } else if ((hco3 + (ag - 12)) > 26) { // There is also metabolic alkalosis
          abga = abga + " and metabolic alkalosis";
        }
        abga = abga + ", ";
      } else {
        abga = abga + "normal anion gap metabolic acidosis, ";
      }
    }
    
    if (hco3 > 26) {
      abga = abga + "metabolic alkalosis, ";
      if (ag > 16) {
        abga = abga + "high anion gap metabolic acidosis, ";
      }
    }
    
    if (pco2 < 35) {
      abga = abga + "respiratory alkalosis, ";
    }
    
    if (pco2 > 45) {
      abga = abga + "respiratory acidosis, ";
    }
    
    if (abga == "") { // AG is the only abnormality
      abga = "Elevated anion gap";
    } else { // Now clean it up - make first letter capital and remove the trailing ', '
      abga = abga.substring(0, 1).toUpperCase() + abga.substring(1, abga.length - 2);
    }
  }
  
  return abga;
}

// Export functions and variables
window.cprsUtils = {
  parseLabData: parseLabData,
  extractNumericValue: extractNumericValue,
  cleanLabValue: cleanLabValue,
  isAlreadyFormatted: isAlreadyFormatted,
  displayVal: displayVal,
  myTrim: myTrim,
  replicate: replicate,
  pad: pad,
  analyzeABG: analyzeABG,
  toggleDebug: toggleDebug
};