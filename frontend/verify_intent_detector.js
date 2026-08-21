import { detectIntent, isActionIntent } from './src/utils/intentDetector.js';

console.log('================================================');
console.log('MIRRORMIND MODULE 9.1 — INTENT DETECTOR VERIFICATION');
console.log('================================================\n');

const testCases = [
  // WAKE (handled before this layer, but should just be INFO if it slips through)
  { input: "Hello MirrorMind", expected: "INFORMATION_QUERY" },
  
  // OPEN DOCUMENT
  { input: "Open my resume", expected: "OPEN_DOCUMENT" },
  { input: "Show my resume", expected: "OPEN_DOCUMENT" },
  { input: "Open my CV", expected: "OPEN_DOCUMENT" },
  { input: "Display my resume", expected: "OPEN_DOCUMENT" },
  { input: "View my resume", expected: "OPEN_DOCUMENT" },
  { input: "Bring up my resume", expected: "OPEN_DOCUMENT" },
  { input: "Open the resume", expected: "OPEN_DOCUMENT" },
  { input: "Show my CV", expected: "OPEN_DOCUMENT" },
  { input: "Open my document", expected: "OPEN_DOCUMENT" },
  
  // ADD PROJECT
  { input: "Add a project", expected: "ADD_PROJECT" },
  { input: "Create a new project", expected: "ADD_PROJECT" },
  { input: "I want to add a project", expected: "ADD_PROJECT" },
  { input: "Insert a project", expected: "ADD_PROJECT" },
  { input: "Add one more project", expected: "ADD_PROJECT" },
  { input: "New project", expected: "ADD_PROJECT" },
  
  // ADD INTERNSHIP
  { input: "Add an internship", expected: "ADD_INTERNSHIP" },
  { input: "Create a new internship", expected: "ADD_INTERNSHIP" },
  { input: "I want to add an internship", expected: "ADD_INTERNSHIP" },
  { input: "Record an internship", expected: "ADD_INTERNSHIP" },
  
  // PROFILE
  { input: "Update my CGPA", expected: "EDIT_PROFILE" },
  { input: "Change my CGPA", expected: "EDIT_PROFILE" },
  { input: "Set my CGPA", expected: "EDIT_PROFILE" },
  { input: "Update my GPA", expected: "EDIT_PROFILE" },
  { input: "Update my name", expected: "EDIT_PROFILE" },
  
  // NAVIGATION
  { input: "Go to projects", expected: "NAVIGATE" },
  { input: "Open projects", expected: "NAVIGATE" },
  { input: "Show projects", expected: "NAVIGATE" },
  { input: "Take me to projects", expected: "NAVIGATE" },
  { input: "Go to internships", expected: "NAVIGATE" },
  { input: "Open internships", expected: "NAVIGATE" },
  { input: "Open my profile", expected: "NAVIGATE" },
  { input: "Show my profile", expected: "NAVIGATE" },
  { input: "Go to settings", expected: "NAVIGATE" },
  
  // CANCELLATION
  { input: "Cancel", expected: "CANCEL_ACTION" },
  { input: "No", expected: "CANCEL_ACTION" },
  { input: "Stop", expected: "CANCEL_ACTION" },
  
  // CONFIRMATION
  { input: "Yes", expected: "CONFIRM_ACTION" },
  { input: "Proceed", expected: "CONFIRM_ACTION" },

  // NORMAL RAG
  { input: "What should I learn next for backend development?", expected: "INFORMATION_QUERY" },
  
  // DOCUMENT RAG
  { input: "Tell me about the research and publications in my resume.", expected: "INFORMATION_QUERY" },
  { input: "From the document I uploaded, can you tell me what research and publication work I have done?", expected: "INFORMATION_QUERY" },
  
  // FUZZY RECOVERY (Simulated Whisper garble)
  { input: "open my resumé", expected: "OPEN_DOCUMENT" },
  { input: "open my resume dot pdf", expected: "OPEN_DOCUMENT" }, // dot pdf stripped
  { input: "see v", expected: "OPEN_DOCUMENT" }, // normalized to cv
  
  // UNKNOWN WITH SUGGESTION (Too garbled for confidence, but close enough to suggest)
  // "open my" has sim ~ 0.5 - 0.7 to "open my cv"
  { input: "open my", expected: "UNKNOWN" }, 
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = detectIntent(tc.input);
  
  const isPass = result.intent === tc.expected;
  if (isPass) passed++;
  else failed++;

  const icon = isPass ? '✅' : '❌';
  console.log(`${icon} Input: "${tc.input}"`);
  console.log(`   Expected: ${tc.expected}`);
  console.log(`   Got:      ${result.intent} (conf: ${result.confidence.toFixed(2)})`);
  
  if (result.suggestion) {
     console.log(`   Suggests: "${result.suggestion}"`);
  }
  
  if (!isPass) {
    console.log(`   Payload:  `, result.payload);
  }
  console.log('---');
}

console.log('\n================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================');

if (failed > 0) process.exit(1);
