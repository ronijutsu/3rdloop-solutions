-- Internship program: a template category plus the full document set for running
-- an internship cohort, from planning and the school agreement through
-- recruitment, onboarding, evaluation and offboarding.
-- Philippine context: CHED CMO No. 104 s. 2017 (college SIPP), DepEd Order No. 30
-- s. 2017 (SHS work immersion), and RA 10173 (Data Privacy Act).

alter table public.document_templates drop constraint document_templates_category_check;
alter table public.document_templates add constraint document_templates_category_check
  check (category in ('b2b_script', 'b2c_script', 'lead_gen', 'proposal', 'sop', 'research', 'internship', 'other'));

insert into public.document_templates (name, category, description, body_html) values
(
  'Internship Program Playbook', 'internship',
  'Start here. How 3rdLoop runs an internship cohort end to end: roles, timeline, the document for each step, and compliance.',
  $html$<h1>Internship Program Playbook — {{Cohort name, e.g. 2027 Summer Cohort}}</h1>
<p><strong>Program owner:</strong> {{Founder}} · <strong>Cohort dates:</strong> {{start date}} to {{end date}} · <strong>Interns:</strong> {{number}}</p>
<h2>1. Why we run internships</h2>
<ul><li>Develop early-career talent in AI tooling, CRM, and SaaS work, the way we work: automation for speed, a human reviewer accountable for accuracy (Human-on-the-Loop).</li><li>Build a hiring pipeline: strong interns get first consideration for paid roles.</li><li>Ship real, scoped work that a mentor reviews before it reaches a client.</li></ul>
<h2>2. Program types</h2>
<table><tbody>
<tr><th><p>Type</p></th><th><p>Who</p></th><th><p>Basis</p></th><th><p>Required paperwork</p></th></tr>
<tr><td><p>Academic (OJT / practicum)</p></td><td><p>College students needing internship hours for credit</p></td><td><p>CHED CMO No. 104 s. 2017 (SIPP)</p></td><td><p>School MOA, training plan, endorsement letter, parental consent (if under 18), proof of insurance, school evaluation forms</p></td></tr>
<tr><td><p>Work immersion</p></td><td><p>Senior high school students</p></td><td><p>DepEd Order No. 30 s. 2017</p></td><td><p>School MOA, parental consent, immersion plan; no hazardous work, daytime hours only</p></td></tr>
<tr><td><p>Graduate / non-academic</p></td><td><p>Recent graduates and career shifters</p></td><td><p>Internship agreement with us directly</p></td><td><p>Internship agreement, offer letter; follow DOLE rules and get counsel review if the arrangement looks like employment</p></td></tr>
</tbody></table>
<p><em>Have counsel review the agreements before the first cohort and whenever the rules change.</em></p>
<h2>3. Roles</h2>
<ul><li><strong>Program owner:</strong> runs the cohort, signs agreements, owns this playbook.</li><li><strong>Mentor (one per intern):</strong> writes the training plan, reviews all work, holds weekly 1:1s, completes evaluations.</li><li><strong>Buddy (optional):</strong> a peer for day-to-day questions.</li><li><strong>School coordinator:</strong> the school's point of contact for academic interns.</li></ul>
<h2>4. Timeline and documents</h2>
<table><tbody>
<tr><th><p>When</p></th><th><p>Step</p></th><th><p>Template</p></th></tr>
<tr><td><p>8 weeks before</p></td><td><p>Define tracks, number of slots, mentors, allowance budget</p></td><td><p>This playbook; Internship Training Plan</p></td></tr>
<tr><td><p>8 weeks before</p></td><td><p>Sign agreements with partner schools</p></td><td><p>Internship MOA (School Partnership)</p></td></tr>
<tr><td><p>6 weeks before</p></td><td><p>Publish postings and collect applications</p></td><td><p>Internship Posting</p></td></tr>
<tr><td><p>4–5 weeks before</p></td><td><p>Screen, interview, score</p></td><td><p>Intern Interview Scorecard</p></td></tr>
<tr><td><p>3 weeks before</p></td><td><p>Make offers, collect signed agreements and requirements</p></td><td><p>Internship Offer Letter; Intern Agreement and Undertaking</p></td></tr>
<tr><td><p>Day 1 – Week 1</p></td><td><p>Onboard, set up accounts, agree on goals</p></td><td><p>Intern Onboarding Checklist; Internship Training Plan</p></td></tr>
<tr><td><p>Weekly</p></td><td><p>Log hours, report progress, 1:1 with mentor</p></td><td><p>Intern Weekly Report and Time Log</p></td></tr>
<tr><td><p>Midpoint and end</p></td><td><p>Evaluate against the training plan</p></td><td><p>Intern Performance Evaluation</p></td></tr>
<tr><td><p>Last week</p></td><td><p>Offboard, certify, collect feedback, decide on return offers</p></td><td><p>Intern Offboarding and Exit Feedback; Certificate of Completion</p></td></tr>
</tbody></table>
<h2>5. Program rules</h2>
<ul><li><strong>Hours:</strong> {{hours}} per week, {{schedule}}; total required hours per the school: {{hours}}. No overtime, night work, or hazardous tasks for minors.</li><li><strong>Allowance:</strong> ₱{{amount}} per {{day/month}}, plus {{transport/internet}} support for remote work.</li><li><strong>Work setup:</strong> {{onsite / hybrid / remote}}. Remote interns get the tools and accounts listed in the onboarding checklist.</li><li><strong>Learning first:</strong> each intern has a written training plan. Interns are not used to replace regular staff.</li><li><strong>Human review:</strong> nothing an intern produces goes to a client without mentor review.</li><li><strong>Data privacy:</strong> interns get least-privilege access (Viewer or Team member role in Settings → Team, never Founder or Admin) and sign the confidentiality undertaking before access is granted. Revoke access on the last day.</li></ul>
<h2>6. Budget</h2>
<table><tbody>
<tr><th><p>Item</p></th><th><p>Per intern</p></th><th><p>Cohort total</p></th></tr>
<tr><td><p>Allowance</p></td><td><p>₱</p></td><td><p>₱</p></td></tr>
<tr><td><p>Equipment / tools</p></td><td><p>₱</p></td><td><p>₱</p></td></tr>
<tr><td><p>Insurance (if not provided by the school)</p></td><td><p>₱</p></td><td><p>₱</p></td></tr>
<tr><td><p>Mentor time (hours)</p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<h2>7. Success metrics</h2>
<ul><li>Completion rate: {{target}}%</li><li>Average final evaluation: {{target}} / 5</li><li>Intern satisfaction (exit survey): {{target}} / 5</li><li>Return offers extended / accepted: {{target}}</li></ul>
<h2>8. Retrospective (after the cohort)</h2><p>What worked, what to change, and updates to make to these templates.</p>$html$
),
(
  'Internship MOA (School Partnership)', 'internship',
  'Memorandum of Agreement between a school (HEI or SHS) and 3rdLoop as host training establishment.',
  $html$<h1>Memorandum of Agreement — Student Internship Program</h1>
<p><strong>KNOW ALL MEN BY THESE PRESENTS:</strong></p>
<p>This Memorandum of Agreement is entered into this {{date}} at {{city}}, Philippines, by and between:</p>
<p><strong>{{School name}}</strong>, an educational institution with address at {{address}}, represented by {{name, title}} (the "<strong>School</strong>");</p>
<p>— and —</p>
<p><strong>3rdLoop Solutions</strong>, with address at {{address}}, represented by {{name, title}} (the "<strong>Host Training Establishment</strong>" or "<strong>HTE</strong>").</p>
<h2>Whereas</h2>
<ul><li>The School requires its students in {{program}} to complete {{hours}} hours of internship as part of their curriculum, in accordance with {{CHED CMO No. 104 s. 2017 / DepEd Order No. 30 s. 2017}};</li><li>The HTE agrees to provide a learning environment and supervised training for the School's students.</li></ul>
<h2>1. Responsibilities of the School</h2>
<ul><li>Endorse qualified students with the required documents (endorsement letter, parental consent for minors, medical certificate, proof of enrollment).</li><li>Provide insurance coverage for each student intern for the duration of the internship.</li><li>Assign a faculty coordinator who will monitor the students and coordinate with the HTE.</li><li>Orient students on the HTE's policies and on proper conduct before deployment.</li></ul>
<h2>2. Responsibilities of the HTE</h2>
<ul><li>Provide a training plan aligned with the student's program and learning outcomes.</li><li>Assign a qualified supervisor/mentor for each student.</li><li>Provide a safe workplace (or remote setup) and orient students on safety, data privacy, and company policies.</li><li>Keep attendance records and submit evaluations to the School on the agreed schedule.</li><li>Not assign students to hazardous work, and not use students to replace regular employees.</li></ul>
<h2>3. Responsibilities of the Student Intern</h2>
<p>Students will sign the HTE's Intern Agreement and Undertaking covering conduct, confidentiality, intellectual property, and data privacy.</p>
<h2>4. Duration and schedule</h2>
<p>{{start date}} to {{end date}}, {{hours per day}} hours per day, {{days}}, {{onsite / hybrid / remote}}.</p>
<h2>5. Allowance and benefits</h2>
<p>{{The HTE will provide an allowance of ₱amount per day/month. / No allowance; the HTE will provide transport/meal support of ₱amount.}}</p>
<h2>6. Confidentiality and data privacy</h2>
<p>Both parties will process personal data of student interns only for the purposes of this agreement and in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).</p>
<h2>7. Intellectual property</h2>
<p>Work produced by students during the internship using HTE resources or for HTE projects belongs to the HTE. Students may describe their work in portfolios and school reports without disclosing confidential information.</p>
<h2>8. No employer-employee relationship</h2>
<p>Nothing in this agreement creates an employer-employee relationship between the HTE and the student interns.</p>
<h2>9. Termination</h2>
<p>Either party may terminate this agreement with {{30}} days' written notice. The HTE may end a student's internship for serious violation of its policies, after informing the School.</p>
<h2>10. Effectivity</h2>
<p>This agreement takes effect on signing and remains in force for {{one (1) academic year}}, renewable by mutual written agreement.</p>
<h2>Signatures</h2>
<table><tbody>
<tr><td><p><strong>For the School</strong></p><p><br></p><p>______________________</p><p>{{name, title}}</p></td><td><p><strong>For 3rdLoop Solutions</strong></p><p><br></p><p>______________________</p><p>{{name, title}}</p></td></tr>
<tr><td><p>Witness: ______________________</p></td><td><p>Witness: ______________________</p></td></tr>
</tbody></table>
<p><em>Acknowledgment before a notary public, if required by the School.</em></p>$html$
),
(
  'Internship Posting', 'internship',
  'Public posting for an internship track: what the intern will do, learn, and needs to apply.',
  $html$<h1>{{Track}} Intern — 3rdLoop Solutions</h1>
<p><strong>Setup:</strong> {{onsite / hybrid / remote}}, {{city}} · <strong>Duration:</strong> {{weeks}} weeks, {{hours}} hours/week · <strong>Allowance:</strong> ₱{{amount}} per {{day/month}} · <strong>Start:</strong> {{date}}</p>
<h2>About us</h2>
<p>3rdLoop Solutions builds AI tooling, CRM implementations, and SaaS products for Philippine businesses. We pair automation with accountable human review, so our clients get speed without losing accuracy.</p>
<h2>What you'll do</h2>
<ul><li>{{e.g. Research and qualify leads for our sales pipeline}}</li><li>{{e.g. Build and test automations with a mentor reviewing every change}}</li><li>{{e.g. Document processes and write SOPs}}</li><li>Present your work to the team at the end of the program.</li></ul>
<h2>What you'll learn</h2>
<ul><li>{{skill 1}}</li><li>{{skill 2}}</li><li>How a small product team works: planning, reviews, and shipping.</li></ul>
<h2>Who we're looking for</h2>
<ul><li>{{Course/year level, or recent graduate}}</li><li>{{Required skill, e.g. comfortable with spreadsheets and Google Workspace}}</li><li>Clear written communication in English and Filipino.</li><li>Curious, organised, and willing to ask questions.</li><li><em>Nice to have:</em> {{optional skill}}</li></ul>
<h2>Track options</h2>
<p>{{Business development · Operations · Software development · Content and marketing}}</p>
<h2>How to apply</h2>
<p>Send your CV, a short note on why you're interested (150 words max), and {{a portfolio link / a sample of written work}} to {{email}} with the subject "Internship — {{Track}}" by {{deadline}}.</p>
<p>For academic internships, include your school's endorsement letter and required hours.</p>
<h2>Process</h2>
<ol><li>Application review ({{1 week}})</li><li>30-minute interview</li><li>Short practical exercise ({{1–2 hours}})</li><li>Offer</li></ol>$html$
),
(
  'Intern Interview Scorecard', 'internship',
  'Structured screening and interview scorecard so every applicant is scored on the same criteria.',
  $html$<h1>Intern Interview Scorecard — {{Applicant name}}</h1>
<p><strong>Track:</strong> {{track}} · <strong>School / background:</strong> {{school, course, year}} · <strong>Interviewer:</strong> {{name}} · <strong>Date:</strong> {{date}}</p>
<h2>Requirements check</h2>
<ul><li>Available for the full program dates and required hours</li><li>School endorsement letter (academic interns)</li><li>CV and application note received</li></ul>
<h2>Questions</h2>
<ol><li>Tell us about a project (school, personal, or work) you're proud of. What was your part?</li><li>Walk me through how you'd figure out something you've never done before.</li><li>Tell me about a mistake you made and what you did after.</li><li>What do you want to be able to do at the end of this internship?</li><li>{{Track-specific question}}</li><li>Questions from the applicant.</li></ol>
<h2>Practical exercise</h2>
<p><strong>Task given:</strong> {{e.g. Qualify 5 leads from this list and explain your reasoning}}</p>
<p><strong>Observations:</strong></p>
<h2>Scores (1 = weak, 5 = excellent)</h2>
<table><tbody>
<tr><th><p>Criterion</p></th><th><p>Score</p></th><th><p>Evidence</p></th></tr>
<tr><td><p>Communication</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Problem solving</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Track skills</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Learning attitude / coachability</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Reliability and ownership</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p>/ 25</p></td><td><p></p></td></tr>
</tbody></table>
<h2>Recommendation</h2>
<p>☐ Strong yes ☐ Yes ☐ No ☐ Strong no</p>
<p><strong>Reason:</strong></p>$html$
),
(
  'Internship Offer Letter', 'internship',
  'Offer letter confirming track, dates, schedule, allowance, mentor, and the documents to submit.',
  $html$<h1>Internship Offer</h1>
<p>{{date}}</p>
<p>{{Applicant name}}<br>{{Address}}</p>
<p>Dear {{First name}},</p>
<p>We're happy to offer you a place in the 3rdLoop Solutions {{Cohort name}} as a <strong>{{Track}} Intern</strong>.</p>
<h2>Details</h2>
<table><tbody>
<tr><td><p><strong>Start / end date</strong></p></td><td><p>{{start date}} to {{end date}}</p></td></tr>
<tr><td><p><strong>Schedule</strong></p></td><td><p>{{days}}, {{hours}}; {{total required hours}} hours in total</p></td></tr>
<tr><td><p><strong>Work setup</strong></p></td><td><p>{{onsite at address / hybrid / remote}}</p></td></tr>
<tr><td><p><strong>Mentor</strong></p></td><td><p>{{mentor name, role}}</p></td></tr>
<tr><td><p><strong>Allowance</strong></p></td><td><p>₱{{amount}} per {{day/month}}, released every {{payout schedule}}</p></td></tr>
<tr><td><p><strong>Equipment</strong></p></td><td><p>{{provided laptop / bring your own device}}</p></td></tr>
</tbody></table>
<p>This internship is a training program. It does not create an employer-employee relationship.</p>
<h2>Before your first day, please submit</h2>
<ul><li>Signed Intern Agreement and Undertaking (attached)</li><li>School endorsement letter and MOA reference (academic interns)</li><li>Parental consent (if under 18)</li><li>Proof of insurance coverage (from your school, or let us know if you have none)</li><li>Valid ID and emergency contact details</li><li>{{Medical certificate, if required by your school}}</li></ul>
<p>Please confirm by signing below and replying by <strong>{{deadline}}</strong>.</p>
<p>Welcome aboard,</p>
<p>{{Name}}<br>{{Title}}, 3rdLoop Solutions</p>
<h2>Acceptance</h2>
<p>I accept this internship offer under the terms above.</p>
<p>Signature: ______________________ Date: __________</p>$html$
),
(
  'Intern Agreement and Undertaking', 'internship',
  'Signed by every intern: conduct, schedule, confidentiality, IP, data privacy consent, and tool use.',
  $html$<h1>Intern Agreement and Undertaking</h1>
<p>I, <strong>{{Intern name}}</strong>, of {{address}}, joining 3rdLoop Solutions ("the Company") as a {{Track}} Intern from {{start date}} to {{end date}}, agree to the following:</p>
<h2>1. Nature of the internship</h2>
<p>This is a training arrangement {{under the MOA with School name}}. It does not create an employer-employee relationship. My allowance, if any, is not a wage.</p>
<h2>2. Schedule and attendance</h2>
<ul><li>I will follow the agreed schedule of {{days, hours}} and log my hours in the weekly report.</li><li>I will tell my mentor in advance if I will be absent or late.</li></ul>
<h2>3. Conduct</h2>
<ul><li>I will follow Company policies and treat colleagues, clients, and partners with respect.</li><li>I will not represent myself as a Company employee or make commitments to clients.</li><li>My work goes through mentor review before it is used or sent outside the Company.</li></ul>
<h2>4. Confidentiality</h2>
<p>I will keep confidential all non-public information I receive, including client data, leads, pricing, source code, product plans, and internal documents, during and after the internship. I will return or delete Company materials on my last day.</p>
<h2>5. Intellectual property</h2>
<p>Work I create for the Company or using Company resources during the internship belongs to the Company. I may describe my work in my resume, portfolio, and school reports without disclosing confidential information, and after the Company reviews any screenshots or samples.</p>
<h2>6. Accounts, tools, and AI use</h2>
<ul><li>I will use only the accounts and access given to me, and not share passwords.</li><li>I will not paste client or confidential data into AI tools or services the Company has not approved.</li><li>I understand access is removed at the end of the internship.</li></ul>
<h2>7. Data privacy consent</h2>
<p>I consent to the Company collecting and processing my personal data (identity, contact details, school records, attendance, and evaluations) for running the internship, coordinating with my school, and issuing certificates, in accordance with RA 10173 (Data Privacy Act of 2012). I know I can ask to access or correct my data by contacting {{privacy contact email}}.</p>
<h2>8. Ending the internship</h2>
<p>Either party may end the internship early with {{one week}}'s notice. The Company may end it immediately for serious misconduct or a breach of confidentiality, after informing my school if applicable.</p>
<h2>Signatures</h2>
<table><tbody>
<tr><td><p><strong>Intern</strong></p><p><br></p><p>______________________</p><p>{{Intern name}} · Date: ______</p></td><td><p><strong>Parent / guardian</strong> (if under 18)</p><p><br></p><p>______________________</p><p>Name · Date: ______</p></td></tr>
<tr><td><p><strong>For 3rdLoop Solutions</strong></p><p><br></p><p>______________________</p><p>{{name, title}} · Date: ______</p></td><td><p></p></td></tr>
</tbody></table>$html$
),
(
  'Internship Training Plan', 'internship',
  'Mentor-written plan: learning objectives, weekly milestones, and the final project. Required by schools for academic interns.',
  $html$<h1>Internship Training Plan — {{Intern name}}</h1>
<p><strong>Track:</strong> {{track}} · <strong>Mentor:</strong> {{mentor}} · <strong>School / program:</strong> {{school, course}} · <strong>Required hours:</strong> {{hours}} · <strong>Dates:</strong> {{start}} to {{end}}</p>
<h2>Learning objectives</h2>
<p>By the end of the internship, the intern will be able to:</p>
<ol><li>{{Objective tied to the school's learning outcomes or the track}}</li><li>{{Objective}}</li><li>{{Objective}}</li></ol>
<h2>Weekly plan</h2>
<table><tbody>
<tr><th><p>Week</p></th><th><p>Focus</p></th><th><p>Activities / deliverables</p></th><th><p>Objective</p></th></tr>
<tr><td><p>1</p></td><td><p>Orientation</p></td><td><p>Onboarding, tools setup, shadow the team, read the playbook</p></td><td><p></p></td></tr>
<tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>3</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>4</p></td><td><p>Midpoint review</p></td><td><p>Midpoint evaluation and plan adjustments</p></td><td><p></p></td></tr>
<tr><td><p>5</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>6</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>7</p></td><td><p>Final project</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>8</p></td><td><p>Wrap-up</p></td><td><p>Final presentation, handover, final evaluation</p></td><td><p></p></td></tr>
</tbody></table>
<h2>Final project</h2>
<p><strong>Problem:</strong> {{a real, scoped problem the team needs solved}}</p>
<p><strong>Deliverable:</strong> {{what will be handed over}}</p>
<p><strong>Success looks like:</strong> {{measurable outcome}}</p>
<h2>Support</h2>
<ul><li>Weekly 1:1 with mentor: {{day, time}}</li><li>Buddy: {{name}}</li><li>Tools and access: {{list}}</li></ul>
<h2>Sign-off</h2>
<p>Mentor: ______________________ Intern: ______________________ School coordinator: ______________________</p>$html$
),
(
  'Intern Onboarding Checklist', 'internship',
  'Before day 1, day 1, and week 1 checklist for the program owner, mentor, and intern.',
  $html$<h1>Intern Onboarding Checklist — {{Intern name}}</h1>
<p><strong>Start date:</strong> {{date}} · <strong>Mentor:</strong> {{mentor}} · <strong>Buddy:</strong> {{buddy}}</p>
<h2>Before day 1 (program owner)</h2>
<ul><li>Signed offer letter and Intern Agreement and Undertaking received</li><li>School requirements on file: endorsement, MOA, insurance, parental consent (if under 18)</li><li>Account created in Settings → Team with the Viewer or Team member role (least-privilege access)</li><li>Email, chat, and tool accounts created</li><li>Equipment ready or BYOD requirements sent</li><li>Training plan drafted by the mentor</li><li>Welcome email sent with schedule, first-day agenda, and who to contact</li></ul>
<h2>Day 1</h2>
<ul><li>Welcome and introductions to the team</li><li>Company overview: what we build, who our clients are, Human-on-the-Loop</li><li>Walkthrough of policies: conduct, confidentiality, data privacy, approved AI tools</li><li>Tools setup and first login checked</li><li>Review the training plan together and agree on week 1 goals</li><li>Explain the weekly report, time log, and 1:1 schedule</li></ul>
<h2>Week 1</h2>
<ul><li>Shadow at least {{2}} team meetings or client calls (with client consent)</li><li>Complete a first small task with mentor review</li><li>Buddy check-in</li><li>First weekly report submitted</li><li>End-of-week 1:1: what's clear, what's confusing</li></ul>
<h2>Notes</h2><p></p>$html$
),
(
  'Intern Weekly Report and Time Log', 'internship',
  'Weekly progress report with a daily time log, signed by the mentor. Doubles as the school''s attendance record.',
  $html$<h1>Weekly Report — {{Intern name}}, Week {{N}}</h1>
<p><strong>Week of:</strong> {{date}} · <strong>Mentor:</strong> {{mentor}}</p>
<h2>Time log</h2>
<table><tbody>
<tr><th><p>Date</p></th><th><p>Time in</p></th><th><p>Time out</p></th><th><p>Hours</p></th><th><p>Main activity</p></th></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Total this week</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p>Cumulative: {{hours}} / {{required hours}}</p></td></tr>
</tbody></table>
<h2>What I completed</h2><ul><li></li></ul>
<h2>What I learned</h2><ul><li></li></ul>
<h2>Blockers / questions</h2><ul><li></li></ul>
<h2>Plan for next week</h2><ul><li></li></ul>
<h2>Mentor feedback</h2><p></p>
<p>Mentor signature: ______________________ Date: __________</p>$html$
),
(
  'Intern Performance Evaluation', 'internship',
  'Midpoint and final evaluation against the training plan, with ratings and narrative feedback.',
  $html$<h1>Intern Evaluation — {{Intern name}}</h1>
<p><strong>Type:</strong> ☐ Midpoint ☐ Final · <strong>Track:</strong> {{track}} · <strong>Evaluator:</strong> {{mentor}} · <strong>Date:</strong> {{date}} · <strong>Hours completed:</strong> {{hours}} / {{required}}</p>
<h2>Ratings (1 = needs improvement, 5 = outstanding)</h2>
<table><tbody>
<tr><th><p>Area</p></th><th><p>Rating</p></th><th><p>Comments</p></th></tr>
<tr><td><p>Quality of work</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Technical / track skills</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Communication</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Initiative and problem solving</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Reliability and attendance</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Teamwork and professionalism</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Responds to feedback</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Average</strong></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<h2>Learning objectives</h2>
<table><tbody>
<tr><th><p>Objective (from training plan)</p></th><th><p>Met / Partly / Not yet</p></th><th><p>Evidence</p></th></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<h2>Strengths</h2><p></p>
<h2>Areas to develop</h2><p></p>
<h2>Midpoint only: goals for the second half</h2><p></p>
<h2>Final only: recommendation</h2>
<p>☐ Return offer / paid role ☐ Recommend for future cohorts ☐ No recommendation</p>
<h2>Intern's comments</h2><p></p>
<h2>Signatures</h2>
<p>Evaluator: ______________________ Intern: ______________________ Date: __________</p>
<p><em>For academic interns, also complete the school's own evaluation form if one is required.</em></p>$html$
),
(
  'Intern Offboarding and Exit Feedback', 'internship',
  'Last-week checklist (handover, access removal, clearance) and the intern''s feedback on the program.',
  $html$<h1>Offboarding and Exit Feedback — {{Intern name}}</h1>
<p><strong>Last day:</strong> {{date}} · <strong>Mentor:</strong> {{mentor}}</p>
<h2>Offboarding checklist</h2>
<ul><li>Final presentation delivered</li><li>Work handed over: files in the shared drive, open tasks reassigned, notes written</li><li>Final evaluation completed and sent to the school (academic interns)</li><li>Total hours confirmed and certificate of completion issued</li><li>Final allowance released</li><li>Company equipment returned</li><li>Accounts deactivated (role set to Disabled in Settings → Team; email, chat, third-party tools) on the last day</li><li>Confidential files deleted from personal devices (intern confirms below)</li><li>Return-offer decision communicated</li></ul>
<p>I confirm I have returned or deleted all Company materials. Intern signature: ______________________</p>
<h2>Exit feedback (completed by the intern)</h2>
<table><tbody>
<tr><th><p>Question</p></th><th><p>Rating 1–5</p></th></tr>
<tr><td><p>I learned skills I can use in my career</p></td><td><p></p></td></tr>
<tr><td><p>My mentor gave me useful, timely feedback</p></td><td><p></p></td></tr>
<tr><td><p>My work was meaningful, not busywork</p></td><td><p></p></td></tr>
<tr><td><p>Onboarding prepared me well</p></td><td><p></p></td></tr>
<tr><td><p>I would recommend this internship to a friend</p></td><td><p></p></td></tr>
</tbody></table>
<h2>What was the most valuable part?</h2><p></p>
<h2>What should we change for the next cohort?</h2><p></p>
<h2>Would you like to be considered for future roles?</h2><p>☐ Yes ☐ No</p>$html$
),
(
  'Internship Certificate of Completion', 'internship',
  'Certificate issued on completion of the required hours.',
  $html$<h1>Certificate of Completion</h1>
<p>This is to certify that</p>
<h2>{{Intern full name}}</h2>
<p>{{of School name, Course}}</p>
<p>has satisfactorily completed <strong>{{hours}} hours</strong> of internship as a <strong>{{Track}} Intern</strong> at 3rdLoop Solutions from <strong>{{start date}}</strong> to <strong>{{end date}}</strong>.</p>
<p>During the internship, {{he/she/they}} {{one or two sentences on key contributions, e.g. built and tested lead qualification workflows and documented three SOPs}}.</p>
<p>Issued on {{date}} at {{city}}, Philippines, for whatever legal purpose it may serve.</p>
<p><br></p>
<table><tbody>
<tr><td><p>______________________</p><p>{{Mentor name}}</p><p>Internship Mentor</p></td><td><p>______________________</p><p>{{Name}}</p><p>{{Title}}, 3rdLoop Solutions</p></td></tr>
</tbody></table>$html$
);
