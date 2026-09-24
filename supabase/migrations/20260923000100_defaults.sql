-- Default pipelines and document templates that every workspace starts with.

with p as (
  insert into public.pipelines (name, description, position) values
    ('AI Tooling Clients', 'Businesses that need AI tooling / automation', 0),
    ('Enterprise CRM', 'Enterprise CRM implementations and migrations', 1),
    ('SaaS Customers', 'Self-serve and sales-assisted SaaS subscriptions', 2)
  returning id, name
)
insert into public.pipeline_stages (pipeline_id, name, position, probability, kind)
select p.id, s.name, s.position, s.probability, s.kind
from p
cross join (values
  ('Lead', 0, 10, 'open'),
  ('Qualified', 1, 25, 'open'),
  ('Discovery call', 2, 40, 'open'),
  ('Proposal / Pilot', 3, 60, 'open'),
  ('Negotiation', 4, 80, 'open'),
  ('Won', 5, 100, 'won'),
  ('Lost', 6, 0, 'lost')
) as s(name, position, probability, kind);

insert into public.document_templates (name, category, description, body_html) values
(
  'B2B Discovery Call Script', 'b2b_script',
  'Structured discovery call for business buyers. Focuses on past behaviour, cost of the problem and who approves budget.',
  '<h1>B2B Discovery Call — {{Company}}</h1>
<p><strong>Goal:</strong> Confirm the problem is frequent, painful, and has a budget owner. Do not pitch until step 4.</p>
<h2>1. Opener (1 min)</h2>
<p>"Thanks for making time, {{Name}}. I''d love to understand how your team handles {{workflow}} today — no pitch, just learning. Is 20 minutes still OK?"</p>
<h2>2. Past behaviour (10 min)</h2>
<ul><li>When did {{problem}} last happen? Walk me through it.</li><li>How do you solve it today? Which tools or people are involved?</li><li>Roughly how many hours or dollars does it cost per month?</li><li>What have you tried before? What did it do well, what frustrated you?</li></ul>
<h2>3. Buying process (5 min)</h2>
<ul><li>Who else feels this pain? Who approves purchases like this?</li><li>What outcome would justify paying to fix it?</li><li>What would stop you from switching?</li></ul>
<h2>4. Human-on-the-Loop positioning (3 min)</h2>
<p>"We combine automated speed with accountable human review wherever accuracy matters. For you that would mean {{measurable outcome}}."</p>
<h2>5. Commitment ask</h2>
<ul><li>Paid pilot / refundable deposit / letter of intent</li><li>Access to sample data</li><li>Introduction to the decision-maker</li></ul>
<h2>Notes</h2><p></p>'
),
(
  'B2C Sales Script', 'b2c_script',
  'Short consultative script for individual buyers, inbound or outbound.',
  '<h1>B2C Conversation — {{Customer}}</h1>
<h2>Warm open</h2><p>"Hi {{Name}}, you reached out about {{topic}} — what made now the right time?"</p>
<h2>Understand the situation</h2>
<ul><li>What are you trying to achieve?</li><li>What have you tried so far?</li><li>What happens if nothing changes?</li></ul>
<h2>Present the fit</h2><p>Tie one feature to the exact outcome they described. Keep it to two sentences.</p>
<h2>Handle objections</h2>
<ul><li><strong>Price:</strong> compare to the cost of the status quo they described.</li><li><strong>Timing:</strong> offer a small first step.</li><li><strong>Trust:</strong> explain the human review behind every result.</li></ul>
<h2>Close</h2><p>"Would you like to start with {{plan}} today? I''ll personally help you set it up."</p>'
),
(
  'Lead Generation Outreach Sequence', 'lead_gen',
  'Three-touch cold outreach for businesses that could use AI tooling.',
  '<h1>Outreach Sequence — {{Segment}}</h1>
<h2>Email 1 — Problem-first</h2>
<p>Subject: {{Company}}''s {{process}}</p>
<p>Hi {{Name}}, I noticed {{pain signal from research}}. Teams like yours usually lose {{X hours/week}} to this. We automate it with a human reviewer on every edge case, so accuracy doesn''t drop. Worth a 15-minute look?</p>
<h2>Email 2 — Proof (day 3)</h2>
<p>Share one concrete before/after result for a similar company.</p>
<h2>Email 3 — Breakup (day 7)</h2>
<p>"Should I close the loop on this? If {{process}} becomes a priority later, reply anytime."</p>
<h2>LinkedIn touch</h2><p>Connect with a one-line note referencing their recent post or company news.</p>'
),
(
  'One-Page Product Hypothesis', 'research',
  'Playbook step 1 — capture an idea as a testable hypothesis.',
  '<h1>Product Hypothesis — {{Idea}}</h1>
<p><strong>We believe</strong> {{customer}} <strong>has</strong> {{problem}} <strong>and will pay for</strong> {{solution}} <strong>because it produces</strong> {{measurable outcome}}.</p>
<h2>Target customer</h2><p></p><h2>Problem</h2><p></p><h2>Proposed solution</h2><p></p><h2>Expected outcome</h2><p></p><h2>Why customers might pay</h2><p></p><h2>Why our team can deliver it</h2><p></p><h2>Assumptions that could make it fail</h2><ul><li></li></ul>'
),
(
  'Pilot Proposal', 'proposal',
  'Paid pilot proposal used in playbook step 6.',
  '<h1>Pilot Proposal for {{Company}}</h1>
<h2>The problem we heard</h2><p></p>
<h2>What the pilot delivers</h2><ul><li>Scope</li><li>Human review coverage</li><li>Success metric</li></ul>
<h2>Timeline</h2><p>{{N}} weeks, starting {{date}}.</p>
<h2>Investment</h2><p>{{price}} — credited toward the first year if you continue.</p>
<h2>What we need from you</h2><ul><li>Sample data</li><li>A weekly 30-minute check-in</li><li>A decision-maker at the final review</li></ul>'
);
