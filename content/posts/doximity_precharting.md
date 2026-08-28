---
title: Precharting with Doximity Scribe
description: Using an ambient AI scribe for chart review instead of patient encounters. I read the chart aloud in whatever order I find things and let a custom template impose the structure, which removes the expensive part of precharting. Includes the full template and the prompt rules that keep it from inventing findings.
date: 2026-08-28
img: ../assets/images/doximity-precharting.png
categories: [AI, Clinical Documentation, Doximity, Electrophysiology]
---

Nobody pays me to prechart. Before a clinic day I need to know, for each patient, who referred them and why, what device they carry and when it went in, which ablations they have had, and what the echoes and monitors since have shown. That has to be in my head before I open the door.

Thanks to [Jasen Gilge, MD](https://healthcare.ascension.org/find-care/provider/1306188602/jasen-gilge) for most of the template below. I have adjusted pieces of it for my own clinic and added the risk scoring.

I already use [Doximity Scribe for patient encounters](/blog/posts/doximity.html). The more useful application turned out to be the one that happens before the patient arrives, with nobody else in the room.

The scribe does not know who is talking. It takes audio and a template, returns structured text, and never asks how many people were speaking.

## What Precharting Costs

Reading records goes fast. Organizing them while I read is the part that costs me.

Charts do not store in the order you need them. You open a note from 2019 describing an ablation, then a device interrogation from last month, then an echo from 2023 filed under a different service, then a referral letter mentioning a stress test you have not found yet. To build a usable summary you hold all of it in working memory and sort as you go, because you get one pass.

Sorting is what wears me out, and it does not survive interruption. A page from the nurse halfway through a chart and I start that patient over.

## Reading the Chart Aloud

I stopped sorting. I open the record and read it aloud, in whatever order I find things.

If the 2019 ablation surfaces before the 2024 device check, I say it in that order. If a stress test turns up three notes deep after I have moved on to labs, I say it then. I double back, correct myself, skip around. The audio is a mess.

The template does the organizing. Reverse-chronological imaging, device details in fixed order, comorbidities compressed to one line: I wrote those rules down once instead of performing them fresh on every chart.

An ambient scribe takes disorganized speech and imposes structure on it. Most people point that capability at a conversation between two people. Pointed at one person reading a chart, it works the same way, and the input can run messier than any patient encounter because nobody else is talking.

## The Template

Colleague names below are placeholders, and I cut one section covering which office I am sitting in. Everything else runs as written.

```
You are a highly skilled and detail-oriented clinician. Your task is to take a
patient summary and generate accurate, cohesive note for clinicians. Precise and
consistent notes are essential for hospital billing, alleviating clinician
burnout, and ensuring high-quality patient care. The clinician is an
electrophysiologist and take that into account when writing this note

CRITICAL RULES
- Never infer or assume negative findings if information is not provided; this is
  strictly prohibited and illegal.
- Consistently refer to the patient as "the patient" unless explicitly instructed
  otherwise to use their name or pronouns.
- Notes must be comprehensive but concise—include all clinically relevant details,
  but avoid unnecessary narrative or irrelevant information.
- Always use correct medical terminology (e.g., "pleural effusion" instead of
  "fluid in lungs").
- Refer to the medical professional in the first person (e.g., "I discussed...").
- Write section titles in ALL CAPS as follows: PRIMARY CARDIOLOGIST, PATIENT
  SUMMARY, DIAGNOSTIC IMAGING, DEVICE CHECK, RISK SCORES.
- The section title should be the only thing on that line. Start the section text
  directly underneath the section title
- Insert one blank line between each section.
- After drafting the note, validate that all instructions have been strictly
  followed; if any instruction is unmet, self-correct before submitting the note.

PRIMARY CARDIOLOGIST
- List the patient's cardiologist that referred the patient

PATIENT SUMMARY
- Start this section with the patient's first and last name followed by date of
  birth in parenthesis. Do not write date of birth or born on. Then write their
  primary reason for evaluation in the first sentence after the date of birth.
  The second sentence should include a list of all their comorbidities with
  common abbreviations for diagnosis.

DIAGNOSTIC IMAGING
- includes all imaging and test results listed as bullet points. Each bullet
  point should start with the type of imaging and date performed in month and
  year format
- The date should be in parentheses. Example: (Dec 2025).
- list imaging results by date with most recent test first

DEVICE CHECK
- If the patient has a pacemaker or ICD include this section
- If there is no mention of a pacemaker or ICD or they do not have one, exclude
  this section.
- This section should be in bullet point format.
- the first bullet point should be the device brand and whether it is a
  pacemaker, CRT-P or CRT-D device and the date implanted
- the second bullet point should include the lead model number and year implanted.

RISK SCORES
IF THE PATIENT HAS ATRIAL FIBRILLATION
Need to calculate CHA2DS2-VASc from the encounter documentation. Do not guess
missing information.

CHF/LV dysfunction: 1
Hypertension: 1
Age >=75: 2
Diabetes: 1
Prior stroke/TIA/systemic embolism: 2
Vascular disease (MI/PAD/aortic plaque): 1
Age 65-74: 1
Female sex: 1

Assign only one age category. Report each component with its points, then
calculate and report the total.

Format:
CHA2DS2-VASc: [x total score] (then individual components like Agex2, CHF, HTN
or Age, Sex, CHF or Age, CVA. You can be succint/abbreviate the components).
Just report the positive scores/components. If 0, don't report it.

- Adjust text to reflect the correct spelling of names as follows: Dr. [Name],
  Dr. [Name], Dr. [Name]

Please do not write "patient denies", instead note "patient reports not having".

Final Checklist:
- All section titles are ALL CAPS.
- Appropriate medical terminology used.
- Consistent formatting between sections, including one space between.
- Omit any sections of the template that are not explicitly addressed in the
  input; do not include placeholders or statements such as "not discussed".
- Proper grammar and punctuation in paragraph sections.
- No markdown formatting; output the note in plain text.
- When discussing numbers, output numbers rather than the written number
- Always adhere strictly to these rules.
```

Doximity only lets you build custom templates on the website, not in the mobile app. The rules that took the most iteration follow.

## Never Infer Negative Findings

The most important line in the template:

> Never infer or assume negative findings if information is not provided; this is strictly prohibited and illegal.

Language models complete patterns, and clinical notes form a strong one. A model trained on enough cardiology documentation knows a review of systems tends to read "no chest pain, no shortness of breath, no palpitations," and it supplies that phrasing whether or not I said it.

A fabricated negative does more damage than a missing one. If the summary omits a symptom, I notice the gap and go look. If it asserts the patient reports no syncope and nobody ever asked about syncope, the record holds a documented negative that never happened, and nothing flags it for me. Then it propagates, because I carry that summary into the room.

I kept the harsh wording on purpose. Softer phrasing slipped.

## Calculating CHA2DS2-VASc from the Chart

The scoring section earns its space. For patients with atrial fibrillation it pulls the criteria out of what I dictated, assigns points, and sums them, which saves me the per-patient arithmetic before clinic.

Two lines make it work. The first stops a double count:

> Assign only one age category.

A 78-year-old satisfies both `Age >=75` and `Age 65-74` as the criteria are written. Without that instruction the model takes three points for age instead of two, and it inflates every score for the oldest patients.

The second is the same rule as the one above, applied to arithmetic:

> Do not guess missing information.

An unscored criterion drops the total, and CHA2DS2-VASc feeds an anticoagulation decision, so the error runs toward undertreating a patient. I would rather see a component missing and go find it than see a confident 2 that should read 4.

Asking for the components before the total also improves the arithmetic. The model works each line, then sums, rather than producing a number and reasoning backward. The output then compresses to the contributors:

```
CHA2DS2-VASc: 4 (Age=2, HTN=1, CHF=1)
```

I check those components against the chart. The score is a starting point for the visit, not a substitute for reading the record.

## Omit Sections, Do Not Placeholder

Two instructions cover this. `DEVICE CHECK` drops out when the patient has no device. The final checklist then bans placeholder text everywhere:

> Omit any sections of the template that are not explicitly addressed in the input; do not include placeholders or statements such as "not discussed".

Without it the notes fill with empty scaffolding: "Device Check: not discussed," "Laboratory: none noted." Once a note runs mostly filler, I skim it, and a note I skim is a note I stop trusting. Empty sections get me there faster than any other formatting problem.

## Plain Text, Because EHRs Render Markdown Literally

> No markdown formatting; output the note in plain text.

Models default to markdown. Most EHRs render it as written, so a note formatted with `**Assessment**` and `- bullet` lands in the chart with the asterisks and hyphens showing, and I clean it by hand.

ALL CAPS section titles replace it. They survive a paste into a plain-text field, which is what most chart notes are.

## Teach It the Local Names

Transcription handles common medical vocabulary well and proper nouns badly. Colleague names come back mangled, and every note I write names a referring physician.

One line of correct spellings fixes it:

> Adjust text to reflect the correct spelling of names as follows: Dr. [Name], Dr. [Name], Dr. [Name]

The same trick covers any vocabulary local to your practice: device model numbers, hospital names, referring groups. List whatever the transcription model has no reason to know.

## Make It Check Its Own Work

The template closes by asking for a review:

> After drafting the note, validate that all instructions have been strictly followed; if any instruction is unmet, self-correct before submitting the note.

The final checklist then restates the constraints that slip most. Formatting rules stated once near the top of a long prompt fade by the end of a long note, and repeating them at the point of review brings them back.

## Two Language Rules

These two belong to clinical writing rather than prompting.

**"Patient denies" becomes "patient reports not having."** *Denies* implies the patient is withholding something. It is standard usage and a bad habit. Anyone who reads the chart later hears it, including the patient.

**Numerals rather than written numbers.** Billing and later chart review both go easier when values appear as numerals.

## What It Does Not Do

The output is a summary I read before clinic. I do not file it. Everything in it traces to something I said out loud while looking at the record, so it repeats every error in the source and every misreading of mine. I check device model numbers and imaging dates against the chart before they matter.

The template holds no HPI, assessment, or plan, because I have not seen the patient yet. I tried making one template serve both precharting and encounter notes and got worse output for each.

Check your organization's policy on AI-assisted documentation before pointing any of this at real records.

## Bottom Line

I no longer organize while I read. The template holds the structure, so my reading pass can stay as disordered as the chart.

That is a smaller claim than the ambient-scribe pitch. It has been worth more to me in clinic.
