# Nova Platform --- UI/UX Reference & Design Specification

## 1. Design Direction

Use the uploaded dashboard as the **visual reference**, not as a content
template.

The target product should feel like a **premium AI career / interview
operating system**: clean, calm, intelligent, highly structured, and
modern.

### Core visual language

-   Light-first interface with a soft blue/white background.
-   Deep navy/near-black text for strong readability.
-   Blue as the primary action/accent color.
-   Very soft borders and shadows instead of heavy outlines.
-   Large rounded cards with approximately 18--24px radius.
-   Generous spacing and strong visual hierarchy.
-   Thin, minimal icons.
-   Small status pills for states such as Active, In Progress,
    Completed, Pending, High Priority.
-   Charts should be simple and readable rather than visually
    overloaded.
-   Use subtle gradients, glass effects, and background blur only where
    they improve hierarchy.
-   Avoid excessive glassmorphism, neon colors, excessive animations,
    and dense enterprise-style tables.

The reference image uses a **dashboard inside a large rounded
application shell**. Keep that overall feeling while redesigning the
content around the actual product.

------------------------------------------------------------------------

# 2. Global Application Structure

The application should have a persistent desktop layout:

``` text
┌─────────────────────────────────────────────────────────────────────┐
│ Logo / Product       Dashboard  Interviews  Skills  Calendar  ...  │
│                                                        Search  Nova │
├───────────────┬─────────────────────────────────────────────────────┤
│               │                                                     │
│ Optional      │                    Main Content                    │
│ Sidebar       │                                                     │
│               │                                                     │
│               │                                                     │
│               │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

Prefer a **top navigation + contextual sidebar** rather than a
permanently heavy sidebar.

### Primary navigation

Recommended sections:

-   Dashboard
-   AI Interviews
-   Interview History
-   Skills / Readiness
-   Projects
-   Calendar
-   Analytics / Reports
-   Profile
-   Settings

The exact names can be adapted to the existing application's features.

### Navigation behavior

-   Active page uses a filled blue pill or subtle blue background.
-   Hover produces a small background transition.
-   Navigation must never cause a full visual reset.
-   Preserve application state when moving between sections where
    possible.
-   Use breadcrumbs only for deeper pages.
-   The top navigation remains visually stable throughout the product.

------------------------------------------------------------------------

# 3. Dashboard

The dashboard should be the user's **command center**, not just a
collection of statistics.

## Header

Example structure:

``` text
Good morning, Prajwal

Here's your career readiness overview.

[Search]                         [Notifications] [Nova] [Profile]
```

The greeting can change based on time.

Keep the header visually lightweight.

------------------------------------------------------------------------

# 4. Hero / Nova Card

The large profile/visual card from the reference image should become the
**Nova AI Assistant card**.

Instead of a human photograph, place a 3D assistant/avatar.

### Card concept

``` text
┌───────────────────────────────────────────────┐
│ Nova                                         │
│                                               │
│        [ 3D AI Assistant ]                    │
│                                               │
│ Your AI career assistant                     │
│ "Ready when you are."                        │
│                                               │
│ [ Talk to Nova ]              ● Online        │
└───────────────────────────────────────────────┘
```

### 3D assistant

Use a Three.js / React Three Fiber based assistant.

The assistant should:

-   Idle with subtle breathing/movement.
-   Look toward the user/camera.
-   React to voice activation.
-   Show a subtle glow when listening.
-   Show an activity animation while processing.
-   React differently while speaking.
-   Never dominate the entire dashboard.
-   Remain visually elegant and lightweight.

Do not make it look like a game character unless the product's branding
specifically requires that.

------------------------------------------------------------------------

# 5. "Hey Nova" AI Assistant

Nova should be a **global assistant**, not another page.

The user can say:

> "Hey Nova"

and the assistant becomes active.

## Default state

Nova remains minimized.

Possible UI:

``` text
                         ┌───────────────┐
                         │   Nova ●      │
                         │ Ask anything  │
                         └───────────────┘
```

or a small floating assistant orb.

## Activated state

When called, Nova should open from the right side.

``` text
┌─────────────────────────────────────────────┬──────────────────────┐
│                                             │ NOVA                 │
│              Current Page                   │ ● Listening          │
│                                             │                      │
│                                             │ "What can I help     │
│                                             │  you with?"           │
│                                             │                      │
│                                             │ [Live activity]       │
│                                             │                      │
│                                             │ Background tasks      │
│                                             │ ✓ Reading profile    │
│                                             │ ✓ Preparing report   │
│                                             │ ⟳ Analyzing skills   │
│                                             │                      │
│                                             │ [Close] [Mute]       │
└─────────────────────────────────────────────┴──────────────────────┘
```

### Important interaction principle

Nova must **not block the main application**.

If the user asks:

> "Analyze my interview performance and prepare a report."

Nova should acknowledge immediately and perform longer operations in the
background.

The UI should communicate:

``` text
User speaks
      ↓
Nova acknowledges
      ↓
Background task starts
      ↓
User continues using application
      ↓
Nova updates task status
      ↓
Result becomes available
```

This is critical for making the system feel responsive.

------------------------------------------------------------------------

# 6. Nova Activity System

Use a small activity feed inside the assistant.

Example:

``` text
Nova Activity

● Listening
✓ Interview transcript loaded
✓ Skills analyzed
⟳ Generating improvement plan
○ Report pending
```

Each activity should have:

-   Status icon
-   Short description
-   Optional timestamp
-   Progress indicator for long tasks

Avoid exposing technical details such as API calls, vector databases,
queues, or model names to normal users.

------------------------------------------------------------------------

# 7. Dashboard Statistics

Use compact KPI cards similar to the reference image.

Recommended cards:

### Interview Readiness

``` text
82%
Career Readiness

↑ 8% this month
```

### Interview Performance

``` text
78%
Average Score

↑ 6% from previous interviews
```

### Skills

``` text
14 / 20
Skills Strong

6 skills need improvement
```

### Interviews

``` text
12
Completed

3 scheduled
```

Cards should show:

-   Primary number
-   Label
-   Small trend/change
-   Optional miniature chart

Do not overload cards with information.

------------------------------------------------------------------------

# 8. Main Dashboard Sections

Recommended layout:

``` text
┌──────────────────────────┬──────────────────────────┐
│ Readiness Overview       │ Upcoming Interviews     │
│                          │                          │
│ Large chart              │ Calendar/list            │
├──────────────────────────┼──────────────────────────┤
│ Skill Performance        │ Nova Insights            │
│                          │                          │
│ Radar/bar chart           │ AI-generated insights   │
├──────────────────────────┴──────────────────────────┤
│ Recent Interviews / Activity                         │
└──────────────────────────────────────────────────────┘
```

Use a responsive grid.

On smaller screens, cards stack vertically.

------------------------------------------------------------------------

# 9. AI Interviewer Screen

The AI interview page should feel completely different from the
dashboard.

It should feel like a **live interview environment**.

### Layout

``` text
┌───────────────────────────────────────────────────────────┐
│ Interview: Software Engineer        12:42     ● Live      │
├───────────────────────────────────────┬───────────────────┤
│                                       │ Candidate          │
│             AI Interviewer            │                   │
│                                       │ Camera / Avatar    │
│          [AI Avatar / 3D Face]        │                   │
│                                       │                   │
│ "Tell me about your project..."       │                   │
│                                       │                   │
├───────────────────────────────────────┴───────────────────┤
│ 🎙 Listening...     [Mute] [End Interview]                 │
└───────────────────────────────────────────────────────────┘
```

### Interview states

The interface must clearly communicate:

-   Connecting
-   Ready
-   Listening
-   Candidate speaking
-   AI thinking
-   AI speaking
-   Evaluating
-   Complete
-   Connection issue

Do not make the user guess what the system is doing.

------------------------------------------------------------------------

# 10. Live Transcript

The transcript should appear progressively without causing visual noise.

Example:

``` text
AI Interviewer
Tell me about your most challenging project.

Candidate
The most challenging project I worked on was...

AI
What was your specific contribution?
```

Use different visual treatment for:

-   AI speech
-   Candidate speech
-   System messages

The transcript should remain readable during long answers.

------------------------------------------------------------------------

# 11. Interview Evaluation Panel

After or during an interview, show structured metrics.

Example:

``` text
Interview Performance

Overall
78%

Communication       84%
Technical Depth     76%
Problem Solving     81%
Confidence          72%
Clarity             86%
```

Use charts only where they communicate useful information.

For detailed evaluation, provide:

-   Strengths
-   Weak areas
-   Evidence from answers
-   Suggested improvements
-   Follow-up practice areas

Avoid presenting unexplained AI scores.

------------------------------------------------------------------------

# 12. Calendar

Calendar should be a first-class feature.

Provide:

-   Month view
-   Week view
-   Day view
-   Upcoming interview list
-   Interview status
-   Preparation reminders
-   AI-generated preparation tasks

Example:

``` text
September 2026

Mon   Tue   Wed   Thu   Fri   Sat   Sun
 21    22    23    24    25    26    27
                         ●
 28    29    30

Upcoming
● AI Interview — 10:00 AM
● DSA Practice — 4:00 PM
● Project Review — Tomorrow
```

Use blue for primary events and subtle secondary colors for different
event types.

------------------------------------------------------------------------

# 13. Skills / Career Readiness

Create a visual skill map.

Example:

``` text
Career Readiness

Backend Development       █████████░  90%
AI / ML                   ████████░░  82%
DSA                       ███████░░░  74%
Communication             ████████░░  81%
System Design             ██████░░░░  64%
```

The page should explain **why** a score changed rather than simply
displaying a number.

------------------------------------------------------------------------

# 14. Reports / Analytics

Use a professional analytics layout.

Include:

-   Interview history
-   Score progression
-   Skill progression
-   Frequently missed concepts
-   Communication trends
-   Recent AI recommendations

Allow date filtering.

Example:

``` text
[ Last 7 Days ] [ 30 Days ] [ 3 Months ] [ Custom ]
```

------------------------------------------------------------------------

# 15. Visual Effects

Use effects deliberately.

### Recommended

-   `border-radius: 18–24px`
-   Very soft box shadows
-   Subtle blue gradients
-   Background blur for overlays
-   Smooth 150--250ms transitions
-   Small scale/opacity changes on hover
-   Animated progress indicators
-   Subtle glow around active Nova states
-   Smooth drawer transitions

### Avoid

-   Heavy neon UI
-   Excessive glass panels
-   Large glowing borders
-   Constant particle animations
-   Excessive gradients
-   Every card having a different color
-   Excessive rounded "bubble" elements
-   Animation that delays user interaction

The interface should feel **premium and intelligent, not flashy**.

------------------------------------------------------------------------

# 16. Typography

Recommended:

-   Inter
-   Space Grotesk for selected headings
-   System fallback

Hierarchy:

``` text
Page title       28–36px
Section heading  18–22px
Card heading     14–16px
Body             14–15px
Secondary text   12–13px
```

Use weight and spacing more than color to establish hierarchy.

------------------------------------------------------------------------

# 17. Color System

Primary:

-   Deep navy / near-black for text
-   Blue for primary actions
-   Very light blue/gray for application background
-   White for cards

Semantic:

-   Green → success
-   Amber → warning
-   Red → error
-   Blue → active/information

Keep the palette controlled.

------------------------------------------------------------------------

# 18. Component System

Build reusable components instead of designing each page independently.

Core components:

``` text
AppShell
TopNavigation
Sidebar
PageHeader
StatCard
ChartCard
NovaAssistant
NovaDrawer
NovaActivity
Avatar3D
StatusBadge
ProgressBar
Calendar
InterviewRoom
Transcript
ScoreCard
InsightCard
ActivityFeed
Modal
Toast
```

All components should share the same spacing, typography, border radius,
shadows, and interaction behavior.

------------------------------------------------------------------------

# 19. Responsive Behavior

Desktop:

-   Full dashboard grid
-   Persistent navigation
-   Nova drawer from right
-   Large charts and interview layout

Tablet:

-   Reduced navigation
-   Two-column dashboard
-   Collapsible Nova drawer

Mobile:

-   Bottom navigation or compact top navigation
-   Single-column dashboard
-   Nova becomes a bottom sheet
-   Interview UI prioritizes AI/candidate video and controls
-   Charts become horizontally scrollable where necessary

Never simply shrink the desktop UI.

------------------------------------------------------------------------

# 20. Nova Interaction States

Nova should have a clear visual state machine:

``` text
IDLE
 ↓
WAKE_WORD_DETECTED
 ↓
LISTENING
 ↓
PROCESSING
 ↓
RESPONDING
 ↓
BACKGROUND_TASK
 ↓
IDLE
```

Each state should have a subtle visual difference.

Example:

-   Idle → normal 3D animation
-   Listening → blue glow + microphone indicator
-   Processing → soft animated ring
-   Speaking → avatar reacts to speech
-   Background task → compact progress indicator

------------------------------------------------------------------------

# 21. Overall Product Feeling

The final product should communicate:

> **"This is a serious professional platform powered by an AI
> assistant."**

It should not feel like:

-   a generic admin dashboard,
-   a chatbot wrapped around a website,
-   a gaming interface,
-   or a collection of unrelated pages.

The dashboard is the **command center**.

The AI interviewer is the **live interaction environment**.

Nova is the **persistent intelligent layer across the entire
application**.

Calendar and analytics are supporting systems around the user's career
workflow.

------------------------------------------------------------------------

# 22. Reference Image Interpretation

The uploaded image should be used as the primary visual reference for:

-   overall spacing
-   card proportions
-   rounded application shell
-   navigation treatment
-   light background
-   blue accent language
-   dashboard hierarchy
-   KPI placement
-   chart cards
-   task/activity lists
-   soft shadows
-   clean professional appearance

Do **not** copy its business data, names, profile information, or exact
content.

Replace the reference's profile-photo concept with the **Nova 3D
assistant**.

Replace generic business dashboard content with the actual
application's:

-   AI interview system
-   candidate readiness
-   interview analytics
-   skills
-   projects
-   calendar
-   AI assistant
-   reports
-   activity

------------------------------------------------------------------------

# 23. Implementation Principle

The redesign should be implemented as a **unified design system**, not
as individual page redesigns.

First establish:

1.  Application shell
2.  Navigation
3.  Typography
4.  Color tokens
5.  Card system
6.  Button system
7.  Status system
8.  Nova assistant
9.  Charts/statistics
10. Responsive behavior

Then rebuild each page using those components.

The goal is a visually consistent product where opening Dashboard, AI
Interview, Calendar, Analytics, or Nova feels like entering different
parts of the **same application**.

## Final UX Rule

The user should always know:

-   Where they are
-   What the system is doing
-   What Nova is doing
-   Whether the microphone is active
-   Whether an interview is live
-   Whether a task is running in the background
-   What needs their attention next
