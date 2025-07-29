---
title:  Doximity AI Scribe Experience
description: My experience using Doximity's new AI Scribe feature for cardiology documentation including setup and workflow.
date: 2025-07-28
img: ../assets/images/doximity.png
categories: [AI]
---

# My Experience with Doximity AI Scribe

As a cardiologist constantly battling documentation burden, I was intrigued when Doximity launched their AI Scribe feature. After using it in clinic, I'm impressed by both its simplicity and effectiveness.

## Getting Started

Setup is straightforward: sign up online at [doximity.com](https://www.doximity.com/scribe/access_requests) and update your mobile app (available for iOS and Android). The Scribe function appears as a prominent button in the bottom right of the lower tab bar.

## My Workflow

The interface is simple. There's one button to start and stop recording, with pause functionality when needed. My typical workflow:

1. **Pre-encounter recording**: I start outside the patient room, discussing background information, prior testing details, patient demographics, vital signs, and available lab results
2. **Patient consent**: Enter the room and obtain verbal consent to record
3. **Continue recording**: Conduct the full consultation while recording
4. **Generate note**: Click "done" and let the AI process the audio

## Processing and Output

Notes populate automatically on the doximity.com website, where the real power becomes apparent. You can copy and paste directly into your EHR, or in my case with paper charts, simply print the formatted note.

The most significant benefit has been the ability to maintain uninterrupted patient focus during encounters. During a 30-minute consultation, I was able to engage fully with the patient without the distraction of note-taking or computer documentation. What impressed me most was the AI's ability to intelligently filter the conversation. It captured all clinically relevant information while appropriately excluding casual discussions about family and personal topics that naturally occur during patient interactions. This selective processing ensures professional medical documentation while preserving the human connection that's essential to quality patient care.

## Why AI Notes Matter for Proceduralists

As a procedural cardiologist, comprehensive documentation of procedural discussions has always been challenging while maintaining patient engagement. AI scribes solve this by capturing every detail of risk-benefit conversations without requiring divided attention. When discussing ablation risks—bleeding, vascular complications, pacemaker risk, etc, I can focus entirely on patient concerns and questions rather than frantically documenting. 

This comprehensive documentation proves invaluable for procedures requiring extensive informed consent. Rather than generic templated language, my notes now reflect the actual conversation: which specific risks concerned the patient, how I addressed their fears about anesthesia, why we chose one approach over alternatives. This level of detail protects both patient and physician while demonstrating truly informed consent.

For complex cases involving multiple therapeutic options, the AI captures the entire decision-making process. When a patient asks about surgical versus percutaneous options, every pro and con discussed is documented verbatim. This thoroughness has already proven valuable during peer reviews and quality assessments.

## The Template Advantage

The most valuable feature is custom template creation. Here's the cardiology new patient encounter template I developed:

```
Please extract and organize the information into a well-structured Cardiology Consult Note.
Title the note "Consult Note", then on separate lines, list the:
- "Date"
- "Name"
- "DOB"
- "MRN"

Following that, please organize the remainder of the note into the following sections:
- "Reason for Consult" consisting of a few words on the case and capturing the primary reason for the patient encounter
- "History of Present Illness" Provide a detailed chronological narrative including onset, quality, radiation, associated symptoms, aggravating/alleviating factors, timing, and severity of cardiac symptoms. Include functional capacity assessment and recent changes in symptoms.
- "Cardiovascular History & Testing". Chronological order. Include results from echocardiograms, stress test, CT, MRI, PET, ablation, surgery, coronary intervention in the format of date: description.
- "Past Medical and Surgical History"
- "Medications"
- "Allergies"
- "Social History"
- "Family History"
- "Physical Exam" Start with vital signs blood pressure, heart rate, weight. Then list each component of exam only if noted in transcript.
- "Laboratory" only if noted in transcript.
- "Assessment" including a differential diagnosis, if relevant
- "Recommendations"
- "Procedural Risk/Benefit Discussion" (if applicable) - When any cardiac procedure is mentioned, include: Detailed explanation of the proposed procedure, Specific risks including but not limited to: bleeding, infection, vascular complications, contrast nephropathy, radiation exposure, arrhythmias, and procedure-specific risks, Expected benefits and success rates, Alternative treatment options discussed, Patient questions addressed and understanding confirmed

Please organize the sections as bulleted lists, except for the "Reason for Consult" and "History of Present Illness", and "Procedural Risk/Benefit Discussion" which should be in paragraph form. Skip sections if not mentioned in the transcript.
```

## Bottom Line

Doximity AI Scribe delivers on its promise of reducing documentation burden without sacrificing quality. For proceduralists, it transforms risk-benefit discussions from documentation nightmares into comprehensive records that protect patients and physicians alike. The template functionality ensures consistent, thorough notes tailored to cardiology practice.

For physicians drowning in paperwork while trying to maintain meaningful patient connections, this tool offers genuine relief. More importantly, it enables the kind of detailed, nuanced documentation that exemplifies quality medical care.

*Note: Always ensure compliance with your institution's policies regarding AI-assisted documentation and patient privacy.*