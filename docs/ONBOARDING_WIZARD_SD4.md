# Onboarding Wizard v1 (SD Grade 4 Locked)

## Goal
The ultimate success metric of V1 Modulajar is a **Time-to-first-generate of under 3 minutes**. 

The Onboarding Wizard (`/onboarding`) replaces the raw generation endpoint to create a guided, 3-step experience specifically tailored towards converting new educators into active generation consumers safely with proper variables set.

## Routing Prerequisites
Accessing the onboarding wizard unconditionally depends on fulfilling two workspace-scoped requirements. The URL automatically forces a user through these checks:

1. **Teacher Profile** (`/profile-setup`): Handled in PR-051. Required to gather educator target name and subject alignments.
2. **School Identity** (`/workspace/school-setup`): Handled in PR-052. Required to guarantee the generated letters and RPP templates have physical institution anchors properly formed contextually.

*If either of these are missing (returning `HTTP 404`), the Onboarding UI will intercept the load and safely route the user context back out until the checklist completes.*

## V1 Constraints
To accelerate delivery and lock down quality, PR-053 specifically restricts curriculum variables to **Sekolah Dasar (SD) Kelas 4**.
- **Path Options**: Only "Generate dari Template" is currently enabled. "Edit Template" and "AI Assist dari Nol" are visibly stubbed but locked with a "Coming Soon" badge.
- **Classes**: Jenjang and Kelas form fields are disabled UI selectors, strictly injecting `SD` and `4` respectfully into the final generated syllabus template API calls.

## Payload Delivery
Navigating sequence `Choose Path -> Minimal Form -> Review Data` executes `POST /w/:workspaceId/internal/generate-semester` maintaining backend structural stability, immediately delegating UX back towards the standard `/jobs` polling system.
