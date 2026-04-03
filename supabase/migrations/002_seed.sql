-- Seed: Master FSM Interpreter and all registry FSMs
-- Run after 001_initial.sql

INSERT INTO fsm_registry (name, definition, owners, editors, updated_by) VALUES

('Master FSM Interpreter', '{
  "states": [
    {"id":"mi1","name":"Idle","type":"initial","description":"No FSM instance is active","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mi2","name":"Instance Loaded","type":"normal","description":"An FSM definition is loaded and ready to execute","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"mi3","name":"Transition Selected","type":"normal","description":"A valid outgoing transition has been chosen based on guards","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"mi4","name":"Executing Atomic","type":"normal","description":"A primitive transition procedure is running","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"},
    {"id":"mi5","name":"Child Active","type":"normal","description":"An embedded FSM (compound transition) is executing","createdBy":"ed.stull","createdAt":"2026-02-10-0850-America_New_York"},
    {"id":"mi6","name":"Faulted","type":"normal","description":"An error occurred during transition execution","createdBy":"ed.stull","createdAt":"2026-02-10-0855-America_New_York"},
    {"id":"mi7","name":"Instance Complete","type":"normal","description":"The FSM has reached a terminal state","createdBy":"ed.stull","createdAt":"2026-02-10-0900-America_New_York"},
    {"id":"mi8","name":"Shut Down","type":"terminal","description":"Interpreter has released all resources and stopped","createdBy":"ed.stull","createdAt":"2026-02-10-0905-America_New_York"}
  ],
  "transitions": [
    {"id":"mit1","from":"mi1","to":"mi2","architectLabel":"LOAD_INSTANCE","operatorLabel":"Load FSM Definition","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit2","from":"mi2","to":"mi3","architectLabel":"EVALUATE_GUARDS","operatorLabel":"Find Eligible Transition","guard":"has_eligible_transition","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit3","from":"mi3","to":"mi4","architectLabel":"FIRE_ATOMIC","operatorLabel":"Execute Primitive","guard":"execution_type_atomic","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit4","from":"mi3","to":"mi5","architectLabel":"SPAWN_CHILD","operatorLabel":"Launch Embedded FSM","guard":"execution_type_compound","executionType":"compound","embeddedFSM":"Master FSM Interpreter","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit5","from":"mi5","to":"mi2","architectLabel":"CHILD_COMPLETED","operatorLabel":"Embedded FSM Done","guard":"child_reached_terminal","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit6","from":"mi4","to":"mi2","architectLabel":"ATOMIC_RESOLVED","operatorLabel":"Primitive Succeeded","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit7","from":"mi4","to":"mi6","architectLabel":"ATOMIC_FAULT","operatorLabel":"Primitive Failed","guard":"execution_error","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit8","from":"mi5","to":"mi6","architectLabel":"CHILD_FAULT","operatorLabel":"Embedded FSM Failed","guard":"child_error","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit9","from":"mi6","to":"mi2","architectLabel":"RETRY","operatorLabel":"Retry from Loaded","guard":"retryable","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit10","from":"mi6","to":"mi8","architectLabel":"ABORT","operatorLabel":"Abort Execution","guard":"non_retryable","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit11","from":"mi2","to":"mi6","architectLabel":"NO_ELIGIBLE_TRANSITION","operatorLabel":"Guard Deadlock","guard":"no_transition_eligible","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit12","from":"mi2","to":"mi7","architectLabel":"DETECT_TERMINAL","operatorLabel":"Terminal Reached","guard":"current_state_is_terminal","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit13","from":"mi7","to":"mi1","architectLabel":"FINALIZE","operatorLabel":"Release Instance","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"mit14","from":"mi1","to":"mi8","architectLabel":"SHUTDOWN","operatorLabel":"Stop Interpreter","guard":"shutdown_requested","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull'),

('Match Scheduling', '{
  "states": [
    {"id":"s1","name":"Unscheduled","type":"initial","description":"Match exists with no assigned date/time","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"s2","name":"Proposed","type":"normal","description":"A date/time proposal exists, not yet accepted","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"s3","name":"Confirmed","type":"normal","description":"Both teams have accepted the scheduled date/time","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"s4","name":"In Progress","type":"normal","description":"Match has started but is not yet concluded","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"},
    {"id":"s5","name":"Completed","type":"terminal","description":"Match is finished with a final score on record","createdBy":"ed.stull","createdAt":"2026-02-10-0850-America_New_York"},
    {"id":"s6","name":"Cancelled","type":"terminal","description":"Match will not be played","createdBy":"ed.stull","createdAt":"2026-02-10-0855-America_New_York"},
    {"id":"s7","name":"Disputed","type":"normal","description":"An unresolved dispute exists for this match","createdBy":"ed.stull","createdAt":"2026-02-10-0900-America_New_York"},
    {"id":"s8","name":"Rescheduled","type":"normal","description":"Original schedule is abandoned, no replacement yet","createdBy":"ed.stull","createdAt":"2026-02-10-0905-America_New_York"}
  ],
  "transitions": [
    {"id":"t1","from":"s1","to":"s2","architectLabel":"CREATE_PROPOSAL","operatorLabel":"Create Proposal","guard":"","executionType":"compound","embeddedFSM":"Proposal Builder","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t2","from":"s2","to":"s3","architectLabel":"CONFIRM_SCHEDULE","operatorLabel":"Confirm Match","guard":"both_teams_accepted","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t3","from":"s2","to":"s1","architectLabel":"REJECT_PROPOSAL","operatorLabel":"Decline Proposal","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t4","from":"s3","to":"s4","architectLabel":"BEGIN_MATCH","operatorLabel":"Start Match","guard":"scheduled_time_reached","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t5","from":"s4","to":"s5","architectLabel":"RECORD_RESULT","operatorLabel":"Submit Score","guard":"","executionType":"compound","embeddedFSM":"Score Capture","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t6","from":"s3","to":"s6","architectLabel":"CANCEL_MATCH","operatorLabel":"Cancel","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t7","from":"s4","to":"s7","architectLabel":"RAISE_DISPUTE","operatorLabel":"Dispute Result","guard":"","executionType":"compound","embeddedFSM":"Dispute Resolution","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t8","from":"s7","to":"s5","architectLabel":"RESOLVE_DISPUTE","operatorLabel":"Dispute Resolved","guard":"resolution_accepted","executionType":"compound","embeddedFSM":"Resolution Review","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t9","from":"s3","to":"s8","architectLabel":"REQUEST_RESCHEDULE","operatorLabel":"Reschedule","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t10","from":"s8","to":"s2","architectLabel":"REPROPOSE_SCHEDULE","operatorLabel":"New Proposal","guard":"","executionType":"compound","embeddedFSM":"Proposal Builder","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"t11","from":"s2","to":"s6","architectLabel":"CANCEL_PROPOSAL","operatorLabel":"Cancel","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull'),

('Proposal Builder', '{
  "states": [
    {"id":"pb1","name":"Empty Draft","type":"initial","description":"No proposal data exists yet","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"pb2","name":"Dates Collected","type":"normal","description":"Available dates have been gathered from both teams","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"pb3","name":"Conflict Free","type":"normal","description":"Proposed dates have no scheduling conflicts","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"pb4","name":"Options Ready","type":"normal","description":"A set of valid date options exists for team captains","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"},
    {"id":"pb5","name":"Proposal Finalized","type":"terminal","description":"A specific date/time has been selected","createdBy":"ed.stull","createdAt":"2026-02-10-0850-America_New_York"}
  ],
  "transitions": [
    {"id":"pbt1","from":"pb1","to":"pb2","architectLabel":"GATHER_DATES","operatorLabel":"Collect Available Dates","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"pbt2","from":"pb2","to":"pb3","architectLabel":"CHECK_CONFLICTS","operatorLabel":"Verify No Conflicts","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"pbt3","from":"pb3","to":"pb4","architectLabel":"BUILD_OPTIONS","operatorLabel":"Present Date Options","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"pbt4","from":"pb4","to":"pb5","architectLabel":"SELECT_DATE","operatorLabel":"Finalize Selection","guard":"captain_selected","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"pbt5","from":"pb3","to":"pb2","architectLabel":"CONFLICT_FOUND","operatorLabel":"Re-collect Dates","guard":"conflict_detected","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull'),

('Score Capture', '{
  "states": [
    {"id":"sc1","name":"Unrecorded","type":"initial","description":"No score data has been entered for this match","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"sc2","name":"Home Reported","type":"normal","description":"Home team has submitted a score","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"sc3","name":"Confirmation Pending","type":"normal","description":"Away team has received the score for verification","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"sc4","name":"Score Verified","type":"terminal","description":"Both teams agree on the final score","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"},
    {"id":"sc5","name":"Score Contested","type":"terminal","description":"Away team disagrees — escalation required","createdBy":"ed.stull","createdAt":"2026-02-10-0850-America_New_York"}
  ],
  "transitions": [
    {"id":"sct1","from":"sc1","to":"sc2","architectLabel":"ENTER_HOME_SCORE","operatorLabel":"Home Enters Score","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"sct2","from":"sc2","to":"sc3","architectLabel":"SUBMIT_FOR_CONFIRM","operatorLabel":"Send to Away Team","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"sct3","from":"sc3","to":"sc4","architectLabel":"AWAY_CONFIRMS","operatorLabel":"Away Confirms Score","guard":"scores_match","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"sct4","from":"sc3","to":"sc5","architectLabel":"AWAY_DISPUTES","operatorLabel":"Away Disputes Score","guard":"scores_mismatch","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"sct5","from":"sc2","to":"sc1","architectLabel":"RETRACT_SCORE","operatorLabel":"Retract Entry","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull'),

('Dispute Resolution', '{
  "states": [
    {"id":"dr1","name":"Filed","type":"initial","description":"A dispute has been formally submitted","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"dr2","name":"Under Review","type":"normal","description":"Commissioner is examining the dispute details","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"dr3","name":"Escalated","type":"normal","description":"Dispute requires additional input or authority","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"dr4","name":"Resolved","type":"terminal","description":"A binding resolution has been issued","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"},
    {"id":"dr5","name":"Withdrawn","type":"terminal","description":"Dispute was withdrawn by the filing party","createdBy":"ed.stull","createdAt":"2026-02-10-0850-America_New_York"}
  ],
  "transitions": [
    {"id":"drt1","from":"dr1","to":"dr2","architectLabel":"BEGIN_REVIEW","operatorLabel":"Start Review","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"drt2","from":"dr2","to":"dr4","architectLabel":"ISSUE_RULING","operatorLabel":"Issue Resolution","guard":"sufficient_evidence","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"drt3","from":"dr2","to":"dr3","architectLabel":"ESCALATE","operatorLabel":"Escalate Dispute","guard":"needs_authority","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"drt4","from":"dr3","to":"dr4","architectLabel":"AUTHORITY_RULING","operatorLabel":"Authority Decides","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"drt5","from":"dr1","to":"dr5","architectLabel":"WITHDRAW","operatorLabel":"Withdraw Dispute","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull'),

('Resolution Review', '{
  "states": [
    {"id":"rr1","name":"Pending Review","type":"initial","description":"Resolution has been issued, awaiting acceptance","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"rr2","name":"Accepted","type":"terminal","description":"Both parties accept the resolution","createdBy":"ed.stull","createdAt":"2026-02-10-0835-America_New_York"},
    {"id":"rr3","name":"Appealed","type":"normal","description":"One party has formally appealed the resolution","createdBy":"ed.stull","createdAt":"2026-02-10-0840-America_New_York"},
    {"id":"rr4","name":"Final Ruling","type":"terminal","description":"Appeal reviewed, final and binding decision issued","createdBy":"ed.stull","createdAt":"2026-02-10-0845-America_New_York"}
  ],
  "transitions": [
    {"id":"rrt1","from":"rr1","to":"rr2","architectLabel":"ACCEPT_RESOLUTION","operatorLabel":"Accept","guard":"both_accept","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"rrt2","from":"rr1","to":"rr3","architectLabel":"FILE_APPEAL","operatorLabel":"Appeal","guard":"party_disagrees","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"},
    {"id":"rrt3","from":"rr3","to":"rr4","architectLabel":"FINAL_DECISION","operatorLabel":"Final Ruling","guard":"","executionType":"atomic","embeddedFSM":"","createdBy":"ed.stull","createdAt":"2026-02-10-0830-America_New_York"}
  ]
}'::jsonb, ARRAY['ed.stull'], ARRAY['john.doe'], 'ed.stull');
