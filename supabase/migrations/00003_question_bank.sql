-- Assessment content: DISC360 v1 question bank (generated from data/disc-questions.ts — keep in sync)

insert into public.assessment_versions (id, name, version, is_active)
values ('00000000-0000-4000-8000-000000000001', 'DISC360 Workplace v1', 1, true);

insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q01', 0, 'When a project stalls, you are the one who…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q01-1', 0, 'Forces a decision and moves', 'D' from public.questions where external_id = 'q01' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q01-2', 1, 'Re-energizes the room', 'I' from public.questions where external_id = 'q01' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q01-3', 2, 'Holds the team steady', 'S' from public.questions where external_id = 'q01' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q01-4', 3, 'Diagnoses what broke', 'C' from public.questions where external_id = 'q01' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q02', 1, 'In a first meeting with strangers, you tend to…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q02-1', 0, 'Spark the conversation', 'I' from public.questions where external_id = 'q02' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q02-2', 1, 'Listen and observe closely', 'C' from public.questions where external_id = 'q02' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q02-3', 2, 'Steer the agenda', 'D' from public.questions where external_id = 'q02' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q02-4', 3, 'Put people at ease', 'S' from public.questions where external_id = 'q02' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q03', 2, 'Under a hard deadline, your instinct is to…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q03-1', 0, 'Keep a steady, reliable pace', 'S' from public.questions where external_id = 'q03' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q03-2', 1, 'Cut scope and ship now', 'D' from public.questions where external_id = 'q03' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q03-3', 2, 'Protect quality above all', 'C' from public.questions where external_id = 'q03' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q03-4', 3, 'Rally help fast', 'I' from public.questions where external_id = 'q03' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q04', 3, 'When someone challenges your idea, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q04-1', 0, 'Go back and re-verify the facts', 'C' from public.questions where external_id = 'q04' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q04-2', 1, 'Look for middle ground', 'S' from public.questions where external_id = 'q04' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q04-3', 2, 'Win them over', 'I' from public.questions where external_id = 'q04' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q04-4', 3, 'Push back head-on', 'D' from public.questions where external_id = 'q04' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q05', 4, 'Colleagues would most likely describe you as…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q05-1', 0, 'Decisive', 'D' from public.questions where external_id = 'q05' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q05-2', 1, 'Magnetic', 'I' from public.questions where external_id = 'q05' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q05-3', 2, 'Dependable', 'S' from public.questions where external_id = 'q05' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q05-4', 3, 'Precise', 'C' from public.questions where external_id = 'q05' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q06', 5, 'Faced with a risky opportunity, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q06-1', 0, 'Sell everyone on the upside', 'I' from public.questions where external_id = 'q06' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q06-2', 1, 'Model the downside carefully', 'C' from public.questions where external_id = 'q06' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q06-3', 2, 'Seize it before others do', 'D' from public.questions where external_id = 'q06' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q06-4', 3, 'Weigh the impact on people first', 'S' from public.questions where external_id = 'q06' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q07', 6, 'Your natural role on a team is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q07-1', 0, 'The anchor', 'S' from public.questions where external_id = 'q07' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q07-2', 1, 'The driver', 'D' from public.questions where external_id = 'q07' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q07-3', 2, 'The examiner', 'C' from public.questions where external_id = 'q07' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q07-4', 3, 'The energizer', 'I' from public.questions where external_id = 'q07' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q08', 7, 'When plans change suddenly, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q08-1', 0, 'Re-plan methodically', 'C' from public.questions where external_id = 'q08' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q08-2', 1, 'Restore calm and order', 'S' from public.questions where external_id = 'q08' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q08-3', 2, 'Improvise out loud', 'I' from public.questions where external_id = 'q08' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q08-4', 3, 'Take command of the pivot', 'D' from public.questions where external_id = 'q08' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q09', 8, 'In a negotiation, you rely on…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q09-1', 0, 'Leverage and pace', 'D' from public.questions where external_id = 'q09' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q09-2', 1, 'Rapport and charm', 'I' from public.questions where external_id = 'q09' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q09-3', 2, 'Patience and trust', 'S' from public.questions where external_id = 'q09' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q09-4', 3, 'Data and detail', 'C' from public.questions where external_id = 'q09' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q10', 9, 'When a teammate underperforms, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q10-1', 0, 'Motivate them back up', 'I' from public.questions where external_id = 'q10' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q10-2', 1, 'Analyze the root cause', 'C' from public.questions where external_id = 'q10' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q10-3', 2, 'Confront it directly', 'D' from public.questions where external_id = 'q10' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q10-4', 3, 'Support them quietly', 'S' from public.questions where external_id = 'q10' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q11', 10, 'Your written communication style is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q11-1', 0, 'Considered and kind', 'S' from public.questions where external_id = 'q11' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q11-2', 1, 'Short and commanding', 'D' from public.questions where external_id = 'q11' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q11-3', 2, 'Thorough and exact', 'C' from public.questions where external_id = 'q11' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q11-4', 3, 'Warm and expressive', 'I' from public.questions where external_id = 'q11' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q12', 11, 'At your best, you are…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q12-1', 0, 'Rigorous', 'C' from public.questions where external_id = 'q12' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q12-2', 1, 'Steadfast', 'S' from public.questions where external_id = 'q12' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q12-3', 2, 'Inspiring', 'I' from public.questions where external_id = 'q12' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q12-4', 3, 'Bold', 'D' from public.questions where external_id = 'q12' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q13', 12, 'What drains you the most is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q13-1', 0, 'Slow consensus', 'D' from public.questions where external_id = 'q13' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q13-2', 1, 'Working alone too long', 'I' from public.questions where external_id = 'q13' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q13-3', 2, 'Constant churn and upheaval', 'S' from public.questions where external_id = 'q13' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q13-4', 3, 'Sloppy, careless work', 'C' from public.questions where external_id = 'q13' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q14', 13, 'You make big decisions by…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q14-1', 0, 'Talking them through', 'I' from public.questions where external_id = 'q14' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q14-2', 1, 'Building the full case', 'C' from public.questions where external_id = 'q14' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q14-3', 2, 'Instinct and speed', 'D' from public.questions where external_id = 'q14' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q14-4', 3, 'Sleeping on them', 'S' from public.questions where external_id = 'q14' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q15', 14, 'In a crisis, you become…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q15-1', 0, 'The stabilizer', 'S' from public.questions where external_id = 'q15' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q15-2', 1, 'The commander', 'D' from public.questions where external_id = 'q15' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q15-3', 2, 'The fact-checker', 'C' from public.questions where external_id = 'q15' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q15-4', 3, 'The morale keeper', 'I' from public.questions where external_id = 'q15' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q16', 15, 'Meetings, ideally, should be…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q16-1', 0, 'Structured and well-prepared', 'C' from public.questions where external_id = 'q16' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q16-2', 1, 'Predictable and inclusive', 'S' from public.questions where external_id = 'q16' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q16-3', 2, 'Lively and open', 'I' from public.questions where external_id = 'q16' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q16-4', 3, 'Short and decisive', 'D' from public.questions where external_id = 'q16' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q17', 16, 'The praise that lands hardest with you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q17-1', 0, '“You made the tough call.”', 'D' from public.questions where external_id = 'q17' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q17-2', 1, '“You lit up the room.”', 'I' from public.questions where external_id = 'q17' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q17-3', 2, '“You held us together.”', 'S' from public.questions where external_id = 'q17' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q17-4', 3, '“You got it exactly right.”', 'C' from public.questions where external_id = 'q17' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q18', 17, 'Your relationship with rules is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q18-1', 0, 'Charm your way around them', 'I' from public.questions where external_id = 'q18' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q18-2', 1, 'They usually exist for good reason', 'C' from public.questions where external_id = 'q18' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q18-3', 2, 'Break them if they slow results', 'D' from public.questions where external_id = 'q18' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q18-4', 3, 'Respect them — they keep things stable', 'S' from public.questions where external_id = 'q18' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q19', 18, 'A new idea arrives. Your first instinct…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q19-1', 0, 'How does this affect the team?', 'S' from public.questions where external_id = 'q19' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q19-2', 1, 'Who decides? Let’s move.', 'D' from public.questions where external_id = 'q19' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q19-3', 2, 'Does it actually hold up?', 'C' from public.questions where external_id = 'q19' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q19-4', 3, 'Who can I tell first?', 'I' from public.questions where external_id = 'q19' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q20', 19, 'When conflict breaks out in the room, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q20-1', 0, 'Steer back to the facts', 'C' from public.questions where external_id = 'q20' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q20-2', 1, 'Calm everyone down', 'S' from public.questions where external_id = 'q20' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q20-3', 2, 'Defuse it with warmth', 'I' from public.questions where external_id = 'q20' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q20-4', 3, 'Name it bluntly', 'D' from public.questions where external_id = 'q20' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q21', 20, 'Progress, to you, feels like…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q21-1', 0, 'Ground taken', 'D' from public.questions where external_id = 'q21' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q21-2', 1, 'Momentum and buzz', 'I' from public.questions where external_id = 'q21' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q21-3', 2, 'A consistent rhythm', 'S' from public.questions where external_id = 'q21' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q21-4', 3, 'Errors eliminated', 'C' from public.questions where external_id = 'q21' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q22', 21, 'Your ideal calendar is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q22-1', 0, 'Full of people', 'I' from public.questions where external_id = 'q22' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q22-2', 1, 'Long stretches of deep focus', 'C' from public.questions where external_id = 'q22' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q22-3', 2, 'Full of decisions', 'D' from public.questions where external_id = 'q22' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q22-4', 3, 'Predictable, protected blocks', 'S' from public.questions where external_id = 'q22' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q23', 22, 'Right after a win, you…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q23-1', 0, 'Credit the team', 'S' from public.questions where external_id = 'q23' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q23-2', 1, 'Set the next target', 'D' from public.questions where external_id = 'q23' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q23-3', 2, 'Study why it worked', 'C' from public.questions where external_id = 'q23' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q23-4', 3, 'Celebrate loudly', 'I' from public.questions where external_id = 'q23' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.questions (version_id, external_id, position, prompt)
values ('00000000-0000-4000-8000-000000000001', 'q24', 23, 'The legacy you want is…');
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q24-1', 0, 'Standards that endured', 'C' from public.questions where external_id = 'q24' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q24-2', 1, 'Teams that lasted', 'S' from public.questions where external_id = 'q24' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q24-3', 2, 'People you energized', 'I' from public.questions where external_id = 'q24' and version_id = '00000000-0000-4000-8000-000000000001';
insert into public.question_options (question_id, external_id, position, label, dimension)
select id, 'q24-4', 3, 'Results that changed the game', 'D' from public.questions where external_id = 'q24' and version_id = '00000000-0000-4000-8000-000000000001';
