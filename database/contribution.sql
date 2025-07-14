-- Setup script for Contribution Management USSD App

-- First, let's create the app and perform all subsequent inserts within a single transaction block
DO $$
DECLARE
    app_id INTEGER;
BEGIN
    -- Create the app
    INSERT INTO ussd_apps (ussd_code, app_name, entry_menu, config) VALUES 
    ('*384#', 'Contribution Manager', 'main_menu', '{"version": "1.0", "features": ["groups", "contributions", "profiles"]}')
    RETURNING id INTO app_id; -- Capture the newly generated app ID

    -- Insert all menus for the contribution app
    INSERT INTO ussd_menus (app_id, menu_code, menu_type, text_template, options, validation_rules, api_calls, next_menu) VALUES
    
    -- Main Menu
    (app_id, 'main_menu', 'options', 'Welcome to Contribution Manager\n1. Make a contribution\n2. View contributions\n3. Join group\n4. My Profile\n5. Exit', 
    '[
      {"id": "1", "label": "Make a contribution", "next": "contribution_check_account"},
      {"id": "2", "label": "View contributions", "next": "view_groups_list"},
      {"id": "3", "label": "Join group", "next": "pending_invitations"},
      {"id": "4", "label": "My Profile", "next": "profile_menu"},
      {"id": "5", "label": "Exit", "next": "exit_menu"}
    ]', '{}', '[]', NULL),
    
    -- Check if user has account
    (app_id, 'contribution_check_account', 'options', '{{account_status_message}}', 
    '[
      {"id": "1", "label": "Continue", "next": "make_contribution_groups"},
      {"id": "2", "label": "Sign up", "next": "signup_firstname"}
    ]', '{}', '[{"name": "check_account", "config": {}}]', NULL),
    
    -- Sign up flow
    (app_id, 'signup_firstname', 'input', 'Enter your first name:', '[]', 
    '{"required": true, "minLength": 2, "maxLength": 50}', '[]', 'signup_lastname'),
    
    (app_id, 'signup_lastname', 'input', 'Enter your last name:', '[]', 
    '{"required": true, "minLength": 2, "maxLength": 50}', '[]', 'signup_email'),
    
    (app_id, 'signup_email', 'input', 'Enter your email address:', '[]', 
    '{"required": true, "email": true}', '[]', 'signup_confirm'),
    
    (app_id, 'signup_confirm', 'options', 'Confirm your details:\nName: {{signup_firstname_input}} {{signup_lastname_input}}\nEmail: {{signup_email_input}}\n\n1. Confirm\n2. Cancel',
    '[
      {"id": "1", "label": "Confirm", "next": "signup_process"},
      {"id": "2", "label": "Cancel", "next": "main_menu"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'signup_process', 'final', 'Registration successful! Welcome {{signup_firstname_input}}.\n\nYou can now make contributions.', 
    '[]', '{}', '[{"name": "create_account", "config": {}}]', NULL),
    
    -- Make Contribution Flow
-- Make Contribution Flow
    (app_id, 'make_contribution_groups', 'options', 'Select a group:\n{{groups_list}}', 
    '[]', '{}', '[{"name": "get_user_groups", "config": {}}]', 'make_contribution_collabos'), -- Changed '{{groups_options}}' to '[]'
    
    (app_id, 'make_contribution_collabos', 'options', 'Select a collabo:\n{{collabos_list}}', 
    '[]', '{}', '[{"name": "get_group_collabos", "config": {}}]', 'contribution_type'), -- Changed '{{collabos_options}}' to '[]'

    -- View Contributions Flow
    (app_id, 'view_groups_list', 'options', 'Select a group:\n{{groups_list}}', 
    '[]', '{}', '[{"name": "get_user_groups", "config": {}}]', 'view_collabos_list'), -- Changed '{{groups_options}}' to '[]'
    
    (app_id, 'view_collabos_list', 'options', 'Select a collabo:\n{{collabos_list}}', 
    '[]', '{}', '[{"name": "get_group_collabos", "config": {}}]', 'view_metrics_type'), -- Changed '{{collabos_options}}' to '[]'

    -- Join Group Flow
    (app_id, 'pending_invitations', 'options', '{{invitations_message}}',
    '[]', '{}', '[{"name": "get_pending_invitations", "config": {}}]', NULL), -- Changed '{{invitations_options}}' to '[]'

    -- Subgroups API - This was in api_configs, but if it's meant for ussd_menus...
    -- (app_id, 'edit_subgroup', 'options', '{{subgroup_options_text}}',
    -- '[]', '{}', '[{"name": "get_subgroups", "config": {}}]', 'edit_subgroup_confirm'), -- Assuming this was meant for ussd_menus
    
    -- Contributing for self
    (app_id, 'contribution_amount_self', 'input', 'Enter amount (Outstanding: {{currency:outstanding_amount}}):', '[]', 
    '{"required": true, "amount": true, "minAmount": 1}', 
    '[{"name": "get_outstanding_amount", "config": {}}]', 'contribution_reference'),
    
    -- Contributing for another member
    (app_id, 'contribution_member_phone', 'input', 'Enter member phone number:', '[]', 
    '{"required": true, "phone": true}', '[]', 'verify_member'),
    
    (app_id, 'verify_member', 'options', '{{member_verification_message}}\n\n1. Continue\n2. Go back',
    '[
      {"id": "1", "label": "Continue", "next": "contribution_amount_other"},
      {"id": "2", "label": "Go back", "next": "contribution_type"}
    ]', '{}', '[{"name": "verify_group_member", "config": {}}]', NULL),
    
    (app_id, 'contribution_amount_other', 'input', 'Enter amount for {{member_name}}:', '[]', 
    '{"required": true, "amount": true, "minAmount": 1}', '[]', 'contribution_reference'),
    
    (app_id, 'contribution_reference', 'input', 'Enter reference/description:', '[]', 
    '{"required": true, "minLength": 3, "maxLength": 100}', '[]', 'contribution_visibility'),
    
    (app_id, 'contribution_visibility', 'options', 'Display preference:\n1. Show amount and contributor name\n2. Hide contributor name',
    '[
      {"id": "1", "label": "Show all", "next": "contribution_confirm"},
      {"id": "2", "label": "Hide name", "next": "contribution_confirm"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'contribution_confirm', 'options', 'Confirm contribution:\nAmount: {{currency:contribution_amount_self_input}}{{currency:contribution_amount_other_input}}\nReference: {{contribution_reference_input}}\n{{contribution_details}}\n\n1. Confirm\n2. Cancel',
    '[
      {"id": "1", "label": "Confirm", "next": "contribution_pin"},
      {"id": "2", "label": "Cancel", "next": "main_menu"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'contribution_pin', 'input', 'Enter your PIN:', '[]', 
    '{"required": true, "numeric": true, "minLength": 4, "maxLength": 4}', '[]', 'contribution_process'),
    
    (app_id, 'contribution_process', 'final', '{{contribution_result}}', '[]', '{}', 
    '[{"name": "process_contribution", "config": {}}]', NULL),
    
    -- View Contributions Flow
    (app_id, 'view_groups_list', 'options', 'Select a group:\n{{groups_list}}', 
    '{{groups_options}}', '{}', '[{"name": "get_user_groups", "config": {}}]', 'view_collabos_list'),
    
    (app_id, 'view_collabos_list', 'options', 'Select a collabo:\n{{collabos_list}}', 
    '{{collabos_options}}', '{}', '[{"name": "get_group_collabos", "config": {}}]', 'view_metrics_type'),
    
    (app_id, 'view_metrics_type', 'options', 'View:\n1. Collabo metrics\n2. My individual metrics\n3. Go back',
    '[
      {"id": "1", "label": "Collabo metrics", "next": "collabo_metrics"},
      {"id": "2", "label": "Individual metrics", "next": "individual_metrics"},
      {"id": "3", "label": "Go back", "next": "view_collabos_list"}
    ]', '{}', '[]', NULL),
    
    -- Collabo Metrics
    (app_id, 'collabo_metrics', 'options', 'Collabo Metrics:\n1. Total raised\n2. Target amount\n3. Deficit\n4. Due date\n5. Recent contributions\n6. Go back',
    '[
      {"id": "1", "label": "Total raised", "next": "show_total_raised"},
      {"id": "2", "label": "Target amount", "next": "show_target_amount"},
      {"id": "3", "label": "Deficit", "next": "show_deficit"},
      {"id": "4", "label": "Due date", "next": "show_due_date"},
      {"id": "5", "label": "Recent contributions", "next": "show_recent_contributions"},
      {"id": "6", "label": "Go back", "next": "view_metrics_type"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'show_total_raised', 'options', 'Total Raised: {{currency:total_raised}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "collabo_metrics"}]', '{}', 
    '[{"name": "get_collabo_metrics", "config": {"metric": "total_raised"}}]', NULL),
    
    (app_id, 'show_target_amount', 'options', 'Target Amount: {{currency:target_amount}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "collabo_metrics"}]', '{}', 
    '[{"name": "get_collabo_metrics", "config": {"metric": "target_amount"}}]', NULL),
    
    (app_id, 'show_deficit', 'options', 'Deficit: {{currency:deficit}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "collabo_metrics"}]', '{}', 
    '[{"name": "get_collabo_metrics", "config": {"metric": "deficit"}}]', NULL),
    
    (app_id, 'show_due_date', 'options', 'Due Date: {{date:due_date}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "collabo_metrics"}]', '{}', 
    '[{"name": "get_collabo_metrics", "config": {"metric": "due_date"}}]', NULL),
    
    (app_id, 'show_recent_contributions', 'options', 'Recent Contributions:\n{{recent_contributions_list}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "collabo_metrics"}]', '{}', 
    '[{"name": "get_recent_contributions", "config": {"type": "collabo"}}]', NULL),
    
    -- Individual Metrics
    (app_id, 'individual_metrics', 'options', 'My Metrics:\n1. Total paid\n2. My target\n3. Outstanding amount\n4. Due date\n5. My contributions\n6. Go back',
    '[
      {"id": "1", "label": "Total paid", "next": "show_individual_paid"},
      {"id": "2", "label": "My target", "next": "show_individual_target"},
      {"id": "3", "label": "Outstanding", "next": "show_individual_outstanding"},
      {"id": "4", "label": "Due date", "next": "show_individual_due_date"},
      {"id": "5", "label": "My contributions", "next": "show_my_contributions"},
      {"id": "6", "label": "Go back", "next": "view_metrics_type"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'show_individual_paid', 'options', 'Total Paid: {{currency:individual_total_paid}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "individual_metrics"}]', '{}', 
    '[{"name": "get_individual_metrics", "config": {"metric": "total_paid"}}]', NULL),
    
    (app_id, 'show_individual_target', 'options', 'My Target: {{currency:individual_target}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "individual_metrics"}]', '{}', 
    '[{"name": "get_individual_metrics", "config": {"metric": "target"}}]', NULL),
    
    (app_id, 'show_individual_outstanding', 'options', 'Outstanding: {{currency:individual_outstanding}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "individual_metrics"}]', '{}', 
    '[{"name": "get_individual_metrics", "config": {"metric": "outstanding"}}]', NULL),
    
    (app_id, 'show_individual_due_date', 'options', 'Due Date: {{date:individual_due_date}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "individual_metrics"}]', '{}', 
    '[{"name": "get_individual_metrics", "config": {"metric": "due_date"}}]', NULL),
    
    (app_id, 'show_my_contributions', 'options', 'My Contributions:\n{{my_contributions_list}}\n\n1. Go back',
    '[{"id": "1", "label": "Go back", "next": "individual_metrics"}]', '{}', 
    '[{"name": "get_recent_contributions", "config": {"type": "individual"}}]', NULL),
    
    -- Join Group Flow
    (app_id, 'pending_invitations', 'options', '{{invitations_message}}',
    '{{invitations_options}}', '{}', '[{"name": "get_pending_invitations", "config": {}}]', NULL),
    
    (app_id, 'invitation_details', 'options', '{{invitation_details}}\n\n1. Join group\n2. Decline\n3. Go back',
    '[
      {"id": "1", "label": "Join", "next": "join_group_confirm"},
      {"id": "2", "label": "Decline", "next": "decline_invitation_confirm"},
      {"id": "3", "label": "Go back", "next": "pending_invitations"}
    ]', '{}', '[{"name": "get_invitation_details", "config": {}}]', NULL),
    
    (app_id, 'join_group_confirm', 'final', 'You have successfully joined "{{group_name}}"', '[]', '{}', 
    '[{"name": "accept_invitation", "config": {}}]', NULL),
    
    (app_id, 'decline_invitation_confirm', 'final', 'Invitation declined.', '[]', '{}', 
    '[{"name": "decline_invitation", "config": {}}]', NULL),
    
    -- Profile Management
    (app_id, 'profile_menu', 'options', 'My Profile:\n1. View details\n2. Edit details\n3. Go back',
    '[
      {"id": "1", "label": "View", "next": "view_profile"},
      {"id": "2", "label": "Edit", "next": "edit_profile_menu"},
      {"id": "3", "label": "Go back", "next": "main_menu"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'view_profile', 'options', 'Profile Details:\n{{profile_details}}\n\n1. Ok\n2. Go back',
    '[
      {"id": "1", "label": "Ok", "next": "main_menu"},
      {"id": "2", "label": "Go back", "next": "profile_menu"}
    ]', '{}', '[{"name": "get_profile", "config": {}}]', NULL),
    
    (app_id, 'edit_profile_menu', 'options', 'Edit:\n1. First name\n2. Last name\n3. Email address\n4. Subgroup\n5. Go back',
    '[
      {"id": "1", "label": "First name", "next": "edit_firstname"},
      {"id": "2", "label": "Last name", "next": "edit_lastname"},
      {"id": "3", "label": "Email", "next": "edit_email"},
      {"id": "4", "label": "Subgroup", "next": "edit_subgroup"},
      {"id": "5", "label": "Go back", "next": "profile_menu"}
    ]', '{}', '[]', NULL),
    
    (app_id, 'edit_firstname', 'input', 'Enter new first name:', '[]', 
    '{"required": true, "minLength": 2, "maxLength": 50}', '[]', 'edit_firstname_confirm'),
    
    (app_id, 'edit_firstname_confirm', 'final', 'First name updated successfully!', '[]', '{}', 
    '[{"name": "update_profile", "config": {"field": "firstname"}}]', NULL),
    
    (app_id, 'edit_lastname', 'input', 'Enter new last name:', '[]', 
    '{"required": true, "minLength": 2, "maxLength": 50}', '[]', 'edit_lastname_confirm'),
    
    (app_id, 'edit_lastname_confirm', 'final', 'Last name updated successfully!', '[]', '{}', 
    '[{"name": "update_profile", "config": {"field": "lastname"}}]', NULL),
    
    (app_id, 'edit_email', 'input', 'Enter new email address:', '[]', 
    '{"required": true, "email": true}', '[]', 'edit_email_confirm'),
    
    (app_id, 'edit_email_confirm', 'final', 'Email updated successfully!', '[]', '{}', 
    '[{"name": "update_profile", "config": {"field": "email"}}]', NULL),
    
    (app_id, 'edit_subgroup', 'options', '{{subgroup_options_text}}',
    '{{subgroup_options}}', '{}', '[{"name": "get_subgroups", "config": {}}]', 'edit_subgroup_confirm'),
    
    (app_id, 'edit_subgroup_confirm', 'final', 'Subgroup updated successfully!', '[]', '{}', 
    '[{"name": "update_profile", "config": {"field": "subgroup"}}]', NULL),
    
    -- Exit
    (app_id, 'exit_menu', 'final', 'Thank you for using Contribution Manager. Goodbye!', '[]', '{}', '[]', NULL);
    
    -- Now insert API configurations
    INSERT INTO api_configs (app_id, api_name, endpoint, method, headers, body_template, response_mapping, timeout, retry_count) VALUES
    
    -- Account and Profile APIs
    (app_id, 'check_account', 'http://localhost:4000/api/account/check', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}"}',
    '{"account_exists": "$.exists", "account_status_message": "$.message", "user_id": "$.userId"}',
    5000, 2),
    
    (app_id, 'create_account', 'http://localhost:4000/api/account/create', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}", "firstname": "{{signup_firstname_input}}", "lastname": "{{signup_lastname_input}}", "email": "{{signup_email_input}}"}',
    '{"user_id": "$.userId", "message": "$.message"}',
    5000, 2),
    
    (app_id, 'get_profile', 'http://localhost:4000/api/profile/{{phone_number}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"profile_details": "$.formatted", "firstname": "$.firstname", "lastname": "$.lastname", "email": "$.email"}',
    5000, 2),
    
    (app_id, 'update_profile', 'http://localhost:4000/api/profile/update', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}", "field": "{{field}}", "value": "{{edit_{{field}}_input}}"}',
    '{"success": "$.success", "message": "$.message"}',
    5000, 2),
    
    -- Groups and Collabos APIs
    (app_id, 'get_user_groups', 'http://localhost:4000/api/groups/user/{{phone_number}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"groups_list": "$.formatted", "groups_options": "$.options", "selected_group_id": "$.groups[{{make_contribution_groups_input}}].id"}',
    5000, 2),
    
    (app_id, 'get_group_collabos', 'http://localhost:4000/api/collabos/group/{{selected_group_id}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"collabos_list": "$.formatted", "collabos_options": "$.options", "selected_collabo_id": "$.collabos[{{make_contribution_collabos_input}}].id"}',
    5000, 2),
    
    -- Contribution APIs
    (app_id, 'get_outstanding_amount', 'http://localhost:4000/api/contributions/outstanding', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}", "collaboId": "{{selected_collabo_id}}"}',
    '{"outstanding_amount": "$.amount", "currency": "$.currency"}',
    5000, 2),
    
    (app_id, 'verify_group_member', 'http://localhost:4000/api/groups/verify-member', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{contribution_member_phone_input}}", "groupId": "{{selected_group_id}}"}',
    '{"is_member": "$.isMember", "member_name": "$.name", "member_verification_message": "$.message"}',
    5000, 2),
    
    (app_id, 'process_contribution', 'http://localhost:4000/api/contributions/process', 'POST',
    '{"Content-Type": "application/json"}',
    '{
      "contributorPhone": "{{phone_number}}", 
      "beneficiaryPhone": "{{contribution_member_phone_input}}", 
      "collaboId": "{{selected_collabo_id}}", 
      "amount": "{{contribution_amount_self_input}}{{contribution_amount_other_input}}", 
      "reference": "{{contribution_reference_input}}", 
      "visibility": "{{contribution_visibility_input}}", 
      "pin": "{{contribution_pin_input}}"
    }',
    '{"contribution_result": "$.message", "transaction_id": "$.transactionId"}',
    10000, 1),
    
    -- Metrics APIs
    (app_id, 'get_collabo_metrics', 'http://localhost:4000/api/metrics/collabo/{{selected_collabo_id}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"total_raised": "$.totalRaised", "target_amount": "$.targetAmount", "deficit": "$.deficit", "due_date": "$.dueDate"}',
    5000, 2),
    
    (app_id, 'get_individual_metrics', 'http://localhost:4000/api/metrics/individual', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}", "collaboId": "{{selected_collabo_id}}"}',
    '{"individual_total_paid": "$.totalPaid", "individual_target": "$.target", "individual_outstanding": "$.outstanding", "individual_due_date": "$.dueDate"}',
    5000, 2),
    
    (app_id, 'get_recent_contributions', 'http://localhost:4000/api/contributions/recent', 'POST',
    '{"Content-Type": "application/json"}',
    '{"phone": "{{phone_number}}", "collaboId": "{{selected_collabo_id}}", "type": "{{type}}"}',
    '{"recent_contributions_list": "$.formatted", "my_contributions_list": "$.formatted"}',
    5000, 2),
    
    -- Invitations APIs
    (app_id, 'get_pending_invitations', 'http://localhost:4000/api/invitations/pending/{{phone_number}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"invitations_message": "$.message", "invitations_options": "$.options", "selected_invitation_id": "$.invitations[{{pending_invitations_input}}].id"}',
    5000, 2),
    
    (app_id, 'get_invitation_details', 'http://localhost:4000/api/invitations/{{selected_invitation_id}}', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"invitation_details": "$.formatted", "group_name": "$.groupName"}',
    5000, 2),
    
    (app_id, 'accept_invitation', 'http://localhost:4000/api/invitations/accept', 'POST',
    '{"Content-Type": "application/json"}',
    '{"invitationId": "{{selected_invitation_id}}", "phone": "{{phone_number}}"}',
    '{"success": "$.success", "message": "$.message", "group_name": "$.groupName"}',
    5000, 2),
    
    (app_id, 'decline_invitation', 'http://localhost:4000/api/invitations/decline', 'POST',
    '{"Content-Type": "application/json"}',
    '{"invitationId": "{{selected_invitation_id}}", "phone": "{{phone_number}}"}',
    '{"success": "$.success", "message": "$.message"}',
    5000, 2),
    
    -- Subgroups API
    (app_id, 'get_subgroups', 'http://localhost:4000/api/groups/{{selected_group_id}}/subgroups', 'GET',
    '{"Content-Type": "application/json"}',
    '{}',
    '{"subgroup_options_text": "$.formatted", "subgroup_options": "$.options"}',
    5000, 2);
    
    -- Output success message within the PL/pgSQL block
    RAISE NOTICE 'Contribution Management App created successfully with app_id: % and USSD code: *384#', app_id;

END $$;