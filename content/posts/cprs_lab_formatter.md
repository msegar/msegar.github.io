---
title: CPRS Lab Formatter
description: Making Lab Data Easier to See for VA CPRS EHR
date: 2025-03-14
img: ../assets/images/cprs.png
categories: [Healthcare, VA, Data Visualization, Tools]
---

# CPRS Lab Formatter: Making Lab Data Easier to See for VA Healthcare Workers

Many of us have struggled with CPRS lab results - squinting at numbers, doing math by hand, or wishing we could see trends better. That's why I made the [CPRS Lab Formatter](https://segar.me/valabformatter) - a free tool built to improve how we look at VA lab data.

## The Problem with CPRS Labs

The Veterans Health Information Systems and Technology Architecture (VistA) and its main screen, the Computerized Patient Record System (CPRS), have been the core of VA healthcare IT since the late 1990s. While it was cutting-edge when created, CPRS shows lab data in a way that hasn't changed much over the years:

- Text-heavy screens packed with numbers
- No automatic math for values you need to calculate
- Few ways to see data as charts or graphs
- Hard to spot patterns across time

These issues mean extra mental work and time spent during patient visits - time that would be better used on patient care.

## A Brief History of CPRS

Before looking at the solution, it helps to know where CPRS came from. Built in-house by the VA in the 1980s and 1990s, VistA/CPRS broke new ground - it was one of the first complete electronic health record systems ever made.

What many don't know is that VA doctors and staff who taught themselves computer programming created CPRS. This bottom-up approach led to a system that fit clinical workflows well, which explains why it's lasted so long despite looking outdated.

The VA's choice to build its own EHR system was forward-thinking and led to better patient care. Studies show that after CPRS was put in place, the VA did better than private healthcare on many quality measures - showing that having the right information at the right time directly helps patients.

## Introducing the CPRS Lab Formatter

The CPRS Lab Formatter is a simple but strong tool that changes raw lab data from CPRS into clean, readable formats with automatic calculations. Here's what it does:

- **Organizes lab panels** - CBC, BMP, CMP, ABG, and others are grouped and formatted for easy reading
- **Does clinical calculations** - Anion gap, corrected calcium, sodium correction for high blood sugar, and more
- **Analyzes ABGs** - Automatically explains acid-base problems including mixed conditions
- **Calculates MELD scores** - For checking liver disease
- **Computes FENa and FEUrea** - For kidney function tests
- **Works right in your browser** - No data is sent anywhere, keeping patient information private

## How It Works

I built the Lab Formatter using basic JavaScript, focusing on speed and simplicity. The tool has three main parts:

1. **A parser** that reads CPRS lab data format and pulls out values
2. **A formatter** that puts the data in clinically useful groups
3. **A calculation engine** that figures out important values and what they mean

The technical approach puts reliability and privacy first. Since all work happens in your browser, no patient data ever leaves your computer. This design follows HIPAA rules while allowing the tool to work anywhere, even with poor internet.

Here's a simplified look at how it reads the data:

```javascript
function parseLabData(inputText) {
  // Split input into lines
  var lines = inputText.split("\n");
  
  // Filter for lab result lines containing site codes [XXX]
  for (let i = 0; i < lines.length; i++) {
    if (!/\[\d{3}\]/.test(lines[i])) {
      lines[i] = "";
    }
  }
  
  // Extract lab values from remaining lines
  for (let i = 0; i < lines.length; i++) {
    var line = lines[i];
    // Find lab name and value
    var labNameEndPos = line.search(/\s{2,}/);
    
    if (labNameEndPos > 0) {
      var labName = trim(line.substring(0, labNameEndPos));
      // Extract value portion
      var valueStartPos = line.substring(labNameEndPos).search(/\S/) + labNameEndPos;
      var valueEndPos = line.substring(valueStartPos).search(/\s{2,}/);
      if (valueEndPos < 0) valueEndPos = line.length;
      else valueEndPos += valueStartPos;
      
      var labValue = cleanLabValue(line.substring(valueStartPos, valueEndPos).trim());
      labData[labName] = labValue;
    }
  }
  
  return labData;
}
```

Once the data is read, the formatter applies special layouts for different lab panels. For example, a CBC is shown in a diamond pattern that makes it easy to see how key values relate:

```
      87.3
      \ 13.9 /
8.1 ------ 278
      / 41.7 \
```

While a basic metabolic panel is set up to highlight the connections between electrolytes:

```
  138 | 102 |  15 /
  -----------------  118
  3.9 |  24 | 0.9 \
```

## Clinical Applications

The real value of the Lab Formatter comes from its automatic analysis. For example, when checking ABGs, the tool not only organizes the values but also explains them:

```
ABG
> 7.25 / 48 / 62
> O2 sat: 89%
> O2 delivery: 2 L Nasal Cannula, 28% FiO2
> A-a gradient: 103
> Analysis: Respiratory acidosis with metabolic acidosis
```

This instant analysis helps find mixed acid-base problems that might be missed or need hand calculations.

Similarly, the automatic math for anion gap, corrected calcium, and other values saves time and cuts down on math errors.

## How to Use It

Using the tool is easy:

1. Visit [segar.me/valabformatter](https://segar.me/valabformatter)
2. In CPRS, go to the Labs tab and select "All Tests by Date"
3. Select the text (Ctrl+A) and copy it (Ctrl+C)
4. Paste (Ctrl+V) into the Lab Formatter text box
5. Click "Format Labs"

The result is a clean, organized view of the lab data that shows important relationships and does relevant calculations automatically.

## The Future of VA Health IT

While the VA is moving to a store-bought EHR system (supposedly Cerner/Oracle Health), CPRS is still the main screen for hundreds of thousands of VA staff serving millions of veterans. Tools like the Lab Formatter help fill the gap between old systems and modern clinical needs.

As a doctor who uses CPRS, I built this tool to fix a problem I faced myself. The good feedback I've gotten from coworkers shows there's a real need for better data display in clinical systems.

Whether you're a doctor, nurse, PA, or other healthcare worker in the VA system, I hope you'll find the Lab Formatter useful in your daily work. Visit [segar.me/valabformatter](https://segar.me/valabformatter) to try it out, and please share any feedback or ideas for making it better.

## About the Author

Dr. Matthew Segar is a physician and programmer who likes finding tech solutions to clinical problems. This tool was made as a side project to improve daily workflows and is free for all VA healthcare staff. Visit [segar.me](https://segar.me) to learn more.

---

*Disclaimer: The CPRS Lab Formatter is an independent tool and is not officially connected with or supported by the Department of Veterans Affairs. All patient data stays in your browser and is never sent or stored elsewhere.*