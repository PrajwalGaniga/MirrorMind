import '../../models/student_model.dart';
import '../../providers/student_provider.dart';
import 'app_launcher_service.dart';

enum MobileIntentType {
  appLaunch,
  dbQuery,
  dbMutation,
  navigation,
  ragQuery,
}

class MobileIntentResult {
  final MobileIntentType type;
  final bool handled;
  final String spokenReply;
  final String displayText;
  final String? uiAction;
  final Map<String, dynamic>? actionData;

  MobileIntentResult({
    required this.type,
    required this.handled,
    required this.spokenReply,
    required this.displayText,
    this.uiAction,
    this.actionData,
  });

  factory MobileIntentResult.unhandled() {
    return MobileIntentResult(
      type: MobileIntentType.ragQuery,
      handled: false,
      spokenReply: '',
      displayText: '',
    );
  }
}

class MobileIntentService {
  static final MobileIntentService _instance = MobileIntentService._internal();
  factory MobileIntentService() => _instance;
  MobileIntentService._internal();

  final AppLauncherService _appLauncher = AppLauncherService();

  /// Primary intent evaluator: inspects user input, detects if it's an app launcher,
  /// database query, database mutation, or navigation command, and executes it immediately.
  Future<MobileIntentResult> evaluate(
    String rawInput, {
    required StudentProvider studentProvider,
  }) async {
    final text = rawInput.trim();
    if (text.isEmpty) return MobileIntentResult.unhandled();

    final lower = text.toLowerCase();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. APP LAUNCHING INTENT: "turn on my Instagram", "open WhatsApp", etc.
    // ──────────────────────────────────────────────────────────────────────────
    if (_appLauncher.matches(text)) {
      final launchRes = await _appLauncher.launchByIntent(text);
      return MobileIntentResult(
        type: MobileIntentType.appLaunch,
        handled: true,
        spokenReply: launchRes.spokenReply,
        displayText: launchRes.displayText,
        uiAction: 'APP_LAUNCHED',
        actionData: {'app': launchRes.appName, 'success': launchRes.success},
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. DATABASE MUTATION INTENTS: Update CGPA, add/delete project, skills, etc.
    // ──────────────────────────────────────────────────────────────────────────

    // 2a. Update CGPA
    final cgpaMatch = RegExp(r'\b(?:update|change|set)\s+(?:my\s+)?(?:cgpa|gpa|grade\s*point)\s+(?:to\s+)?(\d+(?:\.\d+)?)\b', caseSensitive: false).firstMatch(text);
    if (cgpaMatch != null && cgpaMatch.groupCount >= 1) {
      final valStr = cgpaMatch.group(1);
      final newCgpa = double.tryParse(valStr ?? '');
      if (newCgpa != null && newCgpa >= 0.0 && newCgpa <= 10.0) {
        final ok = await studentProvider.updateProfile({'cgpa': newCgpa});
        final spoken = ok
            ? "I've updated your CGPA to $newCgpa in the database and re-calibrated your student digital twin."
            : "Sorry, I encountered an issue updating your CGPA in the database.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "🎓 CGPA updated to $newCgpa in MongoDB" : "⚠️ Failed to update CGPA",
          uiAction: 'PROFILE_UPDATED',
          actionData: {'field': 'cgpa', 'value': newCgpa},
        );
      }
    }

    // 2b. Update Semester
    final semMatch = RegExp(r'\b(?:update|change|set)\s+(?:my\s+)?(?:semester|sem)\s+(?:to\s+)?([1-8])\b', caseSensitive: false).firstMatch(text);
    if (semMatch != null && semMatch.groupCount >= 1) {
      final newSem = int.tryParse(semMatch.group(1) ?? '');
      if (newSem != null) {
        final ok = await studentProvider.updateProfile({'semester': newSem});
        final spoken = ok
            ? "Your semester has been updated to $newSem."
            : "Failed to update semester in the database.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "📚 Semester updated to $newSem" : "⚠️ Failed to update semester",
          uiAction: 'PROFILE_UPDATED',
          actionData: {'field': 'semester', 'value': newSem},
        );
      }
    }

    // 2c. Update Career Interest
    final careerMatch = RegExp(r'\b(?:update|change|set)\s+(?:my\s+)?(?:career\s*interest|career\s*path|career\s*goal)\s+(?:to\s+)?(.+)', caseSensitive: false).firstMatch(text);
    if (careerMatch != null && careerMatch.groupCount >= 1) {
      final newCareer = careerMatch.group(1)?.trim();
      if (newCareer != null && newCareer.isNotEmpty) {
        final ok = await studentProvider.updateProfile({'career_interest': newCareer});
        final spoken = ok
            ? "Your target career interest is now set to $newCareer."
            : "Failed to update career interest.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "🎯 Career interest updated to $newCareer" : "⚠️ Failed to update career interest",
          uiAction: 'PROFILE_UPDATED',
          actionData: {'field': 'career_interest', 'value': newCareer},
        );
      }
    }

    // 2d. Add Skill: "add skill [name]" or "add [name] to my skills"
    final addSkillMatch = RegExp(r'\b(?:add\s+skill|add\s+(.+?)\s+to\s+(?:my\s+)?skills?)\b', caseSensitive: false).firstMatch(text);
    if (addSkillMatch != null) {
      String? skillName = addSkillMatch.group(1);
      if (skillName == null) {
        // pattern: "add skill Docker"
        final parts = text.split(RegExp(r'\badd\s+skill\s+', caseSensitive: false));
        if (parts.length > 1) skillName = parts[1].trim();
      }
      if (skillName != null && skillName.isNotEmpty) {
        // remove punctuation
        skillName = skillName.replaceAll(RegExp(r'[.!?;]'), '').trim();
        final ok = await studentProvider.addSkill(skillName);
        final spoken = ok
            ? "Added $skillName to your skill matrix in the database."
            : "Failed to add skill $skillName.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "💡 Added skill: $skillName" : "⚠️ Failed to add skill",
          uiAction: 'PROFILE_UPDATED',
          actionData: {'field': 'skills', 'skill': skillName},
        );
      }
    }

    // 2e. Delete Project: "delete project [name]", "remove project [name]"
    final delProjMatch = RegExp(r'\b(?:delete|remove|drop)\s+(?:the\s+)?project\s+(.+)', caseSensitive: false).firstMatch(text);
    if (delProjMatch != null && delProjMatch.groupCount >= 1) {
      var projTitle = delProjMatch.group(1)?.trim() ?? '';
      projTitle = projTitle.replaceAll(RegExp(r'\b(?:from\s+(?:my\s+)?(?:db|database|portfolio))\b', caseSensitive: false), '').trim();
      projTitle = projTitle.replaceAll(RegExp(r'[.!?;]'), '').trim();

      if (projTitle.isNotEmpty) {
        final ok = await studentProvider.deleteProjectByName(projTitle);
        final spoken = ok
            ? "I have deleted project '$projTitle' from your database portfolio."
            : "Could not find a project matching '$projTitle' in your database.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "🗑️ Deleted project '$projTitle'" : "⚠️ Project '$projTitle' not found",
          uiAction: ok ? 'PROJECT_DELETED' : null,
          actionData: {'title': projTitle},
        );
      }
    }

    // 2f. Add Project: "add project [name] with [tech]" or "add project [name]"
    final addProjMatch = RegExp(r'\b(?:add|create)\s+(?:a\s+|new\s+)?project\s+(.+)', caseSensitive: false).firstMatch(text);
    if (addProjMatch != null && !lower.contains('delete') && !lower.contains('remove')) {
      final raw = addProjMatch.group(1)?.trim() ?? '';
      String title = raw;
      List<String> techStack = [];
      String desc = '';

      if (raw.toLowerCase().contains(' with ')) {
        final spl = raw.split(RegExp(r'\s+with\s+', caseSensitive: false));
        title = spl[0].trim();
        final techPart = spl.length > 1 ? spl[1].trim() : '';
        techStack = techPart.split(RegExp(r'[,&]|\band\b')).map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
      } else if (raw.toLowerCase().contains(' using ')) {
        final spl = raw.split(RegExp(r'\s+using\s+', caseSensitive: false));
        title = spl[0].trim();
        final techPart = spl.length > 1 ? spl[1].trim() : '';
        techStack = techPart.split(RegExp(r'[,&]|\band\b')).map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
      }

      title = title.replaceAll(RegExp(r'[.!?;]'), '').trim();
      if (title.isNotEmpty) {
        desc = "Project focusing on $title, built with ${techStack.join(', ')}.";
        final ok = await studentProvider.addProject({
          'title': title,
          'description': desc,
          'tech_stack': techStack,
          'github_url': null,
          'live_demo_url': null,
        });

        final spoken = ok
            ? "I've added project '$title' to your portfolio in the database."
            : "Could not add project '$title' to the database.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "✨ Added project '$title' to MongoDB" : "⚠️ Failed to add project",
          uiAction: 'PROJECT_ADDED',
          actionData: {'title': title, 'tech_stack': techStack},
        );
      }
    }

    // 2g. Delete Internship: "delete internship [company]", "remove internship [company]"
    final delInternMatch = RegExp(r'\b(?:delete|remove)\s+(?:the\s+)?internship\s+(?:at\s+)?(.+)', caseSensitive: false).firstMatch(text);
    if (delInternMatch != null && delInternMatch.groupCount >= 1) {
      var compName = delInternMatch.group(1)?.trim() ?? '';
      compName = compName.replaceAll(RegExp(r'[.!?;]'), '').trim();
      if (compName.isNotEmpty) {
        final ok = await studentProvider.deleteInternshipByCompany(compName);
        final spoken = ok
            ? "I have deleted the internship at '$compName' from your database records."
            : "Could not find an internship at '$compName'.";
        return MobileIntentResult(
          type: MobileIntentType.dbMutation,
          handled: true,
          spokenReply: spoken,
          displayText: ok ? "🗑️ Removed internship at '$compName'" : "⚠️ Internship at '$compName' not found",
          uiAction: ok ? 'INTERNSHIP_DELETED' : null,
          actionData: {'company_name': compName},
        );
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. DATABASE INSPECTION / QUERY INTENTS: Asking for database details
    // ──────────────────────────────────────────────────────────────────────────

    // Ensure student profile is loaded for inspection
    StudentModel? student = studentProvider.student;
    if (student == null) {
      await studentProvider.fetchProfile();
      student = studentProvider.student;
    }

    // 3a. Projects in database
    if (RegExp(r'\b(?:what\s+projects|list\s+my\s+projects|show\s+my\s+projects|how\s+many\s+projects|my\s+projects|projects\s+in\s+(?:my\s+)?(?:db|database))\b', caseSensitive: false).hasMatch(text)) {
      final projects = student?.projects ?? [];
      if (projects.isEmpty) {
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: "You currently don't have any projects stored in your database portfolio. Would you like to add one?",
          displayText: "📁 **Portfolio Projects (0)**\nNo projects recorded yet in MongoDB. Say *'Add project [name]'* to record one.",
        );
      } else {
        final titles = projects.map((p) => p.title).join(', ');
        final spoken = "You have ${projects.length} ${projects.length == 1 ? 'project' : 'projects'} in your database: $titles.";
        final buf = StringBuffer();
        buf.writeln('📁 **Portfolio Projects (${projects.length}) in Database:**');
        for (int i = 0; i < projects.length; i++) {
          final p = projects[i];
          final tech = p.techStack.isNotEmpty ? ' • Tech: ${p.techStack.join(", ")}' : '';
          buf.writeln('${i + 1}. **${p.title}**$tech\n   ${p.description}');
        }
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: spoken,
          displayText: buf.toString().trim(),
        );
      }
    }

    // 3b. CGPA & Academic records
    if (RegExp(r'\b(?:what\s+is\s+my\s+cgpa|my\s+gpa|what\s+is\s+my\s+gpa|show\s+my\s+cgpa|academic\s+details|what\s+semester)\b', caseSensitive: false).hasMatch(text)) {
      if (student == null) {
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: "I couldn't retrieve your academic record right now.",
          displayText: "⚠️ Academic profile not found in database.",
        );
      }
      final cgpa = student.cgpa.toStringAsFixed(2);
      final sem = student.semester;
      final branch = student.branch;
      final spoken = "Your current CGPA in the database is $cgpa in $branch, Semester $sem.";
      final display = '🎓 **Academic Records in Database:**\n- **CGPA:** $cgpa / 10.0\n- **Branch:** $branch\n- **Semester:** $sem\n- **College Tier:** Tier ${student.collegeTier}\n- **Backlogs:** ${student.backlogCount}';
      return MobileIntentResult(
        type: MobileIntentType.dbQuery,
        handled: true,
        spokenReply: spoken,
        displayText: display,
      );
    }

    // 3c. Skills in database
    if (RegExp(r'\b(?:what\s+skills|list\s+my\s+skills|show\s+my\s+skills|my\s+skills|skills\s+in\s+(?:my\s+)?(?:db|database)|technologies\s+do\s+i\s+know)\b', caseSensitive: false).hasMatch(text)) {
      final skills = student?.skills ?? [];
      if (skills.isEmpty) {
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: "You have no skills recorded in the database yet. Say 'Add skill Python' to record your first skill.",
          displayText: "💡 **Skills Matrix (0)**\nNo skills recorded in database yet.",
        );
      }
      final spoken = "Your database records list ${skills.length} skills, including ${skills.take(5).join(', ')}.";
      final display = '💡 **Skills Matrix (${skills.length}) in Database:**\n${skills.map((s) => '`$s`').join('  ')}';
      return MobileIntentResult(
        type: MobileIntentType.dbQuery,
        handled: true,
        spokenReply: spoken,
        displayText: display,
      );
    }

    // 3d. Internships in database
    if (RegExp(r'\b(?:what\s+internships|list\s+my\s+internships|show\s+my\s+internships|work\s+experience|internships\s+in\s+database)\b', caseSensitive: false).hasMatch(text)) {
      final interns = student?.internships ?? [];
      if (interns.isEmpty) {
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: "You don't have any internships recorded in your database yet.",
          displayText: "💼 **Internship Experience (0)**\nNo internships recorded in database yet.",
        );
      }
      final spoken = "You have ${interns.length} ${interns.length == 1 ? 'internship' : 'internships'} recorded: ${interns.map((i) => "${i.role} at ${i.companyName}").join(', ')}.";
      final buf = StringBuffer();
      buf.writeln('💼 **Work Experience (${interns.length}) in Database:**');
      for (int i = 0; i < interns.length; i++) {
        final intern = interns[i];
        buf.writeln('${i + 1}. **${intern.role}** at **${intern.companyName}** (${intern.domain})');
      }
      return MobileIntentResult(
        type: MobileIntentType.dbQuery,
        handled: true,
        spokenReply: spoken,
        displayText: buf.toString().trim(),
      );
    }

    // 3e. Comprehensive Digital Twin Profile details
    if (RegExp(r'\b(?:tell\s+me\s+about\s+my\s+profile|show\s+my\s+profile|my\s+database\s+details|digital\s+twin\s+details|what\s+is\s+stored\s+in\s+my\s+database)\b', caseSensitive: false).hasMatch(text)) {
      if (student == null) {
        return MobileIntentResult(
          type: MobileIntentType.dbQuery,
          handled: true,
          spokenReply: "Your student profile is currently empty in the database.",
          displayText: "⚠️ No profile found.",
        );
      }
      final spoken = "Here are your profile details from the database: CGPA is ${student.cgpa.toStringAsFixed(2)}, Semester ${student.semester} ${student.branch}. You have ${student.projects.length} projects, ${student.internships.length} internships, and ${student.skills.length} skills recorded.";
      final display = '🤖 **Student Digital Twin Record:**\n'
          '- **Academic:** ${student.branch}, Semester ${student.semester}, CGPA ${student.cgpa.toStringAsFixed(2)}\n'
          '- **Target Career:** ${student.careerInterest}\n'
          '- **Work Style:** ${student.workStylePref}\n'
          '- **Verified Projects:** ${student.projects.length}\n'
          '- **Internships:** ${student.internships.length}\n'
          '- **Recorded Skills:** ${student.skills.length}';
      return MobileIntentResult(
        type: MobileIntentType.dbQuery,
        handled: true,
        spokenReply: spoken,
        displayText: display,
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. NAVIGATION INTENTS: "go to projects", "open profile", etc.
    // ──────────────────────────────────────────────────────────────────────────
    final navMap = {
      'projects': '/projects',
      'profile': '/profile',
      'internships': '/internships',
      'interview': '/interview',
      'prediction': '/predict',
      'predict': '/predict',
      'documents': '/documents',
      'docs': '/documents',
      'settings': '/settings',
      'dashboard': '/dashboard',
      'home': '/dashboard',
    };

    final navMatch = RegExp(r'^(?:go\s+to|navigate\s+to|take\s+me\s+to|switch\s+to|open)\s+(?:the\s+)?(projects|profile|internships|interview|prediction|predict|documents|docs|settings|dashboard|home)$', caseSensitive: false).firstMatch(text);
    if (navMatch != null && navMatch.groupCount >= 1) {
      final destKey = navMatch.group(1)?.toLowerCase();
      final path = navMap[destKey];
      if (path != null) {
        return MobileIntentResult(
          type: MobileIntentType.navigation,
          handled: true,
          spokenReply: "Navigating to $destKey.",
          displayText: "🚀 Navigating to $destKey screen...",
          uiAction: 'NAVIGATE',
          actionData: {'path': path, 'destination': destKey},
        );
      }
    }

    // Default: Not a local intent -> pass to RAG / LLM
    return MobileIntentResult.unhandled();
  }
}
