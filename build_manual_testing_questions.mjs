import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "E:/wittmann_interview_ai/outputs/manual_testing_questions";

const sections = [
  ["Manual Testing Fundamentals", [
    ["Testing Basics", "a process of evaluating software to find defects and verify expected behavior", "understand the purpose and value of testing", "review requirements and expected results", "test plan", "unclear requirements", "approved requirements", "defect detection rate", "checking a login form against its specification", "confidence that key behavior works", "functional testing"],
    ["QA vs QC", "quality assurance prevents process issues while quality control detects product defects", "distinguish prevention from detection", "review the development and test process", "quality plan", "inconsistent process execution", "defined quality process", "defect escape rate", "auditing whether reviews are performed", "improved process reliability", "process audit"],
    ["Verification and Validation", "verification checks work products against specifications while validation checks the product meets user needs", "confirm both conformance and fitness for use", "review specifications before execution", "review checklist", "building the wrong feature", "available specifications", "review coverage", "inspecting a requirement before testing a feature", "evidence that the product meets its purpose", "requirements review"],
    ["Static and Dynamic Testing", "static testing examines artifacts without executing code while dynamic testing executes the software", "find issues early and confirm runtime behavior", "inspect documents before running tests", "review record", "late discovery of requirement defects", "available work products", "issues found before execution", "reviewing a user story before testing it", "earlier defect prevention", "static review"],
    ["Test Levels", "test levels organize testing from individual units through integrated systems and user acceptance", "test the product at the appropriate scope", "select the level that matches the risk", "test strategy", "missing integration issues", "defined system boundaries", "coverage by test level", "testing how two services exchange data", "evidence across the delivery lifecycle", "integration testing"]]],
  ["SDLC", [
    ["Requirements Analysis", "the evaluation of requirements for completeness, clarity, consistency, and testability", "identify ambiguities before development starts", "review acceptance criteria with stakeholders", "requirements traceability matrix", "ambiguous acceptance criteria", "draft requirements", "requirements review coverage", "asking how an error message should behave", "testable and agreed requirements", "requirements review"],
    ["Design Phase Testing", "early examination of design artifacts to uncover defects before coding", "prevent design defects from becoming code defects", "review interface and data-flow designs", "design review checklist", "unhandled integration paths", "available design documents", "design issues found", "checking an error-state wireframe", "more testable and reliable design", "design review"],
    ["Build and Deployment", "the controlled creation, packaging, and release of software into a testable environment", "make the intended build available for testing", "verify build version and deployment notes", "build verification checklist", "testing the wrong build", "deployed build and release notes", "build acceptance rate", "confirming the displayed build number", "a known test baseline", "smoke testing"],
    ["Environment Management", "the setup and maintenance of systems, data, tools, and access needed for testing", "provide stable conditions for test execution", "validate test data and service availability", "environment readiness checklist", "invalid test results caused by instability", "configured test environment", "environment availability", "confirming a test API is reachable", "repeatable test execution", "environment validation"],
    ["Release Readiness", "the assessment of whether a product has sufficient quality and risk acceptance for release", "support an informed go or no-go decision", "review open defects and test evidence", "release readiness report", "unacceptable production risk", "completed planned testing", "open critical defect count", "reviewing unresolved high-severity defects", "a documented release decision", "risk-based testing"]]],
  ["STLC", [
    ["Test Planning", "the activity of defining scope, objectives, resources, schedule, and risks for testing", "align testing effort with project goals and risks", "estimate effort and define entry and exit criteria", "test plan", "unplanned testing work", "approved project scope", "planned versus executed tests", "identifying the testers needed for a release", "a shared approach to testing", "risk-based testing"],
    ["Test Case Design", "the creation of conditions, data, steps, and expected results used to evaluate software", "produce repeatable checks of requirements", "derive positive and negative scenarios", "test case", "incomplete behavioral coverage", "testable requirements", "test case coverage", "writing steps to verify password reset", "repeatable test evidence", "equivalence partitioning"],
    ["Test Data Preparation", "the creation or selection of realistic values needed to execute test scenarios", "enable valid, safe, and meaningful test execution", "prepare boundary and invalid input values", "test data sheet", "unrepresentative test results", "data access and privacy controls", "test data readiness", "creating an expired credit card value", "reliable scenario execution", "boundary value analysis"],
    ["Test Execution", "the performance of planned test cases and recording of actual results", "compare actual behavior with expected behavior", "execute steps and capture evidence", "test execution log", "missing evidence for results", "approved test cases and environment", "pass rate", "running a checkout test with valid data", "documented test outcomes", "manual test execution"],
    ["Test Closure", "the formal completion activity that summarizes results, lessons, and remaining risks", "provide a clear record of testing completion", "compile metrics and archive test assets", "test summary report", "loss of lessons learned", "completed execution and defect status", "defect leakage", "documenting what was not tested", "an auditable testing conclusion", "test closure review"]]],
  ["Test Design Techniques", [
    ["Equivalence Partitioning", "a technique that groups inputs expected to behave similarly into representative classes", "reduce tests while preserving meaningful input coverage", "select one value from each valid and invalid class", "equivalence class table", "redundant tests with weak coverage", "defined input domain", "partition coverage", "testing one valid age from the 18 to 60 range", "efficient representative coverage", "black-box testing"],
    ["Boundary Value Analysis", "a technique that tests values at and around the edges of an input range", "find defects near limits where failures are common", "test minimum, maximum, and adjacent values", "boundary value table", "missed limit-related defects", "known input constraints", "boundary coverage", "testing 0, 1, 100, and 101 for a 1 to 100 field", "confidence in input-limit behavior", "black-box testing"],
    ["Decision Table Testing", "a technique that models combinations of conditions and resulting actions", "cover business rules with multiple condition combinations", "list conditions, actions, and rules", "decision table", "missing business-rule combinations", "defined rule conditions", "rule coverage", "testing discount eligibility for member and coupon combinations", "clear rule-based coverage", "black-box testing"],
    ["State Transition Testing", "a technique that tests behavior as a system moves between defined states", "verify valid and invalid state changes", "identify states, triggers, and transitions", "state transition diagram", "unhandled state changes", "defined states and events", "transition coverage", "testing account lock after repeated failed logins", "evidence of correct lifecycle behavior", "black-box testing"],
    ["Use Case Testing", "a technique that derives end-to-end tests from user interactions and goals", "validate complete user workflows", "identify the main flow and alternate flows", "use case scenario", "missed user journey failures", "agreed user workflows", "use case coverage", "testing a customer purchase from search to confirmation", "confidence in user-centered behavior", "scenario testing"]]],
  ["Defect Management", [
    ["Defect Lifecycle", "the set of states a reported defect follows from discovery through closure", "track defects consistently to resolution", "update status after verification", "defect report", "lost or unresolved defects", "an identified reproducible issue", "defect aging", "moving a verified fix to Closed", "transparent defect progress", "defect tracking"],
    ["Severity and Priority", "severity measures technical impact while priority indicates urgency of resolution", "communicate impact and business urgency accurately", "assess user impact and release need", "defect triage record", "fixing low-impact issues ahead of critical ones", "a documented defect", "critical defect count", "marking a payment failure as high severity", "better fix ordering", "defect triage"],
    ["Defect Reporting", "the documentation of an observed issue with steps, expected result, actual result, and evidence", "enable others to reproduce and resolve the issue", "write clear reproduction steps and attach evidence", "defect report", "non-reproducible defects", "a confirmed unexpected result", "reopen rate", "recording browser version with a UI issue", "actionable defect information", "defect tracking"],
    ["Defect Triage", "a collaborative review of defects to confirm validity, severity, priority, ownership, and action", "make informed decisions about defect handling", "review impact with product and engineering", "triage meeting notes", "unclear defect ownership", "logged defects with evidence", "triage turnaround time", "assigning a confirmed defect to the responsible team", "agreed defect actions", "risk-based testing"],
    ["Root Cause Analysis", "the investigation of the underlying reason a defect was introduced or escaped", "prevent recurrence through process improvement", "analyze contributing conditions and controls", "root cause analysis record", "repeated avoidable defects", "sufficient defect history", "recurring defect rate", "finding that an omitted review caused a requirement defect", "targeted preventive actions", "five whys"]]],
  ["Web Application Testing", [
    ["User Interface Testing", "the evaluation of visual layout, controls, feedback, and usability in the user interface", "confirm the interface is clear and behaves as designed", "check labels, alignment, and control states", "UI checklist", "confusing or inconsistent user interactions", "available UI design and build", "UI defect count", "checking whether an error message appears next to a field", "a usable and consistent interface", "exploratory testing"],
    ["Cross-Browser Testing", "the verification that a web application behaves correctly across supported browsers and versions", "identify browser-specific behavior differences", "execute key flows in each supported browser", "browser compatibility matrix", "production issues in a supported browser", "defined browser support list", "browser pass rate", "testing checkout in Chrome, Firefox, and Edge", "evidence of browser compatibility", "compatibility testing"],
    ["Accessibility Testing", "the evaluation of whether people with disabilities can use the application effectively", "identify barriers to inclusive use", "check keyboard navigation and accessible labels", "accessibility checklist", "excluding users who rely on assistive technology", "accessible design criteria", "accessibility issue count", "tabbing through a form without a mouse", "improved inclusive access", "accessibility testing"],
    ["Session Management", "the handling of user authentication state, timeout, logout, and session security", "ensure user sessions are secure and predictable", "verify timeout and logout behavior", "session test scenario", "unauthorized access through stale sessions", "authenticated test account", "session-related defect count", "checking that Back does not restore access after logout", "secure session behavior", "security testing"],
    ["Form Validation", "the checking of user input for required fields, formats, ranges, and business rules", "prevent invalid data from being accepted", "test valid, invalid, and boundary inputs", "form validation test case", "bad data entering the system", "defined field rules", "validation coverage", "submitting a required field blank", "reliable data capture", "negative testing"]]],
  ["Mobile Testing", [
    ["Device Compatibility", "the verification that a mobile app works across supported devices, screen sizes, and OS versions", "find device-specific functional and layout issues", "run priority scenarios on representative devices", "device coverage matrix", "failures on common customer devices", "supported device list", "device pass rate", "checking a screen on a small Android device", "evidence of supported-device behavior", "compatibility testing"],
    ["Mobile Permissions", "the testing of application requests and handling for device permissions such as camera and location", "ensure permission flows are clear and safe", "test allow, deny, and later-change scenarios", "permission test case", "app failures after permission denial", "permission-dependent feature", "permission flow coverage", "denying camera access before uploading a photo", "predictable permission behavior", "negative testing"],
    ["Network Conditions", "the evaluation of app behavior under offline, slow, unstable, and recovered connectivity", "verify resilience when connectivity changes", "switch network state during key transactions", "network condition scenario", "data loss or misleading feedback during outages", "network-enabled test environment", "offline scenario pass rate", "submitting a form while airplane mode is enabled", "reliable connectivity handling", "interruption testing"],
    ["Orientation and Layout", "the verification of app display and behavior in portrait and landscape orientations", "ensure content remains usable after rotation", "rotate the device during key screens", "orientation test case", "clipped or lost content after rotation", "rotatable supported device", "orientation defect count", "rotating while a form is open", "stable responsive layout", "usability testing"],
    ["Mobile Notifications", "the testing of push notification delivery, content, actions, and deep links", "confirm notifications inform users and open the right context", "validate receipt and tap behavior", "notification scenario", "misdirected or missing user alerts", "configured notification service", "notification delivery rate", "tapping an order alert to open order details", "reliable notification experience", "end-to-end testing"]]],
  ["API Testing", [
    ["HTTP Methods", "the use of methods such as GET, POST, PUT, PATCH, and DELETE to request API actions", "verify each endpoint performs its intended operation", "send the specified method with valid and invalid payloads", "API test case", "incorrect operation or unintended data changes", "available API specification", "endpoint pass rate", "sending POST to create a customer", "confidence in endpoint behavior", "API testing"],
    ["Status Codes", "standard response codes that communicate the outcome of an HTTP request", "confirm APIs communicate success and failure correctly", "verify status codes for expected and error conditions", "API response record", "clients misinterpreting API results", "defined API contract", "status-code accuracy", "expecting 401 for an unauthenticated request", "consistent client-server communication", "contract testing"],
    ["Request Validation", "the API enforcement of required fields, formats, types, and business constraints in requests", "prevent invalid or unsafe input from being processed", "send missing, malformed, and boundary values", "request validation matrix", "invalid data being accepted", "documented request schema", "invalid-request coverage", "omitting a required email field in a JSON payload", "robust API input handling", "negative testing"],
    ["Authentication and Authorization", "the verification of identity checks and permissions for protected API resources", "ensure only permitted users can perform actions", "test valid, invalid, expired, and insufficient credentials", "security test case", "unauthorized data access", "test credentials with roles", "authorization defect count", "calling an admin endpoint with a standard user token", "evidence of access control", "security testing"],
    ["API Error Handling", "the API behavior for invalid requests, server failures, and unexpected conditions", "confirm errors are safe, consistent, and useful to clients", "verify error body, code, and no sensitive leakage", "error response checklist", "clients receiving misleading or exposed internal information", "error scenarios and contract", "error handling coverage", "sending malformed JSON to an endpoint", "predictable failure behavior", "negative testing"]]],
  ["Database Testing", [
    ["Data Integrity", "the accuracy, consistency, and validity of stored data across database operations", "ensure stored data remains trustworthy", "compare saved records with submitted values", "data validation query", "corrupted or inconsistent records", "access to test database", "data mismatch count", "checking that an order total matches its line items", "reliable persisted data", "backend testing"],
    ["CRUD Operations", "the create, read, update, and delete behaviors used to manage stored records", "verify core record lifecycle operations", "perform each operation and verify database state", "CRUD test scenario", "incorrect record lifecycle behavior", "testable entity and permissions", "CRUD pass rate", "updating a customer address and checking the stored value", "correct record management", "backend testing"],
    ["Database Constraints", "rules such as primary keys, foreign keys, unique values, and not-null requirements that protect data quality", "confirm invalid records are prevented at the data layer", "attempt inserts that violate each constraint", "constraint test case", "orphaned or duplicate records", "known schema constraints", "constraint violation coverage", "trying to create two users with the same unique email", "enforced data rules", "negative testing"],
    ["Data Migration", "the movement and transformation of data from one system or schema to another", "ensure migrated data is complete, accurate, and usable", "reconcile source and target record samples", "migration reconciliation report", "lost or altered historical data", "source and target data sets", "migration accuracy rate", "comparing record counts before and after migration", "validated transition of data", "data reconciliation"],
    ["Stored Procedures", "database routines that execute predefined logic on the database server", "verify database-side logic returns correct results", "execute with normal, invalid, and boundary parameters", "stored procedure test case", "incorrect data processing in database logic", "procedure specification and test data", "procedure pass rate", "testing a procedure that calculates monthly totals", "evidence of correct database logic", "backend testing"]]],
  ["Agile Testing", [
    ["User Story Testing", "the validation of a small user-focused requirement against its acceptance criteria", "confirm the story delivers the intended user value", "derive scenarios directly from acceptance criteria", "user story test set", "acceptance criteria left unverified", "ready user story", "story acceptance coverage", "testing a story for changing a profile photo", "evidence that the story is done", "acceptance testing"],
    ["Acceptance Criteria", "specific conditions that define when a user story or feature is acceptable", "make expected behavior testable and shared", "review criteria for clarity before testing", "acceptance criteria checklist", "different interpretations of done", "defined user story", "criteria coverage", "clarifying what happens when a search has no results", "shared definition of expected behavior", "requirements review"],
    ["Sprint Testing", "testing planned work within a sprint to provide rapid feedback before the sprint ends", "help the team deliver a potentially shippable increment", "test completed stories continuously during the sprint", "sprint test status", "late discovery of sprint defects", "sprint backlog and build", "sprint pass rate", "testing a story as soon as it reaches the test environment", "timely quality feedback", "continuous testing"],
    ["Exploratory Testing", "simultaneous learning, test design, and execution guided by a charter and observations", "discover risks that scripted testing may miss", "investigate a focused charter and record findings", "exploratory session notes", "unknown workflow risks", "testable product area", "exploratory defects found", "exploring unusual navigation after editing a record", "new insight into product risks", "exploratory testing"],
    ["Retrospective Quality Improvement", "the team practice of reflecting on delivery outcomes and choosing process improvements", "turn quality lessons into practical team actions", "review recurring defects and agree an improvement", "retrospective action item", "repeating avoidable quality problems", "completed sprint evidence", "improvement action completion rate", "adding a peer review step after recurring requirement gaps", "continuous quality improvement", "retrospective"]]],
];

const headers = ["Role Name", "Role Slug", "Question Code", "Section", "Topic", "Difficulty", "Question", "Options", "Correct Answer", "Keywords", "Marks", "Active"];
const letters = ["A", "B", "C", "D"];

function makeQuestions(section, topic, i, info) {
  const [name, definition, goal, activity, artifact, risk, prerequisite, metric, example, outcome, technique] = info;
  const q = [
    [`What best describes ${name}?`, definition, [goal, activity, artifact]],
    [`What is the primary objective of ${name}?`, goal, [definition, risk, prerequisite]],
    [`Which activity is most appropriate when performing ${name}?`, activity, ["Skip documentation", "Test only happy paths", "Ignore available evidence"]],
    [`Which artifact is most useful for ${name}?`, artifact, ["Source code repository", "Payroll report", "Marketing brochure"]],
    [`Which risk is ${name} intended to reduce?`, risk, ["Higher screen brightness", "Faster keyboard input", "More office seating"]],
    [`What is a useful prerequisite for ${name}?`, prerequisite, ["A production outage", "An unapproved release", "A deleted test environment"]],
    [`Which metric can help monitor ${name}?`, metric, ["Office attendance", "Coffee consumption", "Keyboard replacement rate"]],
    [`Which is an example of ${name}?`, example, ["Changing the office wallpaper", "Ordering new stationery", "Deleting all test evidence"]],
    [`What outcome should ${name} provide?`, outcome, ["Uncontrolled changes", "Less visibility into quality", "Unverified assumptions"]],
    [`Which technique is commonly associated with ${name}?`, technique, ["Random guessing", "Skipping review", "Production-only testing"]],
  ];
  const [question, answer, distractors] = q[i];
  const answerIndex = (i + topic.length) % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, answer);
  return { question, answer, options: options.map((v, idx) => `${letters[idx]}. ${v}`).join(" | ") };
}

const rows = [];
let code = 1;
for (const [section, topics] of sections) {
  for (const info of topics) {
    for (let i = 0; i < 10; i++) {
      const item = makeQuestions(section, info[0], i, info);
      rows.push([
        "Manual Tester",
        "manual-tester",
        `MT${String(code).padStart(3, "0")}`,
        section,
        info[0],
        i < 3 ? "Easy" : i < 7 ? "Medium" : "Hard",
        item.question,
        item.options,
        item.answer,
        `${info[0]} | ${info[10]} | manual testing`,
        i < 3 ? 1 : i < 7 ? 2 : 3,
        "TRUE",
      ]);
      code++;
    }
  }
}

if (rows.length !== 500) throw new Error(`Expected 500 questions, got ${rows.length}`);

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Manual Testing Questions");
sheet.showGridLines = false;
sheet.getRange("A1:L1").values = [headers];
sheet.getRange("A2:L501").values = rows;

const table = sheet.tables.add("A1:L501", true, "ManualTestingQuestions");
table.style = "TableStyleMedium2";
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(3);

sheet.getRange("A1:L1").format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#B4C7E7" },
};
sheet.getRange("A2:L501").format = {
  verticalAlignment: "top",
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#D9E2F3" },
};
sheet.getRange("A1:L501").format.font = { name: "Aptos", size: 10, color: "#1F2937" };
sheet.getRange("A1:L1").format.font = { name: "Aptos Display", size: 10, bold: true, color: "#FFFFFF" };
sheet.getRange("A1:L1").format.rowHeight = 28;
sheet.getRange("A2:L501").format.rowHeight = 48;
const widths = [120, 115, 85, 155, 160, 75, 330, 400, 220, 220, 55, 65];
for (let c = 0; c < widths.length; c++) sheet.getRangeByIndexes(0, c, 501, 1).format.columnWidthPx = widths[c];
sheet.getRange("F2:F501").dataValidation = { rule: { type: "list", values: ["Easy", "Medium", "Hard"] } };
sheet.getRange("L2:L501").dataValidation = { rule: { type: "list", values: ["TRUE", "FALSE"] } };
sheet.getRange("K2:K501").format.horizontalAlignment = "center";
sheet.getRange("L2:L501").format.horizontalAlignment = "center";
sheet.getRange("A2:C501").format.horizontalAlignment = "center";

const check = await workbook.inspect({ kind: "table", range: "Manual Testing Questions!A1:L8", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 12 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 20 }, summary: "formula error scan" });
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "Manual Testing Questions", range: "A1:L8", scale: 1.2, format: "png" });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/manual_testing_questions_500.xlsx`);
