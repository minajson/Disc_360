-- DISC360 Workplace Scenarios v2 — replaces the v1 question bank.
--
-- Generated from data/assessment-scenarios.ts. Do not hand-edit: regenerate
-- if the bank changes. v1 rows are left in place (deactivated, not deleted)
-- so in-progress v1 sessions and every historical result stay readable.
--
-- Analytical is stored as 'C' to match the existing dimension enum and the
-- score_c column; the interface renders it as 'A'.

-- Retire v1. Sessions already pointing at it keep their questions.
update public.assessment_versions set is_active = false where is_active;

insert into public.assessment_versions (id, name, version, is_active)
values ('00000000-0000-4000-8000-000000000002', 'DISC360 Workplace Scenarios v2', 2, true);

-- s01 · decision-making
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's01', 0, 'When a team must make a difficult decision, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's01-o1', 0, 'Push for a clear decision and immediate action.', 'D'
  from public.questions where external_id = 's01' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's01-o2', 1, 'Encourage discussion and build enthusiasm around a direction.', 'I'
  from public.questions where external_id = 's01' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's01-o3', 2, 'Help everyone remain calm and find common ground.', 'S'
  from public.questions where external_id = 's01' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's01-o4', 3, 'Review the evidence, risks and consequences before deciding.', 'C'
  from public.questions where external_id = 's01' and version_id = '00000000-0000-4000-8000-000000000002';

-- s02 · communication
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's02', 1, 'When I receive a new assignment, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's02-o1', 0, 'Identify the outcome and begin moving quickly.', 'D'
  from public.questions where external_id = 's02' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's02-o2', 1, 'Clarify how it affects the people and routines involved.', 'S'
  from public.questions where external_id = 's02' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's02-o3', 2, 'Talk through the idea with others and build momentum.', 'I'
  from public.questions where external_id = 's02' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's02-o4', 3, 'Define the requirements, standards and process first.', 'C'
  from public.questions where external_id = 's02' and version_id = '00000000-0000-4000-8000-000000000002';

-- s03 · meetings
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's03', 2, 'During a meeting that is moving slowly, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's03-o1', 0, 'Re-energize the group and encourage participation.', 'I'
  from public.questions where external_id = 's03' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's03-o2', 1, 'Give people time to contribute without pressure.', 'S'
  from public.questions where external_id = 's03' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's03-o3', 2, 'Bring the conversation back to facts and objectives.', 'C'
  from public.questions where external_id = 's03' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's03-o4', 3, 'Bring the discussion to a clear decision point.', 'D'
  from public.questions where external_id = 's03' and version_id = '00000000-0000-4000-8000-000000000002';

-- s04 · deadlines
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's04', 3, 'When a deadline is at risk, I am most likely to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's04-o1', 0, 'Coordinate support so the team can recover steadily.', 'S'
  from public.questions where external_id = 's04' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's04-o2', 1, 'Reprioritize sharply and push for delivery.', 'D'
  from public.questions where external_id = 's04' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's04-o3', 2, 'Identify the source of delay and revise the plan carefully.', 'C'
  from public.questions where external_id = 's04' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's04-o4', 3, 'Rally the people involved and keep energy high.', 'I'
  from public.questions where external_id = 's04' and version_id = '00000000-0000-4000-8000-000000000002';

-- s05 · conflict
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's05', 4, 'When disagreement arises, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's05-o1', 0, 'Reduce tension and search for a solution everyone can accept.', 'S'
  from public.questions where external_id = 's05' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's05-o2', 1, 'Separate emotion from facts and examine the issue objectively.', 'C'
  from public.questions where external_id = 's05' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's05-o3', 2, 'Address it directly and argue for the strongest outcome.', 'D'
  from public.questions where external_id = 's05' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's05-o4', 3, 'Use conversation and persuasion to restore alignment.', 'I'
  from public.questions where external_id = 's05' and version_id = '00000000-0000-4000-8000-000000000002';

-- s06 · change
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's06', 5, 'When plans suddenly change, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's06-o1', 0, 'Focus on the new possibilities and share them openly.', 'I'
  from public.questions where external_id = 's06' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's06-o2', 1, 'Understand why the change occurred before altering the plan.', 'C'
  from public.questions where external_id = 's06' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's06-o3', 2, 'Adapt quickly and take control of the new direction.', 'D'
  from public.questions where external_id = 's06' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's06-o4', 3, 'Help others adjust while maintaining stability.', 'S'
  from public.questions where external_id = 's06' and version_id = '00000000-0000-4000-8000-000000000002';

-- s07 · teamwork
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's07', 6, 'In group work, I naturally:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's07-o1', 0, 'Organize information and protect quality.', 'C'
  from public.questions where external_id = 's07' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's07-o2', 1, 'Set direction and keep the team moving.', 'D'
  from public.questions where external_id = 's07' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's07-o3', 2, 'Connect people and maintain enthusiasm.', 'I'
  from public.questions where external_id = 's07' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's07-o4', 3, 'Support cooperation and dependable follow-through.', 'S'
  from public.questions where external_id = 's07' and version_id = '00000000-0000-4000-8000-000000000002';

-- s08 · leadership
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's08', 7, 'When asked to lead, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's08-o1', 0, 'Define a reliable structure and clear standards.', 'C'
  from public.questions where external_id = 's08' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's08-o2', 1, 'Inspire commitment through energy and vision.', 'I'
  from public.questions where external_id = 's08' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's08-o3', 2, 'Create trust and support people consistently.', 'S'
  from public.questions where external_id = 's08' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's08-o4', 3, 'Establish expectations and make decisions.', 'D'
  from public.questions where external_id = 's08' and version_id = '00000000-0000-4000-8000-000000000002';

-- s09 · planning
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's09', 8, 'When planning a project, I prefer to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's09-o1', 0, 'Set a challenging goal and move into execution.', 'D'
  from public.questions where external_id = 's09' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's09-o2', 1, 'Explore ideas with others before choosing an approach.', 'I'
  from public.questions where external_id = 's09' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's09-o3', 2, 'Develop a realistic pace that people can sustain.', 'S'
  from public.questions where external_id = 's09' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's09-o4', 3, 'Build a detailed plan with milestones and controls.', 'C'
  from public.questions where external_id = 's09' and version_id = '00000000-0000-4000-8000-000000000002';

-- s10 · problem-solving
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's10', 9, 'When solving an unfamiliar problem, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's10-o1', 0, 'Test a practical solution quickly and adjust.', 'D'
  from public.questions where external_id = 's10' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's10-o2', 1, 'Draw on approaches that have worked reliably before.', 'S'
  from public.questions where external_id = 's10' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's10-o3', 2, 'Generate ideas through conversation and collaboration.', 'I'
  from public.questions where external_id = 's10' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's10-o4', 3, 'Investigate the causes and compare possible solutions.', 'C'
  from public.questions where external_id = 's10' and version_id = '00000000-0000-4000-8000-000000000002';

-- s11 · feedback
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's11', 10, 'When someone gives me critical feedback, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's11-o1', 0, 'Discuss it openly and seek the wider context.', 'I'
  from public.questions where external_id = 's11' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's11-o2', 1, 'Reflect on how it affects the relationship and team.', 'S'
  from public.questions where external_id = 's11' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's11-o3', 2, 'Examine the examples and accuracy of the feedback.', 'C'
  from public.questions where external_id = 's11' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's11-o4', 3, 'Evaluate whether it will improve my results.', 'D'
  from public.questions where external_id = 's11' and version_id = '00000000-0000-4000-8000-000000000002';

-- s12 · pressure
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's12', 11, 'Under intense pressure, I may:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's12-o1', 0, 'Withdraw from conflict and try to preserve stability.', 'S'
  from public.questions where external_id = 's12' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's12-o2', 1, 'Become more forceful and more impatient.', 'D'
  from public.questions where external_id = 's12' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's12-o3', 2, 'Become more cautious and focused on possible errors.', 'C'
  from public.questions where external_id = 's12' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's12-o4', 3, 'Talk more and move rapidly between ideas.', 'I'
  from public.questions where external_id = 's12' and version_id = '00000000-0000-4000-8000-000000000002';

-- s13 · delegation
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's13', 12, 'When delegating work, I prefer to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's13-o1', 0, 'Ensure the person feels supported and comfortable.', 'S'
  from public.questions where external_id = 's13' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's13-o2', 1, 'Clarify the process, standards and checkpoints.', 'C'
  from public.questions where external_id = 's13' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's13-o3', 2, 'State the required outcome and give ownership.', 'D'
  from public.questions where external_id = 's13' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's13-o4', 3, 'Explain the purpose and build excitement.', 'I'
  from public.questions where external_id = 's13' and version_id = '00000000-0000-4000-8000-000000000002';

-- s14 · social interaction
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's14', 13, 'At a professional social event, I am likely to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's14-o1', 0, 'Meet many people and keep conversation lively.', 'I'
  from public.questions where external_id = 's14' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's14-o2', 1, 'Observe first and engage in focused conversations.', 'C'
  from public.questions where external_id = 's14' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's14-o3', 2, 'Approach the most useful contacts directly.', 'D'
  from public.questions where external_id = 's14' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's14-o4', 3, 'Spend time building a few genuine connections.', 'S'
  from public.questions where external_id = 's14' and version_id = '00000000-0000-4000-8000-000000000002';

-- s15 · quality
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's15', 14, 'When reviewing completed work, I focus first on:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's15-o1', 0, 'Whether the work is accurate and meets the standard.', 'C'
  from public.questions where external_id = 's15' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's15-o2', 1, 'Whether the desired result was achieved.', 'D'
  from public.questions where external_id = 's15' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's15-o3', 2, 'How well the work will engage and win over others.', 'I'
  from public.questions where external_id = 's15' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's15-o4', 3, 'Whether the process supported the people involved.', 'S'
  from public.questions where external_id = 's15' and version_id = '00000000-0000-4000-8000-000000000002';

-- s16 · risk
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's16', 15, 'When faced with a significant risk, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's16-o1', 0, 'Gather information and reduce uncertainty before proceeding.', 'C'
  from public.questions where external_id = 's16' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's16-o2', 1, 'Consider the opportunity and how to gain support.', 'I'
  from public.questions where external_id = 's16' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's16-o3', 2, 'Consider how the risk may affect people and continuity.', 'S'
  from public.questions where external_id = 's16' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's16-o4', 3, 'Decide whether the potential gain justifies acting.', 'D'
  from public.questions where external_id = 's16' and version_id = '00000000-0000-4000-8000-000000000002';

-- s17 · uncertainty
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's17', 16, 'When instructions are unclear, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's17-o1', 0, 'Make a reasonable decision and continue.', 'D'
  from public.questions where external_id = 's17' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's17-o2', 1, 'Ask others and develop the idea through discussion.', 'I'
  from public.questions where external_id = 's17' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's17-o3', 2, 'Seek clarification so expectations remain aligned.', 'S'
  from public.questions where external_id = 's17' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's17-o4', 3, 'Request precise requirements and supporting information.', 'C'
  from public.questions where external_id = 's17' and version_id = '00000000-0000-4000-8000-000000000002';

-- s18 · persuasion
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's18', 17, 'When I need to persuade others, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's18-o1', 0, 'Emphasize the outcome and the need for action.', 'D'
  from public.questions where external_id = 's18' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's18-o2', 1, 'Show how the idea supports people and cooperation.', 'S'
  from public.questions where external_id = 's18' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's18-o3', 2, 'Use stories, energy and personal connection.', 'I'
  from public.questions where external_id = 's18' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's18-o4', 3, 'Present evidence, logic and a well-structured case.', 'C'
  from public.questions where external_id = 's18' and version_id = '00000000-0000-4000-8000-000000000002';

-- s19 · support
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's19', 18, 'When a colleague is struggling, I am most likely to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's19-o1', 0, 'Encourage them and restore their confidence.', 'I'
  from public.questions where external_id = 's19' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's19-o2', 1, 'Listen patiently and offer dependable support.', 'S'
  from public.questions where external_id = 's19' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's19-o3', 2, 'Help them analyze the problem and build a practical solution.', 'C'
  from public.questions where external_id = 's19' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's19-o4', 3, 'Help them identify the action needed to recover.', 'D'
  from public.questions where external_id = 's19' and version_id = '00000000-0000-4000-8000-000000000002';

-- s20 · rules
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's20', 19, 'When procedures seem inefficient, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's20-o1', 0, 'Improve them gradually without disrupting stability.', 'S'
  from public.questions where external_id = 's20' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's20-o2', 1, 'Change them quickly to improve the results.', 'D'
  from public.questions where external_id = 's20' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's20-o3', 2, 'Review why they exist before recommending a controlled change.', 'C'
  from public.questions where external_id = 's20' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's20-o4', 3, 'Discuss alternatives and gain support for a better approach.', 'I'
  from public.questions where external_id = 's20' and version_id = '00000000-0000-4000-8000-000000000002';

-- s21 · priorities
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's21', 20, 'When several tasks compete for attention, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's21-o1', 0, 'Work through priorities steadily and reliably.', 'S'
  from public.questions where external_id = 's21' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's21-o2', 1, 'Rank them according to criteria, dependencies and deadlines.', 'C'
  from public.questions where external_id = 's21' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's21-o3', 2, 'Choose the highest-impact task and act.', 'D'
  from public.questions where external_id = 's21' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's21-o4', 3, 'Start with the task that creates the most momentum.', 'I'
  from public.questions where external_id = 's21' and version_id = '00000000-0000-4000-8000-000000000002';

-- s22 · learning
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's22', 21, 'When learning something new, I prefer to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's22-o1', 0, 'Learn through discussion, demonstration and interaction.', 'I'
  from public.questions where external_id = 's22' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's22-o2', 1, 'Study the principles and understand how it works.', 'C'
  from public.questions where external_id = 's22' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's22-o3', 2, 'Try it out and learn through direct action.', 'D'
  from public.questions where external_id = 's22' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's22-o4', 3, 'Follow a guided process with time to practice.', 'S'
  from public.questions where external_id = 's22' and version_id = '00000000-0000-4000-8000-000000000002';

-- s23 · execution
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's23', 22, 'When a project enters execution, I tend to:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's23-o1', 0, 'Track quality, risks and adherence to the plan.', 'C'
  from public.questions where external_id = 's23' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's23-o2', 1, 'Monitor progress closely toward the result.', 'D'
  from public.questions where external_id = 's23' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's23-o3', 2, 'Keep people engaged and communicate momentum.', 'I'
  from public.questions where external_id = 's23' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's23-o4', 3, 'Maintain coordination and consistent follow-through.', 'S'
  from public.questions where external_id = 's23' and version_id = '00000000-0000-4000-8000-000000000002';

-- s24 · recovery after setbacks
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000002', 's24', 23, 'After a major setback, I usually:');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's24-o1', 0, 'Review what failed and apply the lessons before restarting.', 'C'
  from public.questions where external_id = 's24' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's24-o2', 1, 'Restore optimism and reconnect people to the goal.', 'I'
  from public.questions where external_id = 's24' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's24-o3', 2, 'Rebuild confidence and stability step by step.', 'S'
  from public.questions where external_id = 's24' and version_id = '00000000-0000-4000-8000-000000000002';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 's24-o4', 3, 'Regroup quickly and pursue another route.', 'D'
  from public.questions where external_id = 's24' and version_id = '00000000-0000-4000-8000-000000000002';
